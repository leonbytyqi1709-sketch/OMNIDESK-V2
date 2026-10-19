import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ExternalLink, GitBranch, RefreshCw } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useGitHubOverview, useGitHubSnapshot } from '@/hooks/use-github'
import { useApiFetch } from '@/hooks/use-api'
import type { GitHubItem } from '@/types/github'
const labels: Record<string, string> = { success: 'Erfolgreich', failure: 'Fehlgeschlagen', cancelled: 'Abgebrochen', skipped: 'Übersprungen', timed_out: 'Zeitlimit', in_progress: 'Läuft', queued: 'Wartet', open: 'Offen', completed: 'Abgeschlossen', action_required: 'Aktion erforderlich' }
function List({ title, items, sha }: { title: string; items: GitHubItem[] | null; sha?: string }) {
  return <section className="min-w-0 space-y-3 rounded-xl border border-border p-4"><h3 className="text-sm font-semibold">{title}{items && ` · ${items.length}`}</h3>
    {items === null ? <p className="text-xs text-amber-400">Nicht verfügbar. Berechtigungen oder API-Limit prüfen.</p> : !items.length ? <p className="text-xs text-muted-foreground">Keine Einträge im abgefragten Ausschnitt.</p> : <div className="max-h-80 space-y-3 overflow-y-auto">{items.map((item) => <div key={item.id} className={`space-y-1 border-b border-border/50 pb-3 last:border-0 ${sha && item.sha === sha ? 'border-l-2 border-l-emerald-400 pl-2' : ''}`}>
      <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={['failure', 'timed_out', 'action_required'].includes(item.status) ? 'text-rose-400' : item.status === 'success' ? 'text-emerald-400' : ''}>{labels[item.status] ?? item.status}</Badge>{sha && item.sha === sha && <Badge variant="outline">Gleicher Commit</Badge>}</div>
      {item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="flex items-start gap-2 break-words text-sm hover:underline"><span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{item.title}</span><ExternalLink className="mt-1 size-3 shrink-0" /></a> : <p className="break-words text-sm">{item.title}</p>}
      <p className="break-all text-xs text-muted-foreground">{item.sha && <code className="mr-2">{item.sha.slice(0, 8)}</code>}{item.branch && <span className="mr-2">{item.branch}</span>}{item.updatedAt && new Date(item.updatedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}</p>
    </div>)}</div>}
  </section>
}
export function GitHubPanel({ projectId, initialRepository, commitSha }: { projectId?: string; initialRepository?: string; commitSha?: string }) {
  const overview = useGitHubOverview(); const cache = useQueryClient(); const api = useApiFetch()
  const [selected, setSelected] = useState(initialRepository ?? '')
  const [targetProject, setTargetProject] = useState(projectId ?? '')
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null)
  const bound = overview.data?.links.find((link) => link.projectId === projectId)
  const repositories = overview.data?.repositories ?? []
  const current = repositories.find((repo) => repo.fullName === (selected || bound?.repository)) ?? (!projectId && !selected ? repositories[0] : undefined)
  const snapshot = useGitHubSnapshot(current && overview.data?.configured ? current.fullName : null)
  const data = snapshot.data
  const sha = initialRepository === current?.fullName && commitSha && /^[a-f0-9]{40}$/i.test(commitSha) ? commitSha : undefined
  async function link(remove = false) {
    if (!targetProject || !current) return
    setBusy(true); setMessage(null)
    try {
      await api(`/api/github/links/${encodeURIComponent(targetProject)}`, { method: remove ? 'DELETE' : 'PUT', ...(remove ? {} : { body: JSON.stringify({ repository: current.fullName }) }) })
      setMessage(remove ? 'Zuordnung entfernt.' : 'Repository dem Projekt zugeordnet.')
      await cache.invalidateQueries({ queryKey: ['github'] })
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Zuordnung fehlgeschlagen.') }
    finally { setBusy(false) }
  }
  return <Card className="min-w-0 border-border bg-card"><CardHeader className="flex flex-wrap items-center justify-between gap-3 sm:flex-row"><CardTitle className="flex items-center gap-2 text-base"><GitBranch className="size-4" />GitHub-Zentrale</CardTitle><Button size="sm" variant="outline" disabled={overview.isFetching || snapshot.isFetching} onClick={() => { void overview.refetch(); if (current) void snapshot.refetch() }}><RefreshCw className={`mr-2 size-4 ${overview.isFetching || snapshot.isFetching ? 'animate-spin' : ''}`} />Aktualisieren</Button></CardHeader>
    <CardContent className="min-w-0 space-y-4">
      {overview.isLoading ? <p className="text-sm text-muted-foreground">Repositories werden geladen…</p> : overview.error ? <p role="alert" className="text-sm text-destructive">{overview.error.message}</p> : !overview.data?.configured ? <div className="space-y-2 text-sm text-muted-foreground"><p>GitHub ist noch nicht verbunden. Die Einrichtung benötigt einen eigenen GitHub-Token und deine OMNIDESK-Benutzerkennung.</p><a className="underline" href="https://github.com/leonbytyqi1709-sketch/OMNIDESK-V2/blob/main/docs/GITHUB-ZENTRALE.md" target="_blank" rel="noreferrer">Einrichtung öffnen</a><p className="break-all text-xs">Benutzer: {overview.data?.userId}</p></div> : <>
        {overview.data.limited && <p role="status" className="text-xs text-amber-400">Die Repository-Liste ist auf 1000 Einträge begrenzt.</p>}
        {overview.data.mappingUnavailable && <p role="status" className="text-xs text-amber-400">OMNIDESK-Projekte oder Zuordnungen konnten nicht geladen werden. Repository-Daten bleiben separat verfügbar.</p>}
        {!repositories.length ? <p className="text-sm text-muted-foreground">Keine zugänglichen Repositories. Repository-Auswahl und Organisationsfreigabe des Tokens prüfen.</p> : <>
          {(selected || bound?.repository) && !current && <p role="status" className="text-xs text-amber-400">Das angefragte Repository ist nicht in der zugänglichen Liste. Token-Auswahl, Berechtigungen oder Repository-Namen prüfen.</p>}{projectId && !bound && <p className="text-sm text-muted-foreground">Diesem OMNIDESK-Projekt ist noch kein Repository zugeordnet. Wähle eines aus und speichere die Zuordnung.</p>}
          <select aria-label="GitHub-Repository auswählen" value={current?.fullName ?? ''} onChange={(e) => { setSelected(e.target.value); setMessage(null) }} className="w-full min-w-0 rounded-md border border-border bg-background p-2 text-sm"><option value="" disabled>Repository auswählen</option>{repositories.map((repo) => <option key={repo.id} value={repo.fullName}>{repo.fullName}{repo.private ? ' · Privat' : ''}</option>)}</select>
          {current && <>
            <div className="flex flex-wrap items-center gap-3 text-sm"><a className="inline-flex items-center gap-2 break-all font-semibold hover:underline" href={current.url} target="_blank" rel="noreferrer">{current.fullName}<ExternalLink className="size-3 shrink-0" /></a><Badge variant="outline">{current.private ? 'Privat' : 'Öffentlich'}</Badge><span className="text-xs text-muted-foreground">Standardbranch: {current.defaultBranch}</span></div>
            <div className="space-y-2 rounded-lg border border-border p-3"><p className="text-xs font-semibold">Mit OMNIDESK-Projekt verknüpfen</p><div className="flex flex-wrap gap-2">{!projectId && <select aria-label="OMNIDESK-Projekt für GitHub" value={targetProject} onChange={(e) => setTargetProject(e.target.value)} className="min-w-0 max-w-full rounded-md border border-border bg-background p-2 text-xs"><option value="">Projekt wählen</option>{overview.data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>}<Button size="sm" variant="outline" disabled={busy || !targetProject || overview.data.mappingUnavailable} onClick={() => void link()}>Zuordnung speichern</Button>{overview.data.links.some((entry) => entry.projectId === targetProject) && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void link(true)}>Zuordnung entfernen</Button>}</div>{overview.data.links.filter((entry) => entry.repository === current.fullName).map((entry) => <p key={entry.projectId} className="text-xs text-muted-foreground">Zugeordnet: {overview.data?.projects.find((p) => p.id === entry.projectId)?.name ?? entry.projectId}</p>)}{message && <p role="status" className="text-xs">{message}</p>}</div>
            {snapshot.isLoading && <p className="text-sm text-muted-foreground">Repository-Daten werden geladen…</p>}
            {snapshot.error && <p role="alert" className="text-sm text-destructive">{snapshot.error.message}{data ? ' Angezeigt wird der letzte erfolgreiche Abruf.' : ''}</p>}
            {data && <>
              {data.unavailable.length > 0 && <p role="status" className="text-xs text-amber-400">Nicht verfügbar: {data.unavailable.join(', ')}. Fehlende Daten gelten nicht als erfolgreiche Prüfung.</p>}
              {sha && <div className="space-y-1 rounded-lg border border-emerald-500/30 p-3 text-xs"><p className="break-all">Ausgewählter Deployment-Commit: <code>{sha}</code></p><p>{data.runs === null ? 'Actions-Daten nicht verfügbar.' : data.runs.some((run) => run.sha === sha) ? 'Actions-Läufe mit exakt gleichem Commit sind markiert.' : 'Kein Actions-Lauf mit diesem Commit im geladenen Ausschnitt gefunden.'}</p></div>}
              <div className="grid min-w-0 gap-4 lg:grid-cols-2"><List title="Branches" items={data.branches} sha={sha} /><List title="Commits des Standardbranches" items={data.commits} sha={sha} /><List title="Offene Issues" items={data.issues} /><List title="Offene Pull Requests" items={data.pulls} /><List title="GitHub Actions" items={data.runs} sha={sha} /><List title="Releases" items={data.releases} /></div>
              <p className="text-xs text-muted-foreground">Abruf: {new Date(data.checkedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}. Je Bereich bis zu {data.limit} Einträge, keine vollständigen Gesamtzahlen. Die Issues-Liste kann weniger Einträge enthalten, weil GitHub dort auch Pull Requests liefert. Nur lesender Zugriff auf GitHub.</p>
            </>}
            <Link to="/deployments" className="inline-block text-xs underline underline-offset-4">Deployment-Zentrale öffnen</Link>
          </>}
        </>}
      </>}
    </CardContent>
  </Card>
}
