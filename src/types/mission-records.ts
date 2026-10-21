import type { HistoryKind } from './working-history'
export interface MissionReference {
  kind: HistoryKind
  id: string
  title: string | null
  projectId: string | null
  available: boolean
}
export interface MissionRecordInput {
  title: string
  projectId: string | null
  state: 'active' | 'paused' | 'archived'
  context: string
  decisions: string
  outcome: string
  questions: string
  nextSteps: string
  sources: { kind: HistoryKind; id: string }[]
}
export interface MissionRecord extends Omit<MissionRecordInput, 'sources'> {
  id: string
  version: number
  projectName: string | null
  sources: MissionReference[]
  updatedAt: string
  archivedAt: string | null
}
export interface MissionRecordSummary {
  id: string
  title: string
  state: MissionRecordInput['state']
  projectName: string | null
  updatedAt: string
  archivedAt: string | null
}
