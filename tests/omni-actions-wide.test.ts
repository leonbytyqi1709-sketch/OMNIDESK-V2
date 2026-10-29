import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { loadOmniContext, publicOmniContext } from '../server/omni-actions-context'
import { OmniActionError, type OmniOperation } from '../server/omni-actions-policy'
import { prepareOmniOperations } from '../server/omni-actions-prepare'
import {
  executeOmniPlan,
  initializeOmniActions,
  saveOmniPlan,
} from '../server/omni-actions-storage'
import { postgresStorage } from './support/postgres'

/**
 * Seit dem 29.10.2026 reicht Omni über Aufgaben und Projekte hinaus: Notizen,
 * Termine, Kontakte und Verknüpfungen kommen dazu. Vorgeschlagen wird weiter
 * nur; geschrieben wird erst nach Bestätigung, und zwar alles oder nichts.
 */

const zone = 'Europe/Berlin'
const schema = `
 CREATE TABLE notes(id uuid PRIMARY KEY,user_id text NOT NULL,title text NOT NULL DEFAULT 'Unbenannte Notiz',content text NOT NULL DEFAULT '',updated_at timestamptz DEFAULT now());
 CREATE TABLE projects(id uuid PRIMARY KEY,user_id text NOT NULL,name text NOT NULL,description text NOT NULL DEFAULT '',priority text DEFAULT 'medium',status text DEFAULT 'active',updated_at timestamptz DEFAULT now());
 CREATE TABLE tasks(id uuid PRIMARY KEY,user_id text NOT NULL,title text NOT NULL,description text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'todo',priority text NOT NULL DEFAULT 'medium',due_date timestamptz,tags jsonb DEFAULT '[]',subtasks jsonb DEFAULT '[]',updated_at timestamptz DEFAULT now());
 CREATE TABLE project_tasks(id uuid PRIMARY KEY,user_id text NOT NULL,project_id uuid REFERENCES projects(id),title text NOT NULL,description text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'backlog',priority text NOT NULL DEFAULT 'medium',updated_at timestamptz DEFAULT now());
 CREATE TABLE appointments(id uuid PRIMARY KEY,user_id text NOT NULL,title text NOT NULL,description text NOT NULL DEFAULT '',location text NOT NULL DEFAULT '',priority text NOT NULL DEFAULT 'medium',starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,updated_at timestamptz DEFAULT now());
 CREATE TABLE contacts(id uuid PRIMARY KEY,user_id text NOT NULL,first_name text NOT NULL,last_name text NOT NULL DEFAULT '',email text NOT NULL DEFAULT '',phone text NOT NULL DEFAULT '',company text NOT NULL DEFAULT '',notes text NOT NULL DEFAULT '',updated_at timestamptz DEFAULT now());`

