import type {
  HistoryEntry,
  HistoryField,
  HistoryKind,
} from '@/types/working-history'
export const kindLabels: Record<HistoryKind, string> = {
  note: 'Notizen',
  task: 'Persönliche Aufgaben',
  project_task: 'Projektaufgaben',
}
export const fieldLabels: Record<HistoryField, string> = {
  title: 'Titel',
  content: 'Notiztext',
  description: 'Beschreibung',
  status: 'Status',
  priority: 'Priorität',
  dueDate: 'Fälligkeit',
  tags: 'Tags',
  subtasks: 'Unteraufgaben',
}
export const fieldsByKind: Record<HistoryKind, HistoryField[]> = {
  note: ['title', 'content'],
  task: [
    'title',
    'description',
    'status',
    'priority',
    'dueDate',
    'tags',
    'subtasks',
  ],
  project_task: ['title', 'status', 'priority'],
}
export const date = (s: string) =>
  new Date(s).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })
export const operationLabel: Record<HistoryEntry['operation'], string> = {
  baseline: 'Ausgangsstand bei Aufzeichnungsbeginn',
  created: 'Angelegt',
  updated: 'Geändert',
  restored: 'Wiederhergestellt',
}
export function sourceHref(
  kind: HistoryKind,
  id: string,
  projectId: string | null,
) {
  return kind === 'note'
    ? '/notes?note=' + id
    : kind === 'task'
      ? '/tasks?task=' + id
      : '/projects?project=' + projectId + '#project-task-' + id
}
export function fieldText(field: HistoryField, value: unknown): string {
  if (value == null || value === '') return 'Leer'
  if (field === 'dueDate' && typeof value === 'string')
    return date(value) + ' (Berlin)'
  if (field === 'tags' && Array.isArray(value))
    return value.join(', ') || 'Keine Tags'
  if (field === 'subtasks' && Array.isArray(value))
    return (
      value.map((v) => (v.done ? '☑ ' : '☐ ') + v.title).join('\n') ||
      'Keine Unteraufgaben'
    )
  if (field === 'status')
    return (
      (
        {
          todo: 'Offen',
          in_progress: 'In Arbeit',
          done: 'Erledigt',
          backlog: 'Backlog',
        } as Record<string, string>
      )[String(value)] ?? String(value)
    )
  if (field === 'priority')
    return (
      (
        { high: 'Hoch', medium: 'Mittel', low: 'Niedrig' } as Record<
          string,
          string
        >
      )[String(value)] ?? String(value)
    )
  return typeof value === 'string' ? value : JSON.stringify(value)
}

export const recordTextLabels = {
  context: 'Ausgangslage und letzter Arbeitsstand',
  decisions: 'Entscheidungen und Begründungen',
  questions: 'Offene Fragen',
  nextSteps: 'Nächste Schritte',
  outcome: 'Ergebnis und Nacharbeiten',
}
export const recordStateLabels = {
  active: 'In Arbeit',
  paused: 'Unterbrochen',
  archived: 'Abgeschlossen / Archiv',
}
