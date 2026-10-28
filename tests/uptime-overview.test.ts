import assert from 'node:assert/strict'
import test from 'node:test'
import { Hono } from 'hono'
import { uptimeRoute } from '../server/routes/uptime'
import { postgresStorage } from './support/postgres'

const ownMonitor = 'a1111111-1111-4111-8111-111111111111',
  foreignMonitor = 'b2222222-2222-4222-8222-222222222222'

/**
 * Die Übersicht darf ausschließlich die Messungen der eigenen Monitore laden.
 * Früher las sie sämtliche Messungen der letzten 30 Tage und verwarf den
 * Großteil anschließend wieder – bei minütlichen Prüfungen über Monate
 * entsprach das zehntausenden Zeilen je Seitenaufruf.
 */
test('uptime overview reads only the own monitors and their checks', async () => {
  const storage = await postgresStorage()
  const statements: string[] = []
  const query = storage.pg.query.bind(storage.pg)
  // Die Brücke zum Produktionstreiber ruft pg.query auf; so wird jede
  // tatsächlich ausgeführte Anweisung sichtbar.
  storage.pg.query = ((sql: string, params?: unknown[]) => {
    statements.push(sql)
    return query(sql, params as never)
  }) as typeof storage.pg.query

  try {
    await storage.pg.exec(
      "CREATE TABLE uptime_monitors(id uuid PRIMARY KEY,user_id text NOT NULL,name text NOT NULL,type text NOT NULL DEFAULT 'http',url text NOT NULL,port integer,expected_status integer NOT NULL DEFAULT 200,timeout_ms integer NOT NULL DEFAULT 10000,active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now())",
    )
    await storage.pg.exec(
      'CREATE TABLE uptime_checks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),monitor_id uuid NOT NULL REFERENCES uptime_monitors(id) ON DELETE CASCADE,status text NOT NULL,response_time_ms integer,status_code integer,ssl_days_left integer,error text,checked_at timestamptz NOT NULL DEFAULT now())',
    )
    await storage.pg.query(
      'INSERT INTO uptime_monitors(id,user_id,name,url) VALUES($1,$2,$3,$4),($5,$6,$7,$8)',
      [
        ownMonitor,
        'owner',
        'Eigener Dienst',
        'https://example.com',
        foreignMonitor,
        'other',
        'Fremder Dienst',
        'https://fremd.example.com',
      ],
    )
    // Eine frische eigene Messung verhindert, dass die Übersicht echte
    // Netzprüfungen auslöst. Der fremde Monitor bekommt mehr Messungen, damit
    // ein versehentliches Mitlesen auffallen würde.
    await storage.pg.query(
      "INSERT INTO uptime_checks(monitor_id,status,response_time_ms,checked_at) VALUES($1,'up',120,now()-interval '1 minute')",
      [ownMonitor],
    )
    for (let i = 0; i < 5; i++)
      await storage.pg.query(
        "INSERT INTO uptime_checks(monitor_id,status,response_time_ms,checked_at) VALUES($1,'down',900,now()-interval '2 minutes')",
        [foreignMonitor],
      )

    const app = new Hono()
    app.use('*', async (c, next) => {
      c.set('userId', 'owner')
      await next()
    })
    app.route('/uptime', uptimeRoute)

    statements.length = 0
    const response = await app.request('/uptime')
    assert.equal(response.status, 200)
    const rows = (await response.json()) as Array<{
      id: string
      totalChecks: number
      uptime30d: number
    }>

    assert.deepEqual(
      rows.map((row) => row.id),
      [ownMonitor],
    )
    assert.equal(rows[0].totalChecks, 1)
    assert.equal(rows[0].uptime30d, 100)

    const checkQueries = statements.filter((sql) =>
      /from\s+"?uptime_checks"?/i.test(sql),
    )
    assert.ok(checkQueries.length > 0, 'Messungen wurden gar nicht gelesen')
    for (const sql of checkQueries) {
      // Die Spalte steht ohnehin in der Auswahl; entscheidend ist die
      // Einschränkung hinter WHERE.
      const condition = sql.split(/ where /i)[1] ?? ''
      assert.match(
        condition,
        /monitor_id/i,
        'Messungen wurden ohne Eingrenzung auf eigene Monitore gelesen',
      )
    }
  } finally {
    storage.pg.query = query
    await storage.close()
  }
})
