import type { GitHubSnapshot } from './github'
import type { DeploymentSnapshot } from './deployments'
import type { NeonMonitoringState, NeonSnapshot } from './neon-monitoring'

export interface MissionSource<T> {
  state: 'ready' | 'missing' | 'error'
  message: string
  data: T | null
}
export interface MissionProject {
  id: string
  name: string
  description: string
  status: string
  updatedAt: string
}
export interface MissionTask {
  id: string
  title: string
  status: string
  priority: string
  updatedAt: string
}
export interface MissionSnapshot {
  fetchedAt: string
  project: MissionProject
  tasks: MissionSource<MissionTask[]>
  github: MissionSource<GitHubSnapshot>
  deployment: MissionSource<DeploymentSnapshot>
  neon: MissionSource<NeonSnapshot>
  monitoring: MissionSource<NeonMonitoringState>
}
export type MissionStatus = 'ok' | 'attention' | 'unknown'
export interface MissionFact {
  id: string
  title: string
  detail: string
  at: string | null
  href: string
  status: MissionStatus
  source: string
}
export interface MissionAnalysis {
  status: MissionStatus
  facts: MissionFact[]
  events: MissionFact[]
  gaps: string[]
  connections: Array<{ title: string; detail: string; evidence: string[] }>
  nextSteps: Array<{ title: string; href: string }>
}
