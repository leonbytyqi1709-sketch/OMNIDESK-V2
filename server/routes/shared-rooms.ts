import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { z } from 'zod'
import {
  RoomError,
  roomCreate,
  roomVersion,
  roomItemCreate,
  roomItemUpdate,
  roomRole,
  roomExpiry,
  roomToken,
  roomJoin,
} from '../rooms-policy'
import * as storage from '../rooms-storage'
export const roomDependencies = {
  listRooms: storage.listRooms,
  createRoom: storage.createRoom,
  roomDetail: storage.roomDetail,
  createRoomItem: storage.createRoomItem,
  updateRoomItem: storage.updateRoomItem,
  deleteRoomItem: storage.deleteRoomItem,
  closeRoom: storage.closeRoom,
  deleteRoom: storage.deleteRoom,
  inviteToRoom: storage.inviteToRoom,
  revokeRoomInvite: storage.revokeRoomInvite,
  previewRoomInvite: storage.previewRoomInvite,
  joinRoom: storage.joinRoom,
  updateRoomMember: storage.updateRoomMember,
  leaveRoom: storage.leaveRoom,
  roomSource: storage.roomSource,
}
export function createRoomsRoute(deps = roomDependencies) {
  const route = new Hono()
  route.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    await next()
  })
  route.use(
    '*',
    bodyLimit({
      maxSize: 600_000,
      onError: (c) => c.json({ error: 'Die Anfrage ist zu groß.' }, 413),
    }),
  )
  route.onError((e, c) =>
    c.json(
      {
        error:
          e instanceof RoomError
            ? e.message
            : 'Raum konnte nicht geladen oder geändert werden. Verbindung und Datenbank prüfen.',
      },
      e instanceof RoomError ? e.status : 503,
    ),
  )
  route.get('/', async (c) => c.json(await deps.listRooms(c.get('userId'))))
  route.post('/', async (c) => {
    const input = roomCreate.safeParse(await c.req.json().catch(() => null))
    if (!input.success)
      return c.json(
        {
          error:
            'Titel, Inhalte und Ablaufdatum (innerhalb eines Jahres) prüfen.',
        },
        400,
      )
    return c.json(await deps.createRoom(c.get('userId'), input.data), 201)
  })
  route.post('/invitation/preview', async (c) => {
    const input = z
      .object({ token: roomToken })
      .strict()
      .safeParse(await c.req.json().catch(() => null))
    if (!input.success) return c.json({ error: 'Ungültige Einladung.' }, 400)
    return c.json(await deps.previewRoomInvite(input.data.token))
  })
  route.post('/invitation/join', async (c) => {
    const input = roomJoin.safeParse(await c.req.json().catch(() => null))
    if (!input.success)
      return c.json({ error: 'Einladung und Anzeigenamen prüfen.' }, 400)
    return c.json(
      await deps.joinRoom(c.get('userId'), input.data.token, input.data.name),
    )
  })
  route.get('/source/:projectId', async (c) => {
    const id = c.req.param('projectId')
    if (!z.uuid().safeParse(id).success)
      return c.json({ error: 'Ungültige Projektkennung.' }, 400)
    return c.json(await deps.roomSource(c.get('userId'), id))
  })
  route.use('/:roomId/*', async (c, next) => {
    if (!z.uuid().safeParse(c.req.param('roomId')).success)
      return c.json({ error: 'Ungültige Raumkennung.' }, 400)
    for (const key of ['itemId', 'memberId', 'inviteId']) {
      const id = c.req.param(key)
      if (id && !z.uuid().safeParse(id).success)
        return c.json({ error: 'Ungültige Kennung.' }, 400)
    }
    await next()
  })
  route.get('/:roomId', async (c) =>
    c.json(await deps.roomDetail(c.get('userId'), c.req.param('roomId'))),
  )
  route.post('/:roomId/items', async (c) => {
    const input = roomItemCreate.safeParse(await c.req.json().catch(() => null))
    if (!input.success)
      return c.json({ error: 'Ungültiger Listen- oder Pinnwandeintrag.' }, 400)
    return c.json(
      await deps.createRoomItem(
        c.get('userId'),
        c.req.param('roomId'),
        input.data,
      ),
      201,
    )
  })
  route.put('/:roomId/items/:itemId', async (c) => {
    const input = roomItemUpdate.safeParse(await c.req.json().catch(() => null))
    if (!input.success)
      return c.json({ error: 'Inhalt und Versionsstand prüfen.' }, 400)
    await deps.updateRoomItem(
      c.get('userId'),
      c.req.param('roomId'),
      c.req.param('itemId'),
      input.data,
    )
    return c.json({ ok: true })
  })
  route.delete('/:roomId/items/:itemId', async (c) => {
    const input = roomVersion.safeParse(await c.req.json().catch(() => null))
    if (!input.success) return c.json({ error: 'Versionsstand fehlt.' }, 400)
    await deps.deleteRoomItem(
      c.get('userId'),
      c.req.param('roomId'),
      c.req.param('itemId'),
      input.data.version,
    )
    return c.json({ ok: true })
  })
  route.post('/:roomId/invites', async (c) => {
    const input = z
      .object({ role: roomRole, expiresAt: roomExpiry })
      .strict()
      .safeParse(await c.req.json().catch(() => null))
    if (!input.success)
      return c.json({ error: 'Rolle und Ablaufdatum prüfen.' }, 400)
    return c.json(
      await deps.inviteToRoom(
        c.get('userId'),
        c.req.param('roomId'),
        input.data.role,
        input.data.expiresAt,
      ),
      201,
    )
  })
  route.delete('/:roomId/invites/:inviteId', async (c) => {
    await deps.revokeRoomInvite(
      c.get('userId'),
      c.req.param('roomId'),
      c.req.param('inviteId'),
    )
    return c.json({ ok: true })
  })
  route.put('/:roomId/members/:memberId', async (c) => {
    const input = z
      .object({
        role: roomRole,
        revoked: z.boolean(),
        version: z.number().int().positive(),
      })
      .strict()
      .safeParse(await c.req.json().catch(() => null))
    if (!input.success)
      return c.json({ error: 'Rolle und Versionsstand prüfen.' }, 400)
    await deps.updateRoomMember(
      c.get('userId'),
      c.req.param('roomId'),
      c.req.param('memberId'),
      input.data.role,
      input.data.revoked,
      input.data.version,
    )
    return c.json({ ok: true })
  })
  route.post('/:roomId/leave', async (c) => {
    await deps.leaveRoom(c.get('userId'), c.req.param('roomId'))
    return c.json({ ok: true })
  })
  route.post('/:roomId/close', async (c) => {
    const input = roomVersion.safeParse(await c.req.json().catch(() => null))
    if (!input.success) return c.json({ error: 'Versionsstand fehlt.' }, 400)
    await deps.closeRoom(
      c.get('userId'),
      c.req.param('roomId'),
      input.data.version,
    )
    return c.json({ ok: true })
  })
  route.delete('/:roomId', async (c) => {
    const input = roomVersion.safeParse(await c.req.json().catch(() => null))
    if (!input.success) return c.json({ error: 'Versionsstand fehlt.' }, 400)
    await deps.deleteRoom(
      c.get('userId'),
      c.req.param('roomId'),
      input.data.version,
    )
    return c.json({ ok: true })
  })
  return route
}
export const sharedRoomsRoute = createRoomsRoute()
