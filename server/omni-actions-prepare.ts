import { randomUUID } from 'node:crypto'
import {
  dueDateToIso,
  localTimeToIso,
  OmniActionError,
  type OmniOperation,
  type StoredOperation,
} from './omni-actions-policy'
import type { OmniContext } from './omni-actions-context'
import { orderEnds } from '../src/lib/connections'
import type {
  OmniActionPreview,
  OmniActionResult,
} from '../src/types/omni-actions'
const labels: Record<string, string> = {
  title: 'Titel',
  description: 'Beschreibung',
  priority: 'Priorität',
  status: 'Status',
  dueDate: 'Fällig am',
  location: 'Ort',
  startsAt: 'Beginn',
  endsAt: 'Ende',
  note: 'Ergänzung',
  content: 'Inhalt',
  firstName: 'Vorname',
  lastName: 'Nachname',
  email: 'E-Mail',
  phone: 'Telefon',
  company: 'Firma',
  link: 'Verknüpfung',
}

/** Art des betroffenen Eintrags – für die Dopplungsprüfung innerhalb eines Vorschlags. */
const TARGET_TYPE: Record<OmniOperation['kind'], string> = {
  create_task: 'task',
  update_task: 'task',
  create_project_task: 'project-task',
  update_project_task: 'project-task',
  append_project_note: 'project',
  create_appointment: 'appointment',
  update_appointment: 'appointment',
  create_note: 'note',
  append_note: 'note',
  create_contact: 'contact',
  link_objects: 'connection',
}

