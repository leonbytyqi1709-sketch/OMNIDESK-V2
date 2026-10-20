import { randomUUID } from 'node:crypto'
import {
  dueDateToIso,
  localTimeToIso,
  OmniActionError,
  type OmniOperation,
  type StoredOperation,
} from './omni-actions-policy'
import type { OmniContext } from './omni-actions-context'
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
  note: 'Ergänzung zur Projektbeschreibung',
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
    const targetKey = `${op.kind.includes('project_task') ? 'project-task' : op.kind === 'append_project_note' ? 'project' : 'task'}:${id}`
    if (targets.has(targetKey))
      throw new OmniActionError(
        'Ein Eintrag würde mehrfach geändert. Bitte die Änderungen in einem Schritt zusammenfassen.',
      )
    targets.add(targetKey)
    const changes = Object.entries(after)
      .filter(
        ([key]) => key !== 'description' || op.kind !== 'append_project_note',
      )
      .filter(
        ([key, value]) =>
          !before ||
          key === 'note' ||
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
          before && key !== 'note' ? display(key, before[key], timeZone) : null,
        after: display(key, value, timeZone),
      })),
      warning,
    })
    results.push({ title: target, href })
  }
  return { stored, previews, results }
}
