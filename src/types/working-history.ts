export type HistoryKind = 'note' | 'task' | 'project_task'
export type HistoryField =
  | 'title'
  | 'content'
  | 'description'
  | 'status'
  | 'priority'
  | 'dueDate'
  | 'tags'
  | 'subtasks'
export interface HistorySettings {
  enabled: boolean
  retentionDays: number
  maxVersions: number
}
export interface HistoryEntry {
  id: string
  kind: HistoryKind
  objectId: string
  title: string
  revision: number
  operation: 'baseline' | 'created' | 'updated' | 'restored'
  source: 'module' | 'omni' | 'restore'
  capturedAt: string
  projectId: string | null
}
export interface HistoryObject {
  fingerprint: string
  snapshot: Record<string, unknown>
  projectId: string | null
}
export interface HistoryDetail {
  current: HistoryObject
  versions: HistoryEntry[]
}
export interface HistoryComparison {
  current: HistoryObject
  version: HistoryEntry
  snapshot: Record<string, unknown>
}
