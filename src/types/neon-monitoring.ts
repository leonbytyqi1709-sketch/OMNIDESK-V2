export interface NeonSnapshot {
  checkedAt: string
  project: { id: string; name: string; region: string | null; postgresVersion: number | null } | null
  branch: { id: string; name: string; state: string; logicalSizeBytes: number | null } | null
  endpoints: Array<{ id: string; state: string; pendingState: string | null; type: string;
    disabled: boolean; lastActive: string | null; minCu: number | null; maxCu: number | null }> | null
  consumption: { projectStorageBytes: number | null; computeCuSeconds: number | null;
    activeSeconds: number | null; transferBytes: number | null; periodStart: string | null; periodEnd: string | null } | null
  unavailable: string[]
}
export interface NeonSettings {
  enabled: boolean
  intervalMinutes: number
  retentionDays: number
  storageLimitGiB: number | null
  computeLimitHours: number | null
  transferLimitGiB: number | null
  failureThreshold: number
  sqlEnabled: boolean
  sqlIntervalMinutes: number
  sqlLatencyLimitMs: number | null
  monitorIds: string[]
}
export interface SqlCheck {
  checkedAt: string
  status: 'up' | 'down' | 'unavailable'
  latencyMs: number | null
  message: string | null
}
export interface NeonAlert {
  id: string
  code: string
  message: string
  severity: 'warning' | 'critical'
  startedAt: string
  resolvedAt: string | null
  acknowledgedAt: string | null
}
export interface NeonHistoryPoint {
  periodStart: string | null
  at: string
  storageGiB: number | null
  branchGiB: number | null
  computeHours: number | null
  transferGiB: number | null
  sqlLatencyMs: number | null
  samples: number
  failures: number
}
export interface NeonMonitoringState {
  setupRequired: boolean
  settings: NeonSettings
  lastAttemptAt: string | null
  lastSuccessAt: string | null
  lastSchedulerAt: string | null
  lastSql: SqlCheck | null
  snapshot: NeonSnapshot | null
  alerts: NeonAlert[]
  history: NeonHistoryPoint[]
  historyDays: number
  schedulerIntervalMinutes: number
  sqlConfigured: boolean
  monitors: Array<{ id: string; name: string; active: boolean; linked: boolean;
    status: 'up' | 'down' | null; responseTimeMs: number | null; checkedAt: string | null }>
}
