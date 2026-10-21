import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { postgresStorage } from './support/postgres'
import * as store from '../server/rooms-storage'
import { roomCreate, roomExpiry } from '../server/rooms-policy'
import { createRoomsRoute } from '../server/routes/shared-rooms'
import { createApp } from '../server/app'
import {
  captureRoomInvitation,
  forgetRoomInvitation,
} from '../src/lib/room-invitation'
const future = () => new Date(Date.now() + 86400000).toISOString()
const input = (id = randomUUID()) => ({
  id,
  title: 'Übergabe',
  description: 'Nur bewusst geteilte Inhalte',
  expiresAt: future(),
  initialItems: [{ kind: 'list' as const, text: 'Ausgewählte Aufgabe' }],
})
const appFor = (userId: string) => {
  const app = new Hono()
  app.use('*', async (c, next) => {
    c.set('userId', userId)
    await next()
  })
  app.route('/rooms', createRoomsRoute())
  return app
}
test('invitation fragments survive the Clerk hash route in tab storage and are cleared explicitly', () => {
  const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const savedStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    'sessionStorage',
  )
  const values = new Map<string, string>()
  const location = {
    pathname: '/shared-rooms',
    search: '',
    hash: '#invite=' + 'a'.repeat(43),
  }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location,
      history: {
        replaceState() {
          location.hash = ''
        },
      },
    },
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      setItem(k: string, v: string) {
        values.set(k, v)
      },
      getItem(k: string) {
        return values.get(k) || null
      },
      removeItem(k: string) {
        values.delete(k)
      },
    },
  })
  try {
    assert.equal(captureRoomInvitation(), 'a'.repeat(43))
    assert.equal(location.hash, '')
    location.hash = '#/sign-up'
    assert.equal(captureRoomInvitation(), 'a'.repeat(43))
    forgetRoomInvitation()
    assert.equal(captureRoomInvitation(), '')
    values.set(
      'omnidesk-room-invitation',
      JSON.stringify({ token: 'a'.repeat(43), until: Date.now() - 1 }),
    )
    assert.equal(captureRoomInvitation(), '')
    assert.equal(values.size, 0)
  } finally {
    if (savedWindow) Object.defineProperty(globalThis, 'window', savedWindow)
    else Reflect.deleteProperty(globalThis, 'window')
    if (savedStorage)
      Object.defineProperty(globalThis, 'sessionStorage', savedStorage)
    else Reflect.deleteProperty(globalThis, 'sessionStorage')
  }
})

