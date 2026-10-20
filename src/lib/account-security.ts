import type { SecurityAccount, SecurityAccountAssessment, SecurityAction, SecurityOverview, SecurityState, SecuritySummary } from '../types/account-security'
export const SECURITY_LABELS: Record<SecurityState, string> = { unknown: 'Unbekannt', enabled: 'Aktiv / vorhanden', disabled: 'Nicht aktiv / fehlt', unsupported: 'Nicht verfügbar / nicht zutreffend' }
export const IMPORTANCE_LABELS = { critical: 'Kritisch', high: 'Wichtig', normal: 'Normal' }
export const REVIEW_INTERVALS = [30, 90, 180, 365] as const
export function assessSecurityAccount(account: SecurityAccount, now = Date.now()): SecurityAccountAssessment {
  const actions: SecurityAction[] = []
  const priority = account.importance === 'normal' ? 'normal' as const : 'high' as const
  const add = (code: string, title: string, kind: SecurityAction['kind'], important = priority) => actions.push({ code, title, kind, priority: important })
  if (account.passkey === 'unknown') add('passkey_unknown', 'Passkey-Unterstützung und Einrichtung prüfen', 'unknown')
  if (account.twoFactor === 'unknown') add('two_factor_unknown', 'Zwei-Faktor-Anmeldung prüfen', 'unknown')
  if (account.recovery === 'unknown') add('recovery_unknown', 'Wiederherstellungswege prüfen', 'unknown')
  if (account.recoveryCodes === 'unknown') add('codes_unknown', 'Verfügbarkeit und Sicherung von Wiederherstellungscodes prüfen', 'unknown')
  if (account.twoFactor === 'disabled' && account.passkey !== 'enabled') add('two_factor_missing', 'Zusätzliche Anmeldeabsicherung einrichten', 'gap')
  if (account.recovery === 'disabled') add('recovery_missing', 'Wiederherstellungsweg einrichten', 'gap')
  if (account.recoveryCodes === 'disabled') add('codes_missing', 'Wiederherstellungscodes erzeugen und sicher ablegen', 'gap')
  if (account.passkey === 'disabled') add('passkey_suggested', 'Passkey als zusätzliche Anmeldemöglichkeit prüfen', 'recommendation', 'normal')
  if (account.recovery === 'enabled' && account.recoveryMethods.length === 0) add('recovery_method_unknown', 'Art des Wiederherstellungswegs dokumentieren', 'unknown')
  const reviewDueAt = account.manualReviewedAt ? new Date(Date.parse(account.manualReviewedAt) + account.reviewIntervalDays * 86_400_000).toISOString() : null
  if (!reviewDueAt) add('review_missing', 'Angaben selbst prüfen und Prüfdatum bestätigen', 'review')
  else if (Date.parse(reviewDueAt) <= now) add('review_due', 'Dokumentierte Sicherheitsangaben erneut prüfen', 'review')
  const status = actions.some((action) => action.kind === 'gap') ? 'gaps' : actions.some((action) => action.kind === 'unknown') ? 'unknown' : actions.some((action) => action.kind === 'review') ? 'review' : 'documented'
  return { status, actions, reviewDueAt }
}
export function summarizeSecurity(overview: SecurityOverview): SecuritySummary {
  const now = Date.parse(overview.checkedAt)
  const assessed = overview.accounts.map((account) => ({ account, assessment: assessSecurityAccount(account, now) }))
  return { available: !overview.setupRequired, checkedAt: overview.checkedAt, total: overview.accounts.length,
    accountsWithGaps: assessed.filter(({ assessment }) => assessment.actions.some((action) => action.kind === 'gap')).length,
    accountsWithUnknowns: assessed.filter(({ assessment }) => assessment.actions.some((action) => action.kind === 'unknown')).length,
    reviewDue: assessed.filter(({ assessment }) => assessment.actions.some((action) => action.kind === 'review')).length,
    actions: assessed.flatMap(({ account, assessment }) => assessment.actions.map((action) => ({ ...action, accountId: account.id, accountName: account.name, source: 'manual' as const, href: `/account-security?account=${encodeURIComponent(account.id)}` })))
      .sort((a, b) => Number(b.priority === 'high') - Number(a.priority === 'high') || a.accountName.localeCompare(b.accountName)) }
}
