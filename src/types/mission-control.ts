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
  uptime: MissionSource<MissionUptime>
  comparison?: MissionComparison
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

export interface MissionMonitor {
  id: string
  name: string
  active: boolean
  linked: boolean
  status: 'up' | 'down' | null
  responseTimeMs: number | null
  checkedAt: string | null
  recentChecks: Array<{
    at: string
    status: 'up' | 'down'
    responseTimeMs: number | null
  }>
  sampleCount: number
  upCount: number
}
export interface MissionUptime {
  origin: 'direct' | 'neon' | 'none'
  version: number
  missingMonitors: number
  monitors: MissionMonitor[]
}
export interface MissionChange {
  id: string
  title: string
  before: string | null
  after: string | null
  href: string
}
export interface MissionComparison {
  status: 'first_visit' | 'compared' | 'unavailable'
  previousAt: string | null
  changes: MissionChange[]
  totalChanges: number
}
export interface MissionMonitorOptions {
  version: number
  origin: MissionUptime['origin']
  selectedIds: string[]
  monitors: Array<{ id: string; name: string; active: boolean }>
}

export interface MissionObservation {
  facts: Array<{ id: string; title: string; value: string; href: string }>
}
