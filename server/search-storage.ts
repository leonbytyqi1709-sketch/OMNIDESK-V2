import { and, desc, eq, ilike, or, type SQL } from 'drizzle-orm'
import { db } from '../src/db/client'
import {
  appointments,
  commands,
  contacts,
  links,
  notes,
  projects,
  projectTasks,
  tasks,
} from '../src/db/schema/index'
import {
  SEARCH_PER_KIND,
  type SearchHit,
  type SearchKind,
  snippetAround,
} from '../src/lib/search'

/**
 * Gemeinsame Suche für die Befehlspalette und den Verknüpfen-Dialog.
 *
 * Gesucht wird mit ILIKE über die sprechenden Spalten jeder Art. Volltext mit
 * tsvector wäre schneller, bräuchte aber Indizes auf Tabellen, die nicht zu
 * den additiv angelegten V2-Tabellen gehören; bei den hier üblichen Mengen
 * genügt ILIKE, und die Trefferzahl je Art ist ohnehin begrenzt.
 */

type Searchable = Parameters<typeof ilike>[0]

/** Platzhalter im Suchbegriff dürfen nicht als Muster wirken. */
export function likePattern(term: string) {
  return `%${term.trim().replace(/[%_\\]/g, (character) => `\\${character}`)}%`
}

export interface SearchOptions {
  kinds?: readonly SearchKind[]
  perKind?: number
  /** Ohne Suchbegriff die zuletzt geänderten Einträge liefern (Verknüpfen-Dialog). */
  recentWhenEmpty?: boolean
}

