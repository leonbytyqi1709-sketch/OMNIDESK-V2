import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LOGIN_DEPENDENCY_LABELS, RELATION_LABELS } from '@/lib/account-map'
import type { SecurityAccount } from '@/types/account-security'
import type { AccountRelation, AccountRelationInput } from '@/types/account-map'
export function RelationForm({ accounts, relation, sourceId, busy, error, close, save }: {
  accounts: SecurityAccount[]; relation?: AccountRelation; sourceId: string; busy: boolean; error: string | null;
  close: () => void; save: (value: AccountRelationInput) => void
}) {
  const [value, setValue] = useState<AccountRelationInput>(relation ? { fromAccountId: relation.fromAccountId, toAccountId: relation.toAccountId, type: relation.type, loginDependency: relation.loginDependency, reviewed: false } : {
    fromAccountId: sourceId || accounts[0]?.id || '', toAccountId: '', type: 'login', loginDependency: 'unknown', reviewed: false,
  })
  const from = accounts.find((account) => account.id === value.fromAccountId), to = accounts.find((account) => account.id === value.toAccountId)
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) close() }}><DialogContent className="w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{relation ? 'Verbindung bearbeiten' : 'Konten verbinden'}</DialogTitle><DialogDescription>Ein Pfeil führt vom unterstützenden Konto zum Konto, das es nutzt. Alle Angaben sind manuell dokumentiert.</DialogDescription></DialogHeader>
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save(value) }}>
      <label className="block space-y-1 text-sm">Unterstützendes Konto · Start des Pfeils<select required value={value.fromAccountId} onChange={(e) => setValue({ ...value, fromAccountId: e.target.value, ...(e.target.value === value.toAccountId ? { toAccountId: '' } : {}) })} className="block w-full min-w-0 rounded-md border border-border bg-background p-2"><option value="" disabled>Konto wählen</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      <label className="block space-y-1 text-sm">Konto, das dieses Konto nutzt · Ziel des Pfeils<select required value={value.toAccountId} onChange={(e) => setValue({ ...value, toAccountId: e.target.value })} className="block w-full min-w-0 rounded-md border border-border bg-background p-2"><option value="" disabled>Konto wählen</option>{accounts.filter((account) => account.id !== value.fromAccountId).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      <label className="block space-y-1 text-sm">Art der Verbindung<select value={value.type} onChange={(e) => setValue({ ...value, type: e.target.value as AccountRelationInput['type'], loginDependency: e.target.value === 'login' ? 'unknown' : null })} className="block w-full rounded-md border border-border bg-background p-2">{Object.entries(RELATION_LABELS).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>
      {value.type === 'login' && <label className="block space-y-1 text-sm">Weitere Anmeldemöglichkeiten beim Zielkonto<select value={value.loginDependency ?? 'unknown'} onChange={(e) => setValue({ ...value, loginDependency: e.target.value as AccountRelationInput['loginDependency'] })} className="block w-full rounded-md border border-border bg-background p-2">{Object.entries(LOGIN_DEPENDENCY_LABELS).map(([mode, label]) => <option key={mode} value={mode}>{label}</option>)}</select></label>}
      {from && to && <p className="break-words rounded-lg border border-border bg-secondary/20 p-3 text-sm"><strong>{to.name}</strong> nutzt <strong>{from.name}</strong> {value.type === 'login' ? 'zur Anmeldung' : value.type === 'recovery_email' ? 'als Wiederherstellungs-E-Mail-Konto' : 'für einen weiteren Wiederherstellungsweg'}.</p>}
      <p className="text-xs text-muted-foreground">Eine Wiederherstellungsadresse ist kein zwingender Anmeldeweg. Eine dokumentierte Alternative ist kein automatischer Nachweis, dass sie unabhängig und aktuell nutzbar ist. Keine Passwörter, Codes oder Schlüssel eintragen.</p>
      <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={value.reviewed} onChange={(e) => setValue({ ...value, reviewed: e.target.checked })} className="mt-1" /><span>Ich habe diese Verbindung und die Angabe zu alternativen Anmeldewegen selbst geprüft.</span></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" disabled={busy} onClick={close}>Abbrechen</Button><Button type="submit" disabled={busy || !from || !to} className="bg-gradient-accent text-white">{busy ? 'Wird gespeichert…' : 'Verbindung speichern'}</Button></div>
    </form>
  </DialogContent></Dialog>
}