const CONNECTION_LABELS: Record<string, string> = {
  note: 'Notiz',
  task: 'Aufgabe',
  appointment: 'Termin',
  contact: 'Kontakt',
  project: 'Projekt',
}
const values: Record<string, string> = {
  high: 'Hoch',
  medium: 'Mittel',
  low: 'Niedrig',
  todo: 'Offen',
  in_progress: 'In Arbeit',
  done: 'Erledigt',
  backlog: 'Backlog',
}
function display(key: string, value: unknown, timeZone: string) {
  if (value == null) return 'Nicht festgelegt'
  if ((key === 'dueDate' || key === 'startsAt' || key === 'endsAt') && value)
    return new Date(String(value)).toLocaleString(
      'de-DE',
      key === 'dueDate'
        ? { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }
        : { timeZone },
    )
  return key === 'status' || key === 'priority'
    ? (values[String(value)] ?? String(value))
    : String(value)
}
export function prepareOmniOperations(
  operations: OmniOperation[],
  context: OmniContext,
  timeZone: string,
) {
  const stored: StoredOperation[] = [],
    previews: OmniActionPreview[] = [],
    results: OmniActionResult[] = [],
    targets = new Set<string>()
  for (const op of operations) {
    let before: Record<string, unknown> | null = null,
      after: Record<string, unknown> = {},
      id = randomUUID() as string,
      projectId: string | undefined,
      projectVersion: string | undefined,
      target = '',
      href = '',
      warning: string | undefined
    if (op.kind === 'create_task') {
      const { kind: _kind, dueDate, ...fields } = op
      after = { ...fields, dueDate: dueDateToIso(dueDate, timeZone) }
      target = op.title
      href = `/tasks?task=${id}`
    }
    if (op.kind === 'update_task') {
      const task = context.tasks.find((t) => t.id === op.taskId)
      if (!task)
        throw new OmniActionError(
          'Die gewählte persönliche Aufgabe ist nicht in deinen verfügbaren Quellen. Bitte genauer auswählen.',
        )
      before = { ...task }
      id = task.id
      after = {
        ...op.changes,
        ...('dueDate' in op.changes
          ? { dueDate: dueDateToIso(op.changes.dueDate ?? null, timeZone) }
          : {}),
      }
      target = task.title
      href = `/tasks?task=${id}`
    }
    if (
      op.kind === 'create_project_task' ||
      op.kind === 'append_project_note'
    ) {
      const project = context.projects.find((p) => p.id === op.projectId)
      if (!project)
        throw new OmniActionError(
          'Das gewählte Projekt ist nicht in deinen verfügbaren Quellen. Bitte genauer auswählen.',
        )
      projectId = project.id
      projectVersion = project.version
      if (op.kind === 'create_project_task') {
        after = { title: op.title, status: op.status, priority: op.priority }
        target = `${project.name} · ${op.title}`
        href = `/projects?project=${project.id}#project-task-${id}`
        warning =
          'Projektaufgabe ohne Fälligkeit: Das bestehende Board besitzt kein Datumsfeld.'
      } else {
        before = { ...project }
        id = project.id
        after = {
          note: op.text,
          description:
            project.description + (project.description ? '\n\n' : '') + op.text,
        }
        if (String(after.description).length > 10000)
          throw new OmniActionError(
            'Die ergänzte Projektbeschreibung wäre zu lang. Bitte kürzen.',
          )
        target = project.name
        href = `/projects?project=${project.id}`
        warning =
          'Die Notiz wird unten an die vorhandene Projektbeschreibung angehängt.'
      }
    }
    if (op.kind === 'update_project_task') {
      const task = context.projectTasks.find((t) => t.id === op.taskId)
      if (!task)
        throw new OmniActionError(
          'Die gewählte Projektaufgabe ist nicht in deinen verfügbaren Quellen. Bitte genauer auswählen.',
        )
      before = { ...task }
      id = task.id
      projectId = task.projectId
      after = { ...op.changes }
      target = `${context.projects.find((p) => p.id === task.projectId)?.name ?? 'Projekt'} · ${task.title}`
      href = `/projects?project=${task.projectId}#project-task-${id}`
    }
    if (op.kind === 'create_appointment') {
      const startsAt = localTimeToIso(op.startLocal, timeZone),
        endsAt = localTimeToIso(op.endLocal, timeZone)
      if (endsAt <= startsAt)
        throw new OmniActionError('Das Terminende muss nach dem Beginn liegen.')
      after = {
        title: op.title,
        description: op.description,
        location: op.location,
        priority: op.priority,
        startsAt,
        endsAt,
      }
      target = op.title
      href = `/calendar?appointment=${id}`
      warning =
        'Interner Kalendertermin. Es werden keine Einladungen versendet; zeitliche Überschneidungen sind möglich.'
    }
    if (op.kind === 'update_appointment') {
      const appointment = context.appointments.find((a) => a.id === op.appointmentId)
      if (!appointment)
        throw new OmniActionError(
          'Der gewählte Termin ist nicht in deinen verfügbaren Quellen. Bitte genauer auswählen.',
        )
      before = { ...appointment }
      id = appointment.id
      const { startLocal, endLocal, ...rest } = op.changes
      after = { ...rest }
      if (startLocal && endLocal) {
        const startsAt = localTimeToIso(startLocal, timeZone),
          endsAt = localTimeToIso(endLocal, timeZone)
        if (endsAt <= startsAt)
          throw new OmniActionError('Das Terminende muss nach dem Beginn liegen.')
        after = { ...after, startsAt, endsAt }
      }
      target = appointment.title
      href = `/calendar?appointment=${id}`
    }
    if (op.kind === 'create_note') {
      after = { title: op.title, content: op.content }
      target = op.title
      href = `/notes?note=${id}`
    }
    if (op.kind === 'append_note') {
      const note = context.notes.find((n) => n.id === op.noteId)
      if (!note)
        throw new OmniActionError(
          'Die gewählte Notiz ist nicht in deinen verfügbaren Quellen. Bitte genauer auswählen.',
        )
      before = { ...note }
      id = note.id
      const content = note.content + (note.content ? '\n\n' : '') + op.text
      if (content.length > 20000)
        throw new OmniActionError('Die ergänzte Notiz wäre zu lang. Bitte kürzen.')
      after = { note: op.text, content }
      target = note.title || 'Unbenannte Notiz'
      href = `/notes?note=${id}`
      warning = 'Der Text wird unten an die vorhandene Notiz angehängt.'
    }
    if (op.kind === 'create_contact') {
      const { kind: _kind, ...fields } = op
      after = { ...fields }
      target = `${op.firstName} ${op.lastName}`.trim()
      href = `/contacts?contact=${id}`
    }
    if (op.kind === 'link_objects') {
      const name = (end: { kind: string; id: string }) => {
        const found =
          end.kind === 'note'
            ? context.notes.find((entry) => entry.id === end.id)?.title
            : end.kind === 'task'
              ? context.tasks.find((entry) => entry.id === end.id)?.title
              : end.kind === 'appointment'
                ? context.appointments.find((entry) => entry.id === end.id)?.title
                : end.kind === 'contact'
                  ? context.contacts.find((entry) => entry.id === end.id)?.name
                  : context.projects.find((entry) => entry.id === end.id)?.name
        if (!found)
          throw new OmniActionError(
            'Ein Ende der Verknüpfung ist nicht in deinen verfügbaren Quellen. Bitte genauer auswählen.',
          )
        return `${CONNECTION_LABELS[end.kind] ?? end.kind} „${found || 'Ohne Titel'}“`
      }
      if (op.source.kind === op.target.kind && op.source.id === op.target.id)
        throw new OmniActionError('Ein Eintrag lässt sich nicht mit sich selbst verknüpfen.')
      const label = `${name(op.source)} ↔ ${name(op.target)}`
      // Feste Reihenfolge wie in der Verknüpfungs-Ebene, damit dieselbe
      // Verbindung nicht ein zweites Mal entsteht.
      const [first, second] = orderEnds(op.source, op.target)
      after = {
        link: label,
        aKind: first.kind,
        aId: first.id,
        bKind: second.kind,
        bId: second.id,
      }
      target = label
      href = `/${op.source.kind === 'project' ? 'projects' : op.source.kind === 'note' ? 'notes' : op.source.kind === 'task' ? 'tasks' : op.source.kind === 'appointment' ? 'calendar' : 'contacts'}`
      warning = 'Verknüpfungen sind gegenseitig und von beiden Seiten sichtbar.'
    }
    const targetKey = `${TARGET_TYPE[op.kind]}:${id}`
    if (targets.has(targetKey))
      throw new OmniActionError(
        'Ein Eintrag würde mehrfach geändert. Bitte die Änderungen in einem Schritt zusammenfassen.',
      )
    targets.add(targetKey)
    const changes = Object.entries(after)
      .filter(
        ([key]) =>
          !(key === 'description' && op.kind === 'append_project_note') &&
          !(key === 'content' && op.kind === 'append_note') &&
          !(op.kind === 'link_objects' && key !== 'link'),
      )
      .filter(
        ([key, value]) =>
          !before ||
          key === 'note' ||
          key === 'link' ||
          String(before[key] ?? '') !== String(value ?? ''),
      )
    if (!changes.length)
      throw new OmniActionError(
        'Dieser Vorschlag enthält keine Änderung am aktuellen Eintrag.',
      )
    stored.push({
      kind: op.kind,
      id,
      projectId,
      projectVersion,
      before: before ? { version: before.version } : null,
      after,
    })
    previews.push({
      kind: op.kind,
      target,
      href: op.kind.startsWith('create_') ? null : href,
      changes: changes.map(([key, value]) => ({
        label: labels[key] ?? key,
        before:
          before && key !== 'note' && key !== 'link'
            ? display(key, before[key], timeZone)
            : null,
        after: display(key, value, timeZone),
      })),
      warning,
    })
    results.push({ title: target, href })
  }
  return { stored, previews, results }
}
