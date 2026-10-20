export interface OmniChange {
  label: string
  before: string | null
  after: string
}
export interface OmniActionPreview {
  kind: string
  target: string
  href: string | null
  changes: OmniChange[]
  warning?: string
}
export interface OmniActionResult {
  title: string
  href: string
}
export interface OmniActionPlan {
  id: string
  status: 'pending' | 'executed' | 'cancelled' | 'expired'
  prompt: string
  timeZone: string
  createdAt: string
  expiresAt: string
  previews: OmniActionPreview[]
  results: OmniActionResult[]
}
export type OmniPlanningResponse =
  | { type: 'clarification'; message: string }
  | { type: 'plan'; plan: OmniActionPlan }
