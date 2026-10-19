import { NeonMonitoring } from './NeonMonitoring'
import { useState } from 'react'
import { Database, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useNeonOverview, useNeonSnapshot } from '@/hooks/use-neon'

function bytes(value: number | null | undefined) {
  if (value == null) return 'Nicht verfügbar'
  return `${(value / 1024 ** 3).toLocaleString('de-DE', { maximumFractionDigits: 3 })} GiB`
}

function hours(value: number | null | undefined) {
  return value == null ? 'Nicht verfügbar' : (value / 3600).toLocaleString('de-DE', { maximumFractionDigits: 2 })
}

const stateLabels: Record<string, string> = { active: 'Aktiv', idle: 'Inaktiv', suspended: 'Ruht',
  init: 'Wird vorbereitet', ready: 'Bereit', archived: 'Archiviert', resetting: 'Wird zurückgesetzt' }

export function NeonPanel({ projectId }: { projectId?: string }) {
  const overview = useNeonOverview()
  const [selected, setSelected] = useState('')
  const links = overview.data?.links ?? []
  const current = links.find((link) => link.projectId === (projectId || selected)) ?? (!projectId ? links[0] : undefined)
  const snapshot = useNeonSnapshot(overview.data?.configured && current ? current.projectId : null)
  const data = snapshot.data

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3 sm:flex-row">
        <CardTitle className="flex items-center gap-2 text-base"><Database className="size-4 text-emerald-400" />Neon-Datenbank</CardTitle>
        <Button size="sm" variant="outline" disabled={overview.isFetching || snapshot.isFetching} onClick={() => {
          void overview.refetch()
          if (current && overview.data?.configured) void snapshot.refetch()
        }}><RefreshCw className={`mr-2 size-3.5 ${overview.isFetching || snapshot.isFetching ? 'animate-spin' : ''}`} />Aktualisieren</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {overview.isLoading ? <p className="text-sm text-muted-foreground">Neon-Zuordnung wird geladen…</p> : overview.error ? (
          <p role="alert" className="text-sm text-destructive">{overview.error.message}</p>
        ) : !overview.data?.configured || !current ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Für {projectId ? 'dieses Projekt' : 'deine Projekte'} ist noch keine nutzbare Neon-Verbindung eingerichtet.</p>
            <a className="underline underline-offset-4" href="https://github.com/leonbytyqi1709-sketch/OMNIDESK-V2/blob/main/docs/NEON-MONITORING.md" target="_blank" rel="noreferrer">Einrichtung ansehen</a>
            <details className="break-all text-xs"><summary className="cursor-pointer">Kennungen für die Einrichtung</summary>
              <p className="mt-2">Benutzer: {overview.data?.userId}</p>{projectId && <p>OMNIDESK-Projekt: {projectId}</p>}
            </details>
          </div>
        ) : (
          <>
            {!projectId && <Select value={current.projectId} onValueChange={setSelected}><SelectTrigger aria-label="Neon-Projekt auswählen"><SelectValue /></SelectTrigger>
              <SelectContent>{links.map((link) => <SelectItem key={link.projectId} value={link.projectId}>{link.projectName}</SelectItem>)}</SelectContent></Select>}
            {snapshot.isLoading && <p className="text-sm text-muted-foreground">Neon-Werte werden abgerufen…</p>}
            {snapshot.error && <p role="alert" className="text-sm text-destructive">{snapshot.error.message}{data ? ' Die untenstehenden Werte sind vom letzten erfolgreichen Abruf.' : ''}</p>}
            {data && <>
              <div className="text-sm"><span className="font-semibold">{data.project?.name ?? current.neonProjectId}</span><span className="ml-2 text-muted-foreground">{data.project?.region ?? 'Region nicht verfügbar'} · PostgreSQL {data.project?.postgresVersion ?? '–'}</span></div>
              {data.unavailable.length > 0 && <p role="status" className="text-xs text-amber-400">Teilweise nicht verfügbar: {data.unavailable.join(', ')}. Fehlende Werte werden nicht als gesund bewertet.</p>}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Branch', data.branch ? `${data.branch.name} · ${stateLabels[data.branch.state] ?? data.branch.state}` : 'Nicht verfügbar'],
                  ['Logische Branchgröße', bytes(data.branch?.logicalSizeBytes)],
                  ['Projektspeicher inkl. Historie/WAL', bytes(data.consumption?.projectStorageBytes)],
                  ['Compute-Zeit (CU-h)', hours(data.consumption?.computeCuSeconds)],
                  ['Aktive Zeit (Stunden)', hours(data.consumption?.activeSeconds)],
                  ['Datenübertragung', bytes(data.consumption?.transferBytes)],
                ].map(([label, value]) => <div key={label} className="rounded-lg border border-border/60 bg-secondary/20 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>)}
              </div>
              <div className="space-y-2"><p className="text-xs font-medium text-muted-foreground">Compute-Endpunkte des zugeordneten Branches</p>
                {data.endpoints === null ? <p className="text-sm">Nicht verfügbar</p> : !data.endpoints.length ? <p className="text-sm text-muted-foreground">Kein Compute-Endpunkt für diesen Branch vorhanden.</p> : data.endpoints.map((endpoint) => (
                  <div key={endpoint.id} className="flex flex-wrap justify-between gap-2 rounded-lg border border-border/60 p-3 text-xs"><span className="break-all font-mono">{endpoint.id}</span><span>{endpoint.disabled ? 'Deaktiviert' : stateLabels[endpoint.state] ?? endpoint.state}{endpoint.pendingState ? ` → ${stateLabels[endpoint.pendingState] ?? endpoint.pendingState}` : ''} · {endpoint.type === 'read_only' ? 'Lesereplikat' : 'Primär'} · {endpoint.minCu ?? '–'}–{endpoint.maxCu ?? '–'} CU</span></div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Abruf: {new Date(data.checkedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}. Verbrauchswerte gelten für das gesamte Neon-Projekt{data.consumption?.periodStart && data.consumption.periodEnd ? ` (${new Date(data.consumption.periodStart).toLocaleDateString('de-DE')}–${new Date(data.consumption.periodEnd).toLocaleDateString('de-DE')})` : '; Messzeitraum nicht verfügbar'}. Compute-Status ist kein SQL-Funktionstest. Ruhende Computes sind kein Ausfall.</p>
            </>}
            <NeonMonitoring key={current.projectId} projectId={current.projectId} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
