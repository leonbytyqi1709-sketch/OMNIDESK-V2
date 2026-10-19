export interface DeploymentSummary {
  id: string
  url: string | null
  state: string
  target: 'production' | 'preview' | 'other'
  createdAt: number | null
  commit: { sha: string | null; message: string | null; branch: string | null }
}

export interface DeploymentSnapshot {
  checkedAt: string
  project: { id: string; name: string } | null
  production: DeploymentSummary | null
  deployments: DeploymentSummary[] | null
  unavailable: string[]
  historyLimit: number
}

export interface DeploymentLogs {
  deploymentId: string
  checkedAt: string
  entries: Array<{ text: string; type: string; timestamp: number | null }>
  limit: number
  truncated: boolean
}
