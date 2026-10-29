import assert from 'node:assert/strict'
import test from 'node:test'
import { Hono } from 'hono'
import { appointmentsRoute } from '../server/routes/appointments'
import { MAX_OCCURRENCES, occurrences, type RecurrenceRule } from '../src/lib/recurrence'
import { postgresStorage } from './support/postgres'

const owner = 'owner',
  stranger = 'stranger'

const rule = (overrides: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  frequency: 'weekly',
  interval: 1,
  weekdays: [],
  ends: { type: 'count', count: 4 },
  ...overrides,
})

const base = {
  title: 'Jour fixe',
  description: 'Wochenbesprechung',
  location: 'Büro',
  priority: 'medium',
  startsAt: '2026-11-02T09:00:00.000+01:00',
  endsAt: '2026-11-02T10:00:00.000+01:00',
}

function api(userId = owner) {
  const app = new Hono()
  app.use('*', async (c, next) => {
    c.set('userId', userId)
    await next()
  })
  app.route('/appointments', appointmentsRoute)
  const send = (path: string, method: string, body?: unknown) =>
    app.request(`/appointments${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  return {
    create: (body: unknown) => send('', 'POST', body),
    update: (id: string, body: unknown, scope?: string) =>
      send(`/${id}${scope ? `?scope=${scope}` : ''}`, 'PUT', body),
    remove: (id: string, scope?: string) =>
      send(`/${id}${scope ? `?scope=${scope}` : ''}`, 'DELETE'),
    series: (id: string) => send(`/${id}/series`, 'GET'),
    list: async () => {
      const response = await app.request('/appointments')
      assert.equal(response.status, 200)
      return (await response.json()) as Array<{
        id: string
        title: string
        startsAt: string
        endsAt: string
        seriesId: string | null
      }>
    },
  }
}

test('Regelberechnung', async (t) => {
  await t.test('wöchentlich zählt die gewünschte Zahl an Terminen', () => {
    const dates = occurrences(new Date('2026-11-02T09:00:00+01:00'), rule({ ends: { type: 'count', count: 4 } }))
    assert.equal(dates.length, 4)
    assert.deepEqual(
      dates.map((date) => date.getDate()),
      [2, 9, 16, 23],
    )
  })

  await t.test('mehrere Wochentage je Woche', () => {
    const dates = occurrences(
      new Date('2026-11-02T09:00:00+01:00'), // Montag
      rule({ weekdays: [1, 4], ends: { type: 'count', count: 4 } }),
    )
    assert.deepEqual(
      dates.map((date) => `${date.getDate()}.${date.getMonth() + 1}`),
      ['2.11', '5.11', '9.11', '12.11'],
    )
  })

  await t.test('alle zwei Wochen lässt eine Woche aus', () => {
    const dates = occurrences(
      new Date('2026-11-02T09:00:00+01:00'),
      rule({ interval: 2, ends: { type: 'count', count: 3 } }),
    )
    assert.deepEqual(
      dates.map((date) => date.getDate()),
      [2, 16, 30],
    )
  })

  await t.test('monatlich überspringt Monate ohne diesen Tag', () => {
    const dates = occurrences(
      new Date('2027-01-31T09:00:00+01:00'),
      rule({ frequency: 'monthly', ends: { type: 'count', count: 3 } }),
    )
    // Februar hat keinen 31., der Termin fällt dort aus statt zu verrutschen.
    assert.deepEqual(
      dates.map((date) => `${date.getDate()}.${date.getMonth() + 1}`),
      ['31.1', '31.3', '31.5'],
    )
  })

  await t.test('die Uhrzeit bleibt über die Zeitumstellung erhalten', () => {
    // Ende Oktober 2027 endet die Sommerzeit in Europa.
    const dates = occurrences(
      new Date('2027-10-20T09:00:00+02:00'),
      rule({ ends: { type: 'count', count: 3 } }),
    )
    assert.deepEqual(new Set(dates.map((date) => date.getHours())), new Set([9]))
  })

  await t.test('ein Enddatum begrenzt die Serie', () => {
    const dates = occurrences(
      new Date('2026-11-02T09:00:00+01:00'),
      rule({ ends: { type: 'until', until: '2026-11-16' } }),
    )
    assert.equal(dates.length, 3)
  })

  await t.test('die Obergrenze greift auch bei täglich ohne Ende', () => {
    const dates = occurrences(
      new Date('2026-11-02T09:00:00+01:00'),
      rule({ frequency: 'daily', ends: { type: 'count', count: 9999 } }),
    )
    assert.equal(dates.length, MAX_OCCURRENCES)
  })
})

test('Serientermine über die API', async (t) => {
  const storage = await postgresStorage()
  try {
    await storage.pg.exec(`
      CREATE TABLE appointments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,
        title text NOT NULL,description text NOT NULL DEFAULT '',location text NOT NULL DEFAULT '',
        priority text NOT NULL DEFAULT 'medium',starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
    `)

    await t.test('legt alle Termine der Serie an', async () => {
      const response = await api().create({ ...base, recurrence: rule() })
      assert.equal(response.status, 201)
      const created = (await response.json()) as { seriesId: string; created: number }
      assert.equal(created.created, 4)

      const list = await api().list()
      assert.equal(list.length, 4)
      assert.ok(list.every((entry) => entry.seriesId === created.seriesId))
      assert.ok(list.every((entry) => entry.title === 'Jour fixe'))
      // Die Dauer jedes Termins entspricht dem ersten.
      for (const entry of list)
        assert.equal(Date.parse(entry.endsAt) - Date.parse(entry.startsAt), 3_600_000)
    })

    await t.test('nennt die Regel zu einem Termin', async () => {
      const [first] = await api().list()
      const response = await api().series(first.id)
      assert.equal(response.status, 200)
      const body = (await response.json()) as { rule: RecurrenceRule }
      assert.equal(body.rule.frequency, 'weekly')
      assert.deepEqual(body.rule.ends, { type: 'count', count: 4 })

      assert.equal((await api(stranger).series(first.id)).status, 404)
    })

    await t.test('ein einzelner Termin lässt sich ohne die anderen ändern', async () => {
      const list = await api().list()
      const second = list[1]
      const response = await api().update(second.id, {
        ...base,
        title: 'Nur dieser verschoben',
        startsAt: '2026-11-10T14:00:00.000+01:00',
        endsAt: '2026-11-10T15:00:00.000+01:00',
      })
      assert.equal(response.status, 200)

      const after = await api().list()
      assert.equal(after.length, 4)
      assert.equal(after.filter((entry) => entry.title === 'Jour fixe').length, 3)
      // Er bleibt Teil der Serie.
      assert.ok(after.find((entry) => entry.title === 'Nur dieser verschoben')?.seriesId)
    })

    await t.test('die Serie lässt sich ab einem Termin neu aufsetzen', async () => {
      const list = await api().list()
      const third = list[2]
      const response = await api().update(
        third.id,
        {
          ...base,
          title: 'Neuer Rhythmus',
          startsAt: third.startsAt,
          endsAt: third.endsAt,
          recurrence: rule({ interval: 2, ends: { type: 'count', count: 3 } }),
        },
        'series',
      )
      assert.equal(response.status, 200)

      const after = await api().list()
      // Zwei frühere Termine bleiben, drei neue kommen dazu.
      assert.equal(after.length, 5)
      assert.equal(after.filter((entry) => entry.title === 'Neuer Rhythmus').length, 3)
      assert.ok(
        after.slice(0, 2).every((entry) => entry.title !== 'Neuer Rhythmus'),
        'Vergangene Termine bleiben unangetastet',
      )
    })

    await t.test('löscht diesen und alle folgenden Termine', async () => {
      const list = await api().list()
      const start = list.find((entry) => entry.title === 'Neuer Rhythmus')!
      const response = await api().remove(start.id, 'series')
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { ok: true, removed: 3 })

      const after = await api().list()
      assert.equal(after.length, 2)
      assert.ok(after.every((entry) => entry.title !== 'Neuer Rhythmus'))
    })

    await t.test('fremde Termine und Unfug werden abgewiesen', async () => {
      const [first] = await api().list()
      assert.equal((await api(stranger).remove(first.id, 'series')).status, 404)
      assert.equal((await api(stranger).update(first.id, base, 'series')).status, 404)
      assert.equal((await api().remove('keine-uuid', 'series')).status, 400)
      assert.equal(
        (await api().create({ ...base, recurrence: { frequency: 'jährlich', ends: { type: 'count', count: 2 } } }))
          .status,
        400,
      )
      assert.equal(
        (await api().create({ ...base, recurrence: rule({ ends: { type: 'count', count: 0 } }) })).status,
        400,
      )
      assert.equal((await api().list()).length, 2, 'Keine Abweisung darf etwas anlegen')
    })

    await t.test('ein Einzeltermin bleibt ein Einzeltermin', async () => {
      const response = await api().create({ ...base, title: 'Einmalig' })
      assert.equal(response.status, 201)
      const list = await api().list()
      assert.equal(list.find((entry) => entry.title === 'Einmalig')?.seriesId, null)
      assert.equal((await api().series(list.find((entry) => entry.title === 'Einmalig')!.id)).status, 404)
    })
  } finally {
    await storage.close()
  }
})
