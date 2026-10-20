import type { SecurityAccount } from './account-security'
export type AccountRelationType = 'login' | 'recovery_email' | 'recovery_other'
export type LoginDependency = 'only_known' | 'alternative_known' | 'unknown'
export interface AccountRelationInput {
  fromAccountId: string
  toAccountId: string
  type: AccountRelationType
  loginDependency: LoginDependency | null
  reviewed: boolean
}
export interface AccountRelation extends Omit<AccountRelationInput, 'reviewed'> {
  id: string
  version: number
  manualReviewedAt: string | null
  createdAt: string
  updatedAt: string
}
export interface AccountMapOverview {
  accounts: SecurityAccount[]
  relations: AccountRelation[]
  setupRequired: boolean
  accountsSetupRequired: boolean
  checkedAt: string
}
export type DependencyKind = 'login_chain' | 'login_unknown' | 'alternative' | 'recovery' | 'connection_only'
export interface AccountDependency { accountId: string; distance: number; path: string[]; kind: DependencyKind }
export interface AccountMapAnalysis { dependencies: AccountDependency[]; upstreamIds: string[]; cycleIds: string[] }