test('Omni über alle Module', async (t) => {
  const storage = await postgresStorage(),
    { pg } = storage
  const noteId = randomUUID(),
    foreignNote = randomUUID(),
    appointmentId = randomUUID(),
    projectId = randomUUID()

  try {
    await pg.exec(schema)
    await pg.query(
      `INSERT INTO notes(id,user_id,title,content) VALUES($1,'owner','Angebot Mustermann','Erste Zeile'),($2,'fremd','Fremde Notiz','Geheim')`,
      [noteId, foreignNote],
    )
    await pg.query(`INSERT INTO projects(id,user_id,name) VALUES($1,'owner','Rechenzentrum')`, [
      projectId,
    ])
    await pg.query(
      `INSERT INTO appointments(id,user_id,title,location,starts_at,ends_at)
       VALUES($1,'owner','Besprechung','Büro','2026-11-02T09:00:00+01','2026-11-02T10:00:00+01')`,
      [appointmentId],
    )
    await initializeOmniActions()
    const context = await loadOmniContext('owner')

    const run = async (operations: OmniOperation[]) => {
      const plan = await saveOmniPlan(
        'owner',
        randomUUID(),
        'Expliziter Auftrag',
        zone,
        prepareOmniOperations(operations, context, zone),
      )
      return executeOmniPlan('owner', plan.id)
    }

    await t.test('der Kontext kennt Notizen, Termine und Kontakte – ohne Fremdes', () => {
      assert.equal(context.notes.length, 1)
      assert.equal(context.notes[0].title, 'Angebot Mustermann')
      assert.equal(context.appointments.length, 1)
      assert.equal(context.contacts.length, 0)
      const shown = JSON.stringify(publicOmniContext(context))
      assert.ok(!shown.includes('Geheim'), 'Fremde Inhalte dürfen nicht auftauchen')
      // Notizinhalte werden für Konfliktprüfungen gebraucht, nicht fürs Modell.
      assert.ok(!shown.includes('Erste Zeile'))
      assert.ok(JSON.stringify(context).includes('Erste Zeile'))
    })

    await t.test('legt eine Notiz an und hängt an eine vorhandene an', async () => {
      await run([{ kind: 'create_note', title: 'Von Omni', content: '# Überschrift' }])
      const created = await pg.query<{ title: string; content: string }>(
        `SELECT title,content FROM notes WHERE user_id='owner' AND title='Von Omni'`,
      )
      assert.equal(created.rows[0].content, '# Überschrift')

      await run([{ kind: 'append_note', noteId, text: 'Zweite Zeile' }])
      const appended = await pg.query<{ content: string }>(
        `SELECT content FROM notes WHERE id=$1`,
        [noteId],
      )
      assert.equal(appended.rows[0].content, 'Erste Zeile\n\nZweite Zeile')
    })

    await t.test('die Vorschau zeigt nur die Ergänzung, nicht den ganzen Inhalt', () => {
      const prepared = prepareOmniOperations(
        [{ kind: 'append_note', noteId, text: 'Noch eine Zeile' }],
        context,
        zone,
      )
      const [preview] = prepared.previews
      assert.equal(preview.changes.length, 1)
      assert.equal(preview.changes[0].after, 'Noch eine Zeile')
      assert.equal(preview.changes[0].before, null)
      assert.match(preview.warning ?? '', /angehängt/)
    })

    await t.test('verschiebt einen Termin und behält unveränderte Felder', async () => {
      await run([
        {
          kind: 'update_appointment',
          appointmentId,
          changes: { startLocal: '2026-11-03T14:00', endLocal: '2026-11-03T15:30' },
        },
      ])
      const [row] = (
        await pg.query<{ location: string; starts_at: string; ends_at: string }>(
          `SELECT location,starts_at,ends_at FROM appointments WHERE id=$1`,
          [appointmentId],
        )
      ).rows
      assert.equal(row.location, 'Büro', 'Der Ort war nicht Teil des Auftrags')
      assert.equal(new Date(row.starts_at).toISOString(), '2026-11-03T13:00:00.000Z')
      assert.equal(
        new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime(),
        90 * 60_000,
      )
    })

    await t.test('ein Terminende vor dem Beginn wird abgelehnt', () => {
      assert.throws(
        () =>
          prepareOmniOperations(
            [
              {
                kind: 'update_appointment',
                appointmentId,
                changes: { startLocal: '2026-11-03T16:00', endLocal: '2026-11-03T15:00' },
              },
            ],
            context,
            zone,
          ),
        OmniActionError,
      )
    })

    await t.test('legt einen Kontakt an', async () => {
      await run([
        {
          kind: 'create_contact',
          firstName: 'Erika',
          lastName: 'Mustermann',
          email: 'erika@example.com',
          phone: '',
          company: 'Mustermann GmbH',
        },
      ])
      const [row] = (
        await pg.query<{ first_name: string; company: string; phone: string }>(
          `SELECT first_name,company,phone FROM contacts WHERE user_id='owner'`,
        )
      ).rows
      assert.equal(row.first_name, 'Erika')
      assert.equal(row.company, 'Mustermann GmbH')
      assert.equal(row.phone, '')
    })

    await t.test('verknüpft zwei Einträge in fester Reihenfolge', async () => {
      await run([
        {
          kind: 'link_objects',
          source: { kind: 'project', id: projectId },
          target: { kind: 'note', id: noteId },
        },
      ])
      const [row] = (
        await pg.query<{ a_kind: string; a_id: string; b_kind: string }>(
          `SELECT a_kind,a_id,b_kind FROM v2_connections WHERE user_id='owner'`,
        )
      ).rows
      // „note:…“ steht alphabetisch vor „project:…“, die Reihenfolge ist fest.
      assert.equal(row.a_kind, 'note')
      assert.equal(row.a_id, noteId)
      assert.equal(row.b_kind, 'project')
    })

    await t.test('fremde und unsinnige Ziele kommen nicht durch', () => {
      for (const operation of [
        { kind: 'append_note', noteId: foreignNote, text: 'x' },
        { kind: 'append_note', noteId: randomUUID(), text: 'x' },
        { kind: 'update_appointment', appointmentId: randomUUID(), changes: { title: 'x' } },
        {
          kind: 'link_objects',
          source: { kind: 'note', id: noteId },
          target: { kind: 'note', id: foreignNote },
        },
        {
          kind: 'link_objects',
          source: { kind: 'note', id: noteId },
          target: { kind: 'note', id: noteId },
        },
      ] as OmniOperation[])
        assert.throws(
          () => prepareOmniOperations([operation], context, zone),
          OmniActionError,
          `Nicht abgewiesen: ${operation.kind}`,
        )
    })

    await t.test('eine inzwischen geänderte Notiz lässt den Vorschlag scheitern', async () => {
      const prepared = prepareOmniOperations(
        [{ kind: 'append_note', noteId, text: 'Zu spät' }],
        context,
        zone,
      )
      const plan = await saveOmniPlan('owner', randomUUID(), 'Auftrag', zone, prepared)
      await pg.query(`UPDATE notes SET content=content||' (geändert)' WHERE id=$1`, [noteId])
      await assert.rejects(() => executeOmniPlan('owner', plan.id), /geändert oder entfernt/)
      const [row] = (
        await pg.query<{ content: string }>(`SELECT content FROM notes WHERE id=$1`, [noteId])
      ).rows
      assert.ok(!row.content.includes('Zu spät'), 'Nichts darf geschrieben worden sein')
    })
  } finally {
    await storage.close()
  }
})
