import assert from 'node:assert/strict'
import test from 'node:test'
import { Hono } from 'hono'
import { attachmentsRoute } from '../server/routes/attachments'
import {
  type AttachmentDto,
  MAX_ATTACHMENTS_PER_OBJECT,
  MAX_ATTACHMENT_BYTES,
} from '../src/lib/attachments'
import { postgresStorage } from './support/postgres'

const owner = 'owner',
  stranger = 'stranger'

async function seed(pg: Awaited<ReturnType<typeof postgresStorage>>['pg']) {
  await pg.exec(`
    CREATE TABLE notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,
      title text NOT NULL DEFAULT '',content text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL,
      title text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now());
  `)
  const [note] = (
    await pg.query<{ id: string }>(`INSERT INTO notes(user_id,title) VALUES($1,'Angebot') RETURNING id`, [owner])
  ).rows
  const [foreign] = (
    await pg.query<{ id: string }>(`INSERT INTO notes(user_id,title) VALUES($1,'Fremd') RETURNING id`, [stranger])
  ).rows
  const [task] = (
    await pg.query<{ id: string }>(`INSERT INTO tasks(user_id,title) VALUES($1,'Aufgabe') RETURNING id`, [owner])
  ).rows
  return { note: note.id, foreignNote: foreign.id, task: task.id }
}

function api(userId = owner) {
  const app = new Hono()
  app.use('*', async (c, next) => {
    c.set('userId', userId)
    await next()
  })
  app.route('/attachments', attachmentsRoute)
  return {
    upload: (kind: string, id: string, file: File) => {
      const form = new FormData()
      form.append('file', file)
      return app.request(`/attachments/${kind}/${id}`, { method: 'POST', body: form })
    },
    list: async (kind: string, id: string) => {
      const response = await app.request(`/attachments/${kind}/${id}`)
      assert.equal(response.status, 200)
      return (await response.json()) as AttachmentDto[]
    },
    raw: (kind: string, id: string) => app.request(`/attachments/${kind}/${id}`),
    download: (id: string) => app.request(`/attachments/file/${id}`),
    remove: (id: string) => app.request(`/attachments/${id}`, { method: 'DELETE' }),
    quota: async () => {
      const response = await app.request('/attachments/quota')
      assert.equal(response.status, 200)
      return (await response.json()) as { used: number; limit: number }
    },
  }
}

const textFile = (name: string, content: string, type = 'text/plain') =>
  new File([content], name, { type })

test('Dateianhänge', async (t) => {
  const storage = await postgresStorage()
  try {
    const ids = await seed(storage.pg)

    await t.test('hängt eine Datei an und gibt sie unverändert zurück', async () => {
      const response = await api().upload('note', ids.note, textFile('notiz.txt', 'Hallo Welt'))
      assert.equal(response.status, 201)
      const created = (await response.json()) as AttachmentDto
      assert.equal(created.name, 'notiz.txt')
      assert.equal(created.size, 10)

      const list = await api().list('note', ids.note)
      assert.deepEqual(
        list.map((entry) => entry.name),
        ['notiz.txt'],
      )

      const download = await api().download(created.id)
      assert.equal(download.status, 200)
      assert.equal(await download.text(), 'Hallo Welt')
      assert.match(download.headers.get('content-disposition') ?? '', /attachment; filename="notiz.txt"/)
      assert.equal(download.headers.get('x-content-type-options'), 'nosniff')
    })

    await t.test('ausführbare Inhalte werden nur als Download ausgeliefert', async () => {
      const response = await api().upload(
        'note',
        ids.note,
        textFile('seite.html', '<script>alert(1)</script>', 'text/html'),
      )
      const created = (await response.json()) as AttachmentDto
      assert.equal(created.mime, 'application/octet-stream', 'HTML darf nicht als HTML gespeichert werden')
      const download = await api().download(created.id)
      assert.equal(download.headers.get('content-type'), 'application/octet-stream')
      await api().remove(created.id)
    })

    await t.test('Pfadangaben im Dateinamen werden entschärft', async () => {
      const response = await api().upload(
        'task',
        ids.task,
        textFile('../../etc/passwd', 'x'),
      )
      const created = (await response.json()) as AttachmentDto
      // Schrägstriche werden ersetzt, führende Punkte fallen weg.
      assert.equal(created.name, '_.._etc_passwd')
      await api().remove(created.id)
    })

    await t.test('fremde Objekte und Anhänge bleiben unerreichbar', async () => {
      assert.equal((await api().upload('note', ids.foreignNote, textFile('a.txt', 'x'))).status, 404)
      assert.equal((await api(stranger).upload('note', ids.note, textFile('a.txt', 'x'))).status, 404)
      assert.equal((await api(stranger).raw('note', ids.note)).status, 404)

      const [mine] = await api().list('note', ids.note)
      assert.equal((await api(stranger).download(mine.id)).status, 404)
      assert.equal((await api(stranger).remove(mine.id)).status, 404)
    })

    await t.test('ungültige Angaben werden abgewiesen', async () => {
      assert.equal((await api().raw('passwort', ids.note)).status, 400)
      assert.equal((await api().raw('note', 'keine-uuid')).status, 400)
      assert.equal((await api().download('keine-uuid')).status, 400)
      assert.equal((await api().upload('note', ids.note, textFile('leer.txt', ''))).status, 400)
    })

    await t.test('zu große Dateien werden abgelehnt', async () => {
      const big = new File([new Uint8Array(MAX_ATTACHMENT_BYTES + 1)], 'gross.bin')
      assert.equal((await api().upload('note', ids.note, big)).status, 413)
      assert.equal((await api().list('note', ids.note)).length, 1)
    })

    await t.test('die Zahl der Anhänge je Eintrag ist begrenzt', async () => {
      for (let index = 1; index < MAX_ATTACHMENTS_PER_OBJECT; index += 1)
        assert.equal(
          (await api().upload('note', ids.note, textFile(`datei-${index}.txt`, 'x'))).status,
          201,
        )
      const tooMany = await api().upload('note', ids.note, textFile('einer-zu-viel.txt', 'x'))
      assert.equal(tooMany.status, 409)
      assert.equal((await api().list('note', ids.note)).length, MAX_ATTACHMENTS_PER_OBJECT)
    })

    await t.test('der belegte Platz wird mitgezählt', async () => {
      const quota = await api().quota()
      assert.ok(quota.used > 0)
      assert.ok(quota.limit > quota.used)
    })

    await t.test('mit dem Objekt verschwinden auch seine Anhänge', async () => {
      await api().upload('task', ids.task, textFile('zur-aufgabe.txt', 'Inhalt'))
      const before = await api().quota()
      await storage.pg.query('DELETE FROM tasks WHERE id=$1', [ids.task])
      const after = await api().quota()
      assert.ok(after.used < before.used, 'Der Platz muss wieder frei werden')
      assert.equal((await api().raw('task', ids.task)).status, 404)
    })

    await t.test('ein Anhang lässt sich löschen', async () => {
      const [entry] = await api().list('note', ids.note)
      assert.equal((await api().remove(entry.id)).status, 200)
      assert.equal((await api().remove(entry.id)).status, 404)
      assert.equal((await api().list('note', ids.note)).length, MAX_ATTACHMENTS_PER_OBJECT - 1)
    })
  } finally {
    await storage.close()
  }
})
