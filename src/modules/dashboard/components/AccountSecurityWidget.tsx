import { NavLink } from 'react-router'
import { ShieldCheck } from 'lucide-react'
import { useSecurityOverview } from '@/hooks/use-account-security'
import { summarizeSecurity } from '@/lib/account-security'
import { WidgetCard } from './WidgetCard'
export function AccountSecurityWidget() {
  const { data, isLoading, error } = useSecurityOverview()
  const summary = data ? summarizeSecurity(data) : null
  return <WidgetCard title="Kontosicherheit" icon={ShieldCheck} to="/account-security">
    {isLoading ? <p className="text-sm text-muted-foreground">Angaben werden geladen…</p> : error ? <p className="text-sm text-destructive">Sicherheitsangaben nicht verfügbar.</p> : !data || data.setupRequired ? <NavLink to="/account-security" className="text-sm underline underline-offset-4">Sicherheitsübersicht einrichten</NavLink> : summary && <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{summary.total} Konten · {summary.accountsWithGaps} mit dokumentierten Lücken · {summary.reviewDue} mit offener Prüfung</p>
      {summary.actions.length ? <ul className="space-y-2">{summary.actions.slice(0, 3).map((action) => <li key={`${action.accountId}:${action.code}`}><NavLink to={action.href} className="block rounded-md p-1 text-sm hover:bg-secondary/40"><span className="block truncate font-medium">{action.accountName}</span><span className="block text-xs text-muted-foreground">{action.title}</span></NavLink></li>)}</ul> : <p className="text-sm text-muted-foreground">{summary.total ? 'Keine offenen Hinweise aus deinen dokumentierten Angaben.' : 'Noch keine Konten dokumentiert.'}</p>}
      <p className="text-[10px] text-muted-foreground">Selbstauskunft, keine automatische Anbieterprüfung.</p>
    </div>}
  </WidgetCard>
}
