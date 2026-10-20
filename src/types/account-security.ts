export const SECURITY_STATES = ['unknown', 'enabled', 'disabled', 'unsupported'] as const
export type SecurityState = typeof SECURITY_STATES[number]
export type AccountImportance = 'critical' | 'high' | 'normal'
export interface SecurityAccountInput {
  name: string
  provider: string
  login: string
  securityUrl: string
  importance: AccountImportance
  passkey: SecurityState
  twoFactor: SecurityState
  recovery: SecurityState
  recoveryCodes: SecurityState
  recoveryMethods: Array<'email' | 'phone' | 'trusted_contact' | 'recovery_key' | 'hardware_key'>
  reviewIntervalDays: 30 | 90 | 180 | 365
  connectedAccountId: string | null
  reviewed: boolean
}
export interface SecurityAccount extends Omit<SecurityAccountInput, 'reviewed'> {
  id: string
  version: number
  manualReviewedAt: string | null
  createdAt: string
  updatedAt: string
  connection: SecurityConnection | null
}
export interface SecurityConnection { id: string; provider: string; email: string; label: string }
export interface SecurityAction {
  code: string
  title: string
  kind: 'gap' | 'unknown' | 'review' | 'recommendation'
  priority: 'high' | 'normal'
}
export interface SecurityAccountAssessment {
  status: 'gaps' | 'unknown' | 'review' | 'documented'
  actions: SecurityAction[]
  reviewDueAt: string | null
}
export interface SecurityOverview {
  setupRequired: boolean
  accounts: SecurityAccount[]
  connections: SecurityConnection[]
  connectionsUnavailable: boolean
  checkedAt: string
}
export interface SecuritySummary {
  checkedAt: string
  available: boolean
  total: number
  accountsWithGaps: number
  accountsWithUnknowns: number
  reviewDue: number
  actions: Array<SecurityAction & { accountId: string; accountName: string; source: 'manual'; href: string }>
}