export async function searchModules(
  userId: string,
  rawTerm: string,
  { kinds, perKind = SEARCH_PER_KIND, recentWhenEmpty = false }: SearchOptions = {},
): Promise<SearchHit[]> {
  const term = rawTerm.trim()
  if (!term && !recentWhenEmpty) return []
  const needle = likePattern(term)
  const wanted = (kind: SearchKind) => !kinds || kinds.includes(kind)

  const where = (owner: SQL, ...columns: Searchable[]) =>
    term ? and(owner, or(...columns.map((column) => ilike(column, needle)))) : owner

  const hits: SearchHit[] = []
  const jobs: Array<Promise<void>> = []

  if (wanted('note'))
    jobs.push(
      db
        .select({ id: notes.id, title: notes.title, content: notes.content, updatedAt: notes.updatedAt })
        .from(notes)
        .where(where(eq(notes.userId, userId), notes.title, notes.content))
        .orderBy(desc(notes.updatedAt))
        .limit(perKind)
        .then((rows) => {
          for (const row of rows)
            hits.push({
              kind: 'note',
              id: row.id,
              title: row.title.trim() || 'Unbenannte Notiz',
              detail: `Zuletzt geändert ${row.updatedAt.toLocaleDateString('de-DE')}`,
              snippet: snippetAround(row.content, term),
              path: `/notes?note=${row.id}`,
            })
        }),
    )

  if (wanted('task'))
    jobs.push(
      db
        .select({
          id: tasks.id,
          title: tasks.title,
          description: tasks.description,
          status: tasks.status,
          dueDate: tasks.dueDate,
        })
        .from(tasks)
        .where(where(eq(tasks.userId, userId), tasks.title, tasks.description))
        .orderBy(desc(tasks.updatedAt))
        .limit(perKind)
        .then((rows) => {
          for (const row of rows)
            hits.push({
              kind: 'task',
              id: row.id,
              title: row.title,
              detail: row.dueDate
                ? `Fällig ${row.dueDate.toLocaleDateString('de-DE')}`
                : row.status === 'done'
                  ? 'Erledigt'
                  : 'Offen',
              snippet: snippetAround(row.description, term),
              path: `/tasks?task=${row.id}`,
            })
        }),
    )

  if (wanted('appointment'))
    jobs.push(
      db
        .select({
          id: appointments.id,
          title: appointments.title,
          description: appointments.description,
          location: appointments.location,
          startsAt: appointments.startsAt,
        })
        .from(appointments)
        .where(
          where(
            eq(appointments.userId, userId),
            appointments.title,
            appointments.description,
            appointments.location,
          ),
        )
        .orderBy(desc(appointments.startsAt))
        .limit(perKind)
        .then((rows) => {
          for (const row of rows)
            hits.push({
              kind: 'appointment',
              id: row.id,
              title: row.title,
              detail: row.startsAt.toLocaleString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
              snippet: snippetAround(row.location || row.description, term),
              path: `/calendar?appointment=${row.id}`,
            })
        }),
    )

  if (wanted('contact'))
    jobs.push(
      db
        .select({
          id: contacts.id,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          company: contacts.company,
          email: contacts.email,
          notes: contacts.notes,
        })
        .from(contacts)
        .where(
          where(
            eq(contacts.userId, userId),
            contacts.firstName,
            contacts.lastName,
            contacts.company,
            contacts.email,
            contacts.notes,
          ),
        )
        .orderBy(desc(contacts.updatedAt))
        .limit(perKind)
        .then((rows) => {
          for (const row of rows)
            hits.push({
              kind: 'contact',
              id: row.id,
              title: `${row.firstName} ${row.lastName}`.trim() || row.email || 'Ohne Namen',
              detail: row.company || row.email,
              snippet: snippetAround(row.notes, term),
              path: `/contacts?contact=${row.id}`,
            })
        }),
    )

  if (wanted('project'))
    jobs.push(
      db
        .select({
          id: projects.id,
          name: projects.name,
          description: projects.description,
          status: projects.status,
        })
        .from(projects)
        .where(where(eq(projects.userId, userId), projects.name, projects.description))
        .orderBy(desc(projects.updatedAt))
        .limit(perKind)
        .then((rows) => {
          for (const row of rows)
            hits.push({
              kind: 'project',
              id: row.id,
              title: row.name,
              detail: `Status: ${row.status}`,
              snippet: snippetAround(row.description, term),
              path: `/projects?project=${row.id}`,
            })
        }),
    )

  if (wanted('projectTask'))
    jobs.push(
      db
        .select({
          id: projectTasks.id,
          title: projectTasks.title,
          description: projectTasks.description,
          status: projectTasks.status,
          projectId: projectTasks.projectId,
          projectName: projects.name,
        })
        .from(projectTasks)
        .innerJoin(projects, eq(projects.id, projectTasks.projectId))
        .where(
          where(eq(projectTasks.userId, userId), projectTasks.title, projectTasks.description),
        )
        .orderBy(desc(projectTasks.updatedAt))
        .limit(perKind)
        .then((rows) => {
          for (const row of rows)
            hits.push({
              kind: 'projectTask',
              id: row.id,
              title: row.title,
              detail: `${row.projectName} · ${row.status}`,
              snippet: snippetAround(row.description, term),
              path: `/projects?project=${row.projectId}`,
            })
        }),
    )

  if (wanted('link'))
    jobs.push(
      db
        .select({ id: links.id, title: links.title, url: links.url, category: links.category })
        .from(links)
        .where(where(eq(links.userId, userId), links.title, links.url, links.category))
        .orderBy(desc(links.updatedAt))
        .limit(perKind)
        .then((rows) => {
          for (const row of rows)
            hits.push({
              kind: 'link',
              id: row.id,
              title: row.title,
              detail: row.category ?? '',
              snippet: row.url,
              path: '/links',
            })
        }),
    )

  if (wanted('command'))
    jobs.push(
      db
        .select({
          id: commands.id,
          title: commands.title,
          command: commands.command,
          category: commands.category,
        })
        .from(commands)
        .where(where(eq(commands.userId, userId), commands.title, commands.command, commands.category))
        .orderBy(desc(commands.updatedAt))
        .limit(perKind)
        .then((rows) => {
          for (const row of rows)
            hits.push({
              kind: 'command',
              id: row.id,
              title: row.title,
              detail: row.category,
              snippet: row.command,
              path: '/commands',
            })
        }),
    )

  await Promise.all(jobs)

  // Titeltreffer zuerst: Wer „Angebot“ sucht, will die Notiz „Angebot“ sehen
  // und nicht die, in deren Text das Wort irgendwo vorkommt.
  const lowered = term.toLowerCase()
  return term
    ? hits.sort((one, other) => rank(one, lowered) - rank(other, lowered))
    : hits
}

const rank = (hit: SearchHit, term: string) => (hit.title.toLowerCase().includes(term) ? 0 : 1)