test('room, member, invitation and item limits are enforced in SQL without consuming blocked invitations', async () => {
  const { pg, close } = await postgresStorage()
  try {
    const data = input()
    await store.createRoom('owner', data)
    await pg.query(
      "INSERT INTO v2_room_items(id,room_id,kind,text) SELECT gen_random_uuid(),$1,'pin','Fixture' FROM generate_series(1,199)",
      [data.id],
    )
    await assert.rejects(
      store.createRoomItem('owner', data.id, {
        id: randomUUID(),
        kind: 'pin',
        text: 'Beyond limit',
      }),
    )
    const invite = await store.inviteToRoom(
      'owner',
      data.id,
      'reader',
      new Date(Date.now() + 2 * 86400000).toISOString(),
    )
    const expires = (await store.roomDetail('owner', data.id)).invites[0]
      .expiresAt
    assert.equal(Date.parse(expires), Date.parse(data.expiresAt))
    await pg.query(
      "INSERT INTO v2_room_invites(id,room_id,token_hash,role,expires_at) SELECT gen_random_uuid(),$1,'fixture-'||n,'reader',now()+interval '1 hour' FROM generate_series(1,19) n",
      [data.id],
    )
    await assert.rejects(
      store.inviteToRoom('owner', data.id, 'reader', future()),
    )
    await pg.query(
      "INSERT INTO v2_room_members(id,room_id,user_id,name,role) SELECT gen_random_uuid(),$1,'fixture-'||n,'Fixture','reader' FROM generate_series(1,50) n",
      [data.id],
    )
    await assert.rejects(store.joinRoom('member', invite.token, 'Blocked'))
    assert.equal((await store.previewRoomInvite(invite.token)).role, 'reader')
    await pg.query(
      "DELETE FROM v2_room_members WHERE room_id=$1 AND user_id='fixture-1'",
      [data.id],
    )
    await store.joinRoom('member', invite.token, 'Now fits')
    await pg.query(
      "INSERT INTO v2_shared_rooms(id,owner_id,creation_hash,title,description,expires_at) SELECT gen_random_uuid(),'owner','fixture','Fixture','',now()+interval '1 day' FROM generate_series(1,99)",
    )
    await assert.rejects(store.createRoom('owner', input()))
  } finally {
    await close()
  }
})
test('rooms validate scope, expiry, strict input and authentication at the real app boundary', async () => {
  const data = input()
  assert.ok(roomCreate.safeParse(data).success)
  for (const value of [
    { ...data, owner_id: 'foreign' },
    { ...data, initialItems: Array(101).fill(data.initialItems[0]) },
    { ...data, expiresAt: new Date(Date.now() - 1000).toISOString() },
  ])
    assert.equal(roomCreate.safeParse(value).success, false)
  assert.equal(
    roomExpiry.safeParse(new Date(Date.now() + 367 * 86400000).toISOString())
      .success,
    false,
  )
  for (const path of [
    '/api/shared-rooms',
    '/api/shared-rooms/invitation/preview',
    '/api/shared-rooms/invitation/join',
  ])
    assert.equal(
      (
        await createApp().request(path, {
          method: path.includes('invitation') ? 'POST' : 'GET',
        })
      ).status,
      401,
    )
  const app = appFor('owner')
  assert.equal((await app.request('/rooms/not-uuid')).status, 400)
  assert.equal(
    (
      await app.request('/rooms/' + randomUUID() + '/items/not-uuid', {
        method: 'DELETE',
      })
    ).status,
    400,
  )
  assert.equal(
    (
      await app.request('/rooms', {
        method: 'POST',
        body: JSON.stringify({ ...data, userId: 'attacker' }),
        headers: { 'Content-Type': 'application/json' },
      })
    ).status,
    400,
  )
})
test('rooms initialize additively, isolate owners and copy only selected texts with retry protection', async () => {
  const { pg, close } = await postgresStorage()
  try {
    assert.deepEqual(await store.listRooms('owner'), [])
    const data = input()
    await store.createRoom('owner', data)
    await store.initializeRooms()
    await store.createRoom('owner', data)
    assert.equal((await store.listRooms('owner')).length, 1)
    assert.deepEqual(await store.listRooms('other'), [])
    await assert.rejects(store.roomDetail('other', data.id))
    await assert.rejects(store.createRoom('other', data))
    await assert.rejects(
      store.createRoom('owner', { ...data, title: 'Changed retry' }),
    )
    const detail = await store.roomDetail('owner', data.id)
    assert.equal(detail.items.length, 1)
    assert.equal(detail.items[0].text, data.initialItems[0].text)
    assert.equal(detail.room.role, 'owner')
    assert.ok(!JSON.stringify(detail).includes('owner_id'))
    assert.ok(!JSON.stringify(detail).includes('creation_hash'))
    assert.equal((await pg.query('SELECT * FROM v2_room_items')).rows.length, 1)
    const empty = { ...input(), initialItems: [] }
    await store.createRoom('owner', empty)
    assert.equal((await store.roomDetail('owner', empty.id)).items.length, 0)
  } finally {
    await close()
  }
})
test('single-use hashed invitations bind accounts, cannot be used by others or restore downgraded/revoked roles', async () => {
  const { pg, close } = await postgresStorage()
  try {
    const data = input()
    await store.createRoom('owner', data)
    await assert.rejects(
      store.inviteToRoom('other', data.id, 'editor', future()),
    )
    const invite = await store.inviteToRoom(
      'owner',
      data.id,
      'editor',
      future(),
    )
    assert.equal((await store.previewRoomInvite(invite.token)).role, 'editor')
    assert.ok(
      !JSON.stringify(
        (await pg.query('SELECT * FROM v2_room_invites')).rows,
      ).includes(invite.token),
    )
    await assert.rejects(store.joinRoom('owner', invite.token, 'Owner'))
    assert.equal(
      (await store.joinRoom('member', invite.token, 'Alex')).id,
      data.id,
    )
    await assert.rejects(store.joinRoom('stranger', invite.token, 'Imposter'))
    await assert.rejects(store.previewRoomInvite(invite.token))
    assert.equal(
      (await store.joinRoom('member', invite.token, 'Retry')).id,
      data.id,
    )
    let member = (await store.roomDetail('owner', data.id)).members[0]
    await store.updateRoomMember(
      'owner',
      data.id,
      member.id,
      'reader',
      false,
      member.version,
    )
    await store.joinRoom('member', invite.token, 'Replay old editor invite')
    assert.equal(
      (await store.roomDetail('member', data.id)).room.role,
      'reader',
    )
    member = (await store.roomDetail('owner', data.id)).members[0]
    await store.updateRoomMember(
      'owner',
      data.id,
      member.id,
      'reader',
      true,
      member.version,
    )
    await assert.rejects(store.joinRoom('member', invite.token, 'Rejoin'))
    await assert.rejects(store.roomDetail('member', data.id))
    assert.deepEqual(await store.listRooms('member'), [])
    const next = await store.inviteToRoom('owner', data.id, 'reader', future())
    await store.joinRoom('member', next.token, 'Alex again')
    assert.equal(
      (await store.roomDetail('member', data.id)).room.role,
      'reader',
    )
    const revoked = await store.inviteToRoom(
      'owner',
      data.id,
      'reader',
      future(),
    )
    await store.revokeRoomInvite('owner', data.id, revoked.id)
    await assert.rejects(store.joinRoom('third', revoked.token, 'Third'))
    const expired = await store.inviteToRoom(
      'owner',
      data.id,
      'reader',
      future(),
    )
    await pg.query(
      "UPDATE v2_room_invites SET expires_at=now()-interval '1 second' WHERE id=$1",
      [expired.id],
    )
    await assert.rejects(store.previewRoomInvite(expired.token))
    await assert.rejects(store.joinRoom('third', expired.token, 'Third'))
  } finally {
    await close()
  }
})
test('readers cannot mutate, editors cannot manage the room, and cross-room/version attacks fail', async () => {
  const { close } = await postgresStorage()
  try {
    const a = input(),
      b = input()
    await store.createRoom('owner', a)
    await store.createRoom('other', b)
    const invite = await store.inviteToRoom('owner', a.id, 'reader', future())
    await store.joinRoom('member', invite.token, 'Reader')
    let item = (await store.roomDetail('owner', a.id)).items[0]
    const edit = { text: 'Edited', done: true, version: item.version }
    await assert.rejects(store.updateRoomItem('member', a.id, item.id, edit))
    await assert.rejects(
      store.deleteRoomItem('member', a.id, item.id, item.version),
    )
    await assert.rejects(
      store.createRoomItem('member', a.id, {
        id: randomUUID(),
        kind: 'pin',
        text: 'Forbidden',
      }),
    )
    const member = (await store.roomDetail('owner', a.id)).members[0]
    await store.updateRoomMember(
      'owner',
      a.id,
      member.id,
      'editor',
      false,
      member.version,
    )
    await assert.rejects(
      store.updateRoomMember('member', a.id, member.id, 'editor', true, 2),
    )
    await assert.rejects(store.closeRoom('member', a.id, 1))
    await assert.rejects(store.deleteRoom('member', a.id, 1))
    await assert.rejects(store.inviteToRoom('member', a.id, 'editor', future()))
    assert.deepEqual((await store.roomDetail('member', a.id)).members, [])
    assert.deepEqual((await store.roomDetail('member', a.id)).invites, [])
    await store.updateRoomItem('member', a.id, item.id, edit)
    await assert.rejects(store.updateRoomItem('owner', a.id, item.id, edit))
    await assert.rejects(store.deleteRoomItem('owner', b.id, item.id, 2))
    const pin = {
      id: randomUUID(),
      kind: 'pin' as const,
      text: '<script>literal</script>',
    }
    await store.createRoomItem('member', a.id, pin)
    await store.createRoomItem('member', a.id, pin)
    await assert.rejects(
      store.createRoomItem('member', a.id, {
        ...pin,
        text: 'Conflicting retry',
      }),
    )
    assert.equal((await store.roomDetail('owner', a.id)).items.length, 2)
    await store.leaveRoom('member', a.id)
    await assert.rejects(
      store.updateRoomItem('member', a.id, item.id, { ...edit, version: 2 }),
    )
    item = (await store.roomDetail('owner', a.id)).items.find(
      (i) => i.id === item.id,
    )!
    assert.equal(item.done, true)
    assert.equal(item.version, 2)
  } finally {
    await close()
  }
})
test('expiry and closing stop participant access and all content writes; owner retains read-only history until cascade deletion', async () => {
  const { pg, close } = await postgresStorage()
  try {
    for (const expire of [false, true]) {
      const data = input()
      await store.createRoom('owner', data)
      const invite = await store.inviteToRoom(
        'owner',
        data.id,
        'editor',
        future(),
      )
      await store.joinRoom('member', invite.token, 'Alex')
      const unused = await store.inviteToRoom(
        'owner',
        data.id,
        'reader',
        future(),
      )
      if (expire)
        await pg.query(
          "UPDATE v2_shared_rooms SET expires_at=now()-interval '1 second' WHERE id=$1",
          [data.id],
        )
      else await store.closeRoom('owner', data.id, 1)
      assert.equal(
        (await store.roomDetail('owner', data.id)).room.active,
        false,
      )
      await assert.rejects(store.roomDetail('member', data.id))
      await assert.rejects(store.joinRoom('new', unused.token, 'New'))
      assert.deepEqual(await store.listRooms('member'), [])
      for (const user of ['owner', 'member'])
        await assert.rejects(
          store.createRoomItem(user, data.id, {
            id: randomUUID(),
            kind: 'pin',
            text: 'Too late',
          }),
        )
      await assert.rejects(
        store.inviteToRoom('owner', data.id, 'reader', future()),
      )
      const current = (await store.roomDetail('owner', data.id)).room
      await store.deleteRoom('owner', data.id, current.version)
      for (const table of [
        'v2_room_items',
        'v2_room_members',
        'v2_room_invites',
      ])
        assert.equal(
          (await pg.query(`SELECT * FROM ${table} WHERE room_id=$1`, [data.id]))
            .rows.length,
          0,
        )
    }
  } finally {
    await close()
  }
})
test('source preview and authenticated API never expose private projects or accept caller ownership', async () => {
  const { pg, close } = await postgresStorage()
  try {
    await pg.exec(
      'CREATE TABLE projects(id uuid PRIMARY KEY,user_id text,name text,description text); CREATE TABLE project_tasks(id uuid PRIMARY KEY,project_id uuid,user_id text,title text)',
    )
    const projectId = randomUUID(),
      taskId = randomUUID()
    await pg.query('INSERT INTO projects VALUES($1,$2,$3,$4)', [
      projectId,
      'owner',
      'Private project',
      'Private description',
    ])
    await pg.query('INSERT INTO project_tasks VALUES($1,$2,$3,$4)', [
      taskId,
      projectId,
      'owner',
      'Selected task',
    ])
    await assert.rejects(store.roomSource('other', projectId))
    assert.equal(
      (await store.roomSource('owner', projectId)).tasks[0].title,
      'Selected task',
    )
    const app = appFor('owner'),
      data = input()
    const request = (path: string, method = 'GET', body?: unknown) =>
      app.request('/rooms' + path, {
        method,
        ...(body === undefined
          ? {}
          : {
              body: JSON.stringify(body),
              headers: { 'Content-Type': 'application/json' },
            }),
      })
    assert.equal((await request('', 'POST', data)).status, 201)
    const detail = await request('/' + data.id)
    assert.equal(detail.status, 200)
    assert.equal(detail.headers.get('Cache-Control'), 'no-store')
    const denied = await appFor('other').request(
      '/rooms/' + data.id + '?userId=owner',
    )
    assert.equal(denied.status, 404)
    assert.ok(!JSON.stringify(await denied.json()).includes(data.title))
    const response = await request('/' + data.id + '/invites', 'POST', {
      role: 'editor',
      expiresAt: future(),
    })
    assert.equal(response.status, 201)
    const token = (await response.json()).token
    const foreign = appFor('member')
    const join = await foreign.request('/rooms/invitation/join', {
      method: 'POST',
      body: JSON.stringify({ token, name: 'Member' }),
      headers: { 'Content-Type': 'application/json' },
    })
    assert.equal(join.status, 200)
    await store.closeRoom('owner', data.id, 1)
    assert.equal((await foreign.request('/rooms/' + data.id)).status, 404)
  } finally {
    await close()
  }
})
