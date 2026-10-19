import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Clock3, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApiFetch } from '@/hooks/use-api'
import { useNeonMonitoring } from '@/hooks/use-neon-monitoring'
import { NeonHistoryChart } from './NeonHistoryChart'
import type { NeonMonitoringState, NeonSettings } from '@/types/neon-monitoring'

const date = (value: string | null) => value ? new Date(value).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }) : 'Noch keine Prüfung'
function old(value: string | null, minutes: number) { return !value || Date.now() - Date.parse(value) > minutes * 2 * 60_000 }
function Settings({ data, save, busy }: { data: NeonMonitoringState; save: (settings: NeonSettings) => void; busy: boolean }) {
  const [settings, setSettings] = useState<NeonSettings>({ ...data.settings, monitorIds: data.settings.monitorIds.filter((id) => data.monitors.some((monitor) => monitor.id === id)) })
  const field = (key: 'storageLimitGiB' | 'computeLimitHours' | 'transferLimitGiB' | 'sqlLatencyLimitMs', label: string) =>
    <label className="space-y-1 text-xs" key={key}><span className="text-muted-foreground">{label} · leer = aus</span><input type="number" min="0.001" step="any" value={settings[key] ?? ''} onChange={(event) => setSettings({ ...settings, [key]: event.target.value === '' ? null : Number(event.target.value) })} className="w-full rounded-md border border-border bg-background px-3 py-2" /></label>
  return <div className="space-y-4 rounded-lg border border-border p-4">
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />Automatische Neon-Prüfungen aktivieren</label>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="space-y-1 text-xs">Neon-Prüfintervall<select value={settings.intervalMinutes} onChange={(e) => setSettings({ ...settings, intervalMinutes: Number(e.target.value), sqlIntervalMinutes: Math.max(settings.sqlIntervalMinutes, Number(e.target.value)) })} className="block w-full rounded-md border border-border bg-background p-2">{[5, 15, 60].map((n) => <option key={n} value={n}>{n} Minuten</option>)}</select></label>
      <label className="space-y-1 text-xs">Aufbewahrung<select value={settings.retentionDays} onChange={(e) => setSettings({ ...settings, retentionDays: Number(e.target.value) })} className="block w-full rounded-md border border-border bg-background p-2">{[7, 30, 90].map((n) => <option key={n} value={n}>{n} Tage</option>)}</select></label>
      <label className="space-y-1 text-xs">Warnung nach Fehlprüfungen<input type="number" min="1" max="10" value={settings.failureThreshold} onChange={(e) => setSettings({ ...settings, failureThreshold: Number(e.target.value) })} className="block w-full rounded-md border border-border bg-background p-2" /></label>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">{field('storageLimitGiB', 'Projektspeicher (GiB)')}{field('computeLimitHours', 'Compute-Verbrauch (CU-h)')}{field('transferLimitGiB', 'Datenübertragung (GiB)')}</div>
    <div className="space-y-3 border-t border-border pt-3">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!data.sqlConfigured} checked={settings.sqlEnabled} onChange={(e) => setSettings({ ...settings, sqlEnabled: e.target.checked })} />SQL-Funktionstest einschalten</label>
      <p className="text-xs text-muted-foreground">Führt ausschließlich SELECT 1 in einer lesenden Transaktion aus. Kann einen ruhenden Compute aufwecken und Verbrauch erzeugen. Laufzeit umfasst Verbindung und mögliche Startzeit.</p>
      {!data.sqlConfigured && <p className="text-xs text-amber-400">SQL-Zugang ist noch nicht serverseitig eingerichtet. Anleitung unten beachten.</p>}
      <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-xs">SQL-Prüfintervall<select value={settings.sqlIntervalMinutes} onChange={(e) => setSettings({ ...settings, sqlIntervalMinutes: Number(e.target.value) })} className="block w-full rounded-md border border-border bg-background p-2">{[15, 60, 240].map((n) => <option key={n} value={n} disabled={n < settings.intervalMinutes}>{n} Minuten</option>)}</select></label>{field('sqlLatencyLimitMs', 'SQL-Laufzeit (ms)')}</div>
    </div>
    <fieldset className="space-y-2 border-t border-border pt-3"><legend className="text-sm">Website-/API-/TCP-Monitore verknüpfen · maximal 3</legend>
      {!data.monitors.length && <p className="text-xs text-muted-foreground">Zuerst einen Monitor im Uptime-Modul anlegen.</p>}
      <div className="max-h-52 space-y-2 overflow-y-auto">{data.monitors.map((monitor) => <label key={monitor.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={settings.monitorIds.includes(monitor.id)} disabled={!settings.monitorIds.includes(monitor.id) && settings.monitorIds.length >= 3} onChange={(e) => setSettings({ ...settings, monitorIds: e.target.checked ? [...settings.monitorIds, monitor.id] : settings.monitorIds.filter((id) => id !== monitor.id) })} />{monitor.name}{!monitor.active && ' · pausiert'}</label>)}</div>
    </fieldset>
    <Button size="sm" disabled={busy} onClick={() => save(settings)}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}{data.setupRequired ? 'Monitoring einrichten und starten' : 'Einstellungen speichern'}</Button>
    <p className="text-xs text-muted-foreground">Bei der ersten Einrichtung werden ausschließlich zusätzliche V2-Monitoring-Tabellen angelegt. Bestehende Monitore und Projektdaten bleiben erhalten.</p>
  </div>
}
export function NeonMonitoring({ projectId }: { projectId: string }) {
  const [days, setDays] = useState(1)
  const state = useNeonMonitoring(projectId, days)
  const api = useApiFetch()
  const cache = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  async function action(path: string, method: string, body?: unknown) {
    setBusy(true); setMessage(null)
    try {
      const result = await api<{ outcome?: string }>(`/api/neon/${encodeURIComponent(projectId)}/monitoring${path}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) })
      if (path === '/settings' && state.data?.setupRequired) await api(`/api/neon/${encodeURIComponent(projectId)}/monitoring/check`, { method: 'POST' })
      setMessage(result.outcome === 'not_due_or_running' ? 'Eine Prüfung läuft bereits oder liegt weniger als eine Minute zurück.' : result.outcome === 'recorded_with_errors' ? 'Prüfung gespeichert. Einige Daten sind nicht verfügbar; Hinweise beachten.' : 'Gespeichert.')
      await cache.invalidateQueries({ queryKey: ['neon-monitoring'] })
      await cache.invalidateQueries({ queryKey: ['neon'] })
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Anfrage fehlgeschlagen.') }
    finally { setBusy(false) }
  }
  const data = state.data
  if (state.isLoading) return <p className="text-sm text-muted-foreground">Monitoring-Historie wird geladen…</p>
  if (state.error) return <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{state.error.message}</p><Button size="sm" variant="outline" onClick={() => void state.refetch()}>Erneut versuchen</Button></div>
  if (!data) return null
  const stale = old(data.lastSuccessAt, data.settings.intervalMinutes)
  const schedulerStale = old(data.lastSchedulerAt, data.schedulerIntervalMinutes)
  const alerts = data.alerts.filter((alert) => !alert.resolvedAt)
  const linked = data.monitors.filter((monitor) => monitor.linked)
  return <section aria-label="Neon-Monitoring und Projektzustand" className="space-y-4 border-t border-border pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-base font-semibold">Projektüberwachung & Verlauf</h3><Button size="sm" variant="outline" disabled={busy || data.setupRequired} onClick={() => void action('/check', 'POST')}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Jetzt prüfen & speichern</Button></div>
    {message && <p role="status" className="break-words text-sm">{message}</p>}
    {data.setupRequired && <p className="rounded-lg border border-amber-500/30 p-3 text-sm text-amber-400">Die aktuelle Neon-Übersicht funktioniert bereits. Für Historie, Warnungen und Hintergrundprüfungen bitte unten das Monitoring einrichten.</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Neon-Verwaltungsdaten</p><p className={`mt-1 flex items-center gap-2 text-sm ${stale ? 'text-amber-400' : 'text-emerald-400'}`}>{stale ? <Clock3 className="size-4" /> : <CheckCircle2 className="size-4" />}{!data.lastSuccessAt ? 'Unbekannt' : stale ? 'Veraltet' : 'Aktuell'}</p><p className="mt-2 text-xs text-muted-foreground">Vollständig erfolgreich: {date(data.lastSuccessAt)}</p><p className="mt-1 text-xs text-muted-foreground">Letzter Versuch: {date(data.lastAttemptAt)}</p></div>
      <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Hintergrundprüfungen</p><p className={`mt-1 text-sm ${!data.settings.enabled || schedulerStale ? 'text-amber-400' : 'text-emerald-400'}`}>{!data.settings.enabled ? 'Pausiert' : !data.lastSchedulerAt ? 'Noch nicht nachgewiesen' : schedulerStale ? 'Überfällig' : 'Letzter Lauf empfangen'}</p><p className="mt-2 text-xs text-muted-foreground">{date(data.lastSchedulerAt)}</p><p className="mt-1 text-xs text-muted-foreground">Erwarteter Aufruf: alle {data.schedulerIntervalMinutes} Minuten</p></div>
      <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">SQL-Funktionstest</p><p className="mt-1 text-sm">{!data.settings.sqlEnabled ? 'Ausgeschaltet' : !data.lastSql ? 'Noch nicht geprüft' : old(data.lastSql.checkedAt, Math.max(data.settings.sqlIntervalMinutes, data.settings.intervalMinutes)) ? 'Veraltet' : data.lastSql.status === 'up' ? `Erfolgreich · ${data.lastSql.latencyMs} ms` : 'Nicht erfolgreich'}</p><p className="mt-2 text-xs text-muted-foreground">{data.settings.sqlEnabled ? date(data.lastSql?.checkedAt ?? null) : 'Unabhängig vom Compute-Status'}</p></div>
      <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Offene Warnungen</p><p className={`mt-1 flex items-center gap-2 text-sm ${alerts.length ? 'text-amber-400' : ''}`}><AlertTriangle className="size-4" />{alerts.length}</p><p className="mt-2 text-xs text-muted-foreground">Keine Warnung allein ist kein Nachweis vollständiger Verfügbarkeit.</p></div>
    </div>
    {!data.setupRequired && data.schedulerIntervalMinutes > data.settings.intervalMinutes && <p role="status" className="text-sm text-amber-400">Der konfigurierte Scheduler läuft seltener als dein Prüfintervall. Für Vercel Hobby den externen Fünf-Minuten-Scheduler einrichten und NEON_SCHEDULER_INTERVAL_MINUTES=5 setzen.</p>}
    <div className="space-y-2"><h4 className="text-sm font-semibold">Zugeordnete Website-/API-/TCP-Monitore</h4>{data.settings.monitorIds.some((id) => !data.monitors.some((monitor) => monitor.id === id)) && <p className="text-xs text-amber-400">Ein zugeordneter Monitor wurde gelöscht oder ist nicht mehr zugänglich. Zuordnung in den Einstellungen erneut speichern.</p>}{!linked.length ? <p className="text-xs text-muted-foreground">Noch keine Monitore zugeordnet. In den Einstellungen auswählen.</p> : linked.map((monitor) => <div key={monitor.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-xs"><span>{monitor.name}</span><span>{!monitor.active ? 'Pausiert' : old(monitor.checkedAt, data.settings.intervalMinutes) ? 'Unbekannt / veraltet' : monitor.status === 'up' ? `Online · ${monitor.responseTimeMs ?? '–'} ms` : monitor.status === 'down' ? 'Störung' : 'Unbekannt'}</span><span className="text-muted-foreground">{date(monitor.checkedAt)}</span></div>)}</div>
    <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">Messhistorie</h4><select aria-label="Zeitraum der Neon-Historie" value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-md border border-border bg-background p-2 text-xs">{[1, 7, 30, 90].map((n) => <option key={n} value={n}>{n === 1 ? '24 Stunden' : `${n} Tage`}</option>)}</select></div>
      <p className="text-xs text-muted-foreground">{data.settings.retentionDays} Tage Aufbewahrung. Historie beginnt mit der ersten gespeicherten Prüfung. Lücken bleiben sichtbar. Speicher und SQL-Laufzeit: Mittelwerte; Verbrauch: höchste kumulative Werte je Zeitbereich. Ein neuer Neon-Verbrauchszeitraum setzt Verbrauchszähler zurück.</p>
      <div className="grid gap-3 md:grid-cols-2">{([
        ['storageGiB', 'Projektspeicher inkl. Historie/WAL', 'GiB'], ['branchGiB', 'Logische Branchgröße', 'GiB'],
        ['computeHours', 'Compute-Verbrauch', 'CU-h'], ['transferGiB', 'Datenübertragung', 'GiB'],
        ['sqlLatencyMs', 'SQL-Laufzeit inkl. Verbindung/Start', 'ms'],
      ] as const).map(([metric, label, unit]) => <NeonHistoryChart key={metric} points={data.history} metric={metric} label={label} unit={unit} bucketMs={Math.max(data.settings.intervalMinutes * 60, days === 1 ? 300 : days === 7 ? 3600 : days === 30 ? 21600 : 86400) * 1000} />)}</div>
      <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">Messwerte als Tabelle · {data.history.length} Zeitbereiche</summary><div className="mt-2 max-h-64 overflow-auto"><table className="w-full text-left"><thead><tr>{['Zeit (Berlin)', 'Speicher GiB', 'CU-h', 'Prüfungen', 'API-Fehlprüfungen'].map((label) => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{data.history.map((point, i) => <tr key={`${point.at}:${i}`}><td className="p-2">{date(point.at)}</td><td className="p-2">{point.storageGiB?.toFixed(3) ?? '–'}</td><td className="p-2">{point.computeHours?.toFixed(3) ?? '–'}</td><td className="p-2">{point.samples}</td><td className="p-2">{point.failures}</td></tr>)}</tbody></table></div></details>
    </div>
    <details open={alerts.length > 0} className="space-y-2"><summary className="cursor-pointer text-sm font-semibold">Warnungsverlauf · {alerts.length} offen</summary>{!data.alerts.length ? <p className="pt-2 text-xs text-muted-foreground">Noch keine Warnereignisse aufgezeichnet.</p> : data.alerts.map((alert) => <div key={alert.id} className={`mt-2 space-y-2 rounded-lg border p-3 text-xs ${alert.resolvedAt ? 'border-border text-muted-foreground' : 'border-amber-500/40'}`}><p>{alert.message}</p><p>{alert.resolvedAt ? 'Behoben' : alert.severity === 'critical' ? 'Kritisch' : 'Warnung'} · Seit {date(alert.startedAt)}{alert.resolvedAt && ` · Behoben ${date(alert.resolvedAt)}`}{alert.acknowledgedAt && ' · Gelesen'}</p>{!alert.acknowledgedAt && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void action(`/alerts/${alert.id}/acknowledge`, 'POST')}>Als gelesen markieren</Button>}</div>)}</details>
    <details open={data.setupRequired}><summary className="cursor-pointer text-sm font-semibold">Monitoring-Einstellungen</summary><div className="mt-3"><Settings key={JSON.stringify(data.settings)} data={data} busy={busy} save={(settings) => void action('/settings', 'PUT', settings)} /></div></details>
    <a href="https://github.com/leonbytyqi1709-sketch/OMNIDESK-V2/blob/main/docs/NEON-MONITORING.md" target="_blank" rel="noreferrer" className="inline-block text-xs text-muted-foreground underline underline-offset-4">Einrichtung: Scheduler, Warnungen und optionaler SQL-Zugang</a>
  </section>
}
