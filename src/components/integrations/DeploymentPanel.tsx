import { useState } from 'react'
import { ExternalLink, FileText, RefreshCw, Rocket } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDeploymentLogs, useDeploymentsOverview, useDeploymentSnapshot } from '@/hooks/use-deployments'
import type { DeploymentSummary } from '@/types/deployments'

const stateLabels: Record<string, string> = { READY: 'Bereit', ERROR: 'Fehlgeschlagen', BUILDING: 'Wird gebaut',
  QUEUED: 'Wartet', INITIALIZING: 'Startet', CANCELED: 'Abgebrochen', BLOCKED: 'Blockiert', UNKNOWN: 'Unbekannt' }

function DeploymentState({ state }: { state: string }) {
  return <Badge variant="outline" className={state === 'READY' ? 'text-emerald-400 border-emerald-500/30' : state === 'ERROR' || state === 'BLOCKED' ? 'text-rose-400 border-rose-500/30' : 'text-muted-foreground'}>{stateLabels[state] ?? state}</Badge>
}

function CommitInfo({ deployment }: { deployment: DeploymentSummary }) {
  return <p className="mt-1 break-words text-xs text-muted-foreground">{deployment.commit.sha ? <code className="mr-2">{deployment.commit.sha.slice(0, 8)}</code> : 'Kein Commit angegeben. '}{deployment.commit.branch && <span className="mr-2">{deployment.commit.branch}</span>}{deployment.commit.message}</p>
}

export function DeploymentPanel({ projectId }: { projectId?: string }) {
  const overview = useDeploymentsOverview(!projectId)
  const [selected, setSelected] = useState('')
  const [logSelection, setLogSelection] = useState<{ projectId: string; deploymentId: string } | null>(null)
  const links = overview.data?.links ?? []
  const current = links.find((link) => link.projectId === (projectId || selected)) ?? (!projectId ? links[0] : undefined)
  const snapshot = useDeploymentSnapshot(current && overview.data?.configured ? (projectId ? current.projectId : current.vercelProjectId) : null, !projectId, current?.teamId)
  const selectedLog = logSelection?.projectId === current?.projectId ? logSelection?.deploymentId ?? null : null
  const logs = useDeploymentLogs(current ? (projectId ? current.projectId : current.vercelProjectId) : null, selectedLog, !projectId, current?.teamId)
  const data = snapshot.data
  const openLogs = (deploymentId: string) => { if (current) setLogSelection({ projectId: current.projectId, deploymentId }) }

  return <Card className="border-border bg-card">
    <CardHeader className="flex flex-wrap items-center justify-between gap-3 sm:flex-row">
      <CardTitle className="flex items-center gap-2 text-base"><Rocket className="size-4" />Deployment-Zentrale</CardTitle>
      <Button size="sm" variant="outline" disabled={overview.isFetching || snapshot.isFetching} onClick={() => {
        void overview.refetch()
        if (current && overview.data?.configured) void snapshot.refetch()
      }}><RefreshCw className={`mr-2 size-3.5 ${overview.isFetching || snapshot.isFetching ? 'animate-spin' : ''}`} />Aktualisieren</Button>
    </CardHeader>
    <CardContent className="space-y-4">
      {overview.data?.warning && <p role="status" className="text-sm text-amber-400">{overview.data.warning}</p>}
      {overview.isLoading ? <p className="text-sm text-muted-foreground">Vercel-Projekte werden geladen…</p> : overview.error ? <p role="alert" className="text-sm text-destructive">{overview.error.message}</p> : !overview.data?.configured || !current ? (
        <div className="space-y-2 text-sm text-muted-foreground"><p>{overview.data?.configured && !projectId ? 'Keine zugänglichen Vercel-Projekte gefunden.' : `Für ${projectId ? 'dieses Projekt' : 'dein Konto'} ist noch keine Vercel-Verbindung eingerichtet.`}</p>
          <a href="https://github.com/leonbytyqi1709-sketch/OMNIDESK-V2/blob/main/docs/VERCEL-MONITORING.md" target="_blank" rel="noreferrer" className="underline underline-offset-4">Einrichtung ansehen</a>
          <details className="break-all text-xs"><summary className="cursor-pointer">Kennungen für die Einrichtung</summary><p className="mt-2">Benutzer: {overview.data?.userId}</p>{projectId && <p>OMNIDESK-Projekt: {projectId}</p>}</details>
        </div>
      ) : <>
        {!projectId && <Select value={current.projectId} onValueChange={setSelected}><SelectTrigger aria-label="Deployment-Projekt auswählen"><SelectValue /></SelectTrigger><SelectContent>{links.map((link) => <SelectItem key={link.projectId} value={link.projectId}>{link.projectName}</SelectItem>)}</SelectContent></Select>}
        {snapshot.isLoading && <p className="text-sm text-muted-foreground">Deployments werden abgerufen…</p>}
        {snapshot.error && <p role="alert" className="text-sm text-destructive">{snapshot.error.message}{data ? ' Angezeigte Daten stammen vom letzten erfolgreichen Abruf.' : ''}</p>}
        {data && <>
          <p className="text-sm font-semibold">{data.project?.name ?? current.vercelProjectId}</p>
          {data.unavailable.length > 0 && <p role="status" className="text-xs text-amber-400">Nicht verfügbar: {data.unavailable.join(', ')}.</p>}
          <div className="space-y-2 rounded-xl border border-border/70 bg-secondary/20 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Aktuell zugeordnete Produktion</p>
            {data.production ? <>
              <div className="flex flex-wrap items-center gap-2"><DeploymentState state={data.production.state} /><code className="break-all text-xs">{data.production.id}</code></div>
              <CommitInfo deployment={data.production} />
              <div className="flex flex-wrap gap-2">
                {data.production.url && <a href={data.production.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs underline underline-offset-4">Deployment öffnen<ExternalLink className="size-3" /></a>}
                <Button size="sm" variant="ghost" onClick={() => openLogs(data.production!.id)}><FileText className="mr-1 size-3.5" />Build-Logs</Button>
              </div>
            </> : <p className="text-sm text-muted-foreground">Keine Produktionszuordnung verfügbar. Ein erfolgreicher Eintrag im Verlauf allein gilt nicht als aktuelle Produktion.</p>}
          </div>
          <div className="space-y-2"><h3 className="text-sm font-semibold">Deployment-Verlauf · bis zu {data.historyLimit} Einträge</h3>
            {data.deployments === null ? <p className="text-sm text-muted-foreground">Verlauf konnte nicht geladen werden.</p> : !data.deployments.length ? <p className="text-sm text-muted-foreground">Keine Deployments im abgefragten Verlauf.</p> : data.deployments.map((deployment) => (
              <div key={deployment.id} className="space-y-2 rounded-lg border border-border/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><DeploymentState state={deployment.state} /><Badge variant="outline">{deployment.id === data.production?.id ? 'Aktuelle Produktion' : deployment.target === 'production' ? 'Produktion' : deployment.target === 'preview' ? 'Vorschau' : 'Weitere Umgebung'}</Badge></div><span className="text-xs text-muted-foreground">{deployment.createdAt == null ? 'Zeitpunkt nicht verfügbar' : new Date(deployment.createdAt).toLocaleString('de-DE')}</span></div>
                <code className="block break-all text-xs">{deployment.id}</code><CommitInfo deployment={deployment} />
                <div className="flex flex-wrap items-center gap-3"><Button size="sm" variant="outline" onClick={() => openLogs(deployment.id)}><FileText className="mr-1 size-3.5" />Build-Logs</Button>{deployment.url && <a href={deployment.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs underline underline-offset-4">Öffnen<ExternalLink className="size-3" /></a>}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Abruf: {new Date(data.checkedAt).toLocaleString('de-DE')}. Nur lesender Zugriff. Deployment-Status ist kein Healthcheck der Anwendung.</p>
        </>}
        {selectedLog && <section aria-label="Build-Logs" className="space-y-3 rounded-xl border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="break-all text-sm font-semibold">Build-Logs · {selectedLog}</h3><div className="flex gap-2"><Button size="sm" variant="outline" disabled={logs.isFetching} onClick={() => void logs.refetch()}>Neu laden</Button><Button size="sm" variant="ghost" onClick={() => setLogSelection(null)}>Schließen</Button></div></div>
          <p className="text-xs text-muted-foreground">Logs können sensible Inhalte enthalten. Erkennbare Geheimwerte werden entfernt; bitte Inhalte vor dem Weitergeben selbst prüfen.</p>
          {logs.isLoading ? <p className="text-sm text-muted-foreground">Logs werden geladen…</p> : logs.error ? <p role="alert" className="text-sm text-destructive">{logs.error.message}</p> : logs.data ? <>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-secondary/30 p-3 text-xs">{logs.data.entries.length ? logs.data.entries.map((entry) => `${entry.timestamp == null ? '' : `${new Date(entry.timestamp).toLocaleTimeString('de-DE')} `}${entry.text}`).join('\n') : 'Keine verfügbaren Build-Logzeilen. Aufbewahrung und Zugriffsrechte hängen von Vercel ab.'}</pre>
            <p className="text-xs text-muted-foreground">Bis zu {logs.data.limit} jüngste Ereignisse.{logs.data.truncated ? ' Die Ausgabe ist begrenzt; vollständige Logs gegebenenfalls in Vercel öffnen.' : ''}</p>
          </> : null}
        </section>}
      </>}
    </CardContent>
  </Card>
}
