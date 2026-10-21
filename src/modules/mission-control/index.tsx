import { useState, useContext, type FormEvent, type ReactNode } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleHelp,
  Crosshair,
  ExternalLink,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useApiFetch } from '@/hooks/use-api'
import {
  useProjects,
  useCreateProjectTask,
  type ProjectDto,
} from '@/modules/projects/api'
import {
  analyzeMission,
  missionHref,
  missionLabels,
  safeMissionUrl,
} from '@/lib/mission-control'
import type {
  MissionFact,
  MissionSnapshot,
  MissionStatus,
} from '@/types/mission-control'
import { useMission, useMissionOverview, MissionVisitContext } from './api'
import { MissionConnections } from './Connections'
import { MissionMetrics } from './Metrics'
import { ProjectBrowserNotes } from '@/modules/browser-desk/ProjectBrowserNotes'

const color: Record<MissionStatus, string> = {
  ok: 'text-emerald-400 border-emerald-500/30',
  attention: 'text-amber-400 border-amber-500/30',
  unknown: 'text-muted-foreground border-border',
}
const icons = {
  ok: CheckCircle2,
  attention: TriangleAlert,
  unknown: CircleHelp,
}
function Status({ status }: { status: MissionStatus }) {
  const Icon = icons[status]
  return (
    <Badge
      variant="outline"
      className={`${color[status]} max-w-full whitespace-normal`}
    >
      <Icon className="size-3 shrink-0" />
      {missionLabels[status]}
    </Badge>
  )
}
function date(at: string | null | undefined) {
  return at && Number.isFinite(Date.parse(at))
    ? new Date(at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })
    : 'Zeitpunkt unbekannt'
}
function SourceLink({
  href,
  children,
  className = '',
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  const target = safeMissionUrl(href)
  if (!target) return <span>{children}</span>
  return target.startsWith('/') ? (
    <Link to={target} className={className}>
      {children}
    </Link>
  ) : (
    <a href={target} target="_blank" rel="noreferrer" className={className}>
      {children}
      <ExternalLink className="ml-1 inline size-3" />
    </a>
  )
}
function ProjectCard({
  project,
  selected,
  onSelect,
}: {
  project: ProjectDto
  selected: boolean
  onSelect: () => void
}) {
  const query = useMission(project.id)
  const analysis = query.data ? analyzeMission(query.data) : null
  const status = query.error ? 'unknown' : (analysis?.status ?? 'unknown')
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary ${selected ? 'border-primary/60 bg-primary/10 shadow-lg shadow-primary/5' : 'border-border bg-card hover:border-primary/40'}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h2 className="min-w-0 break-words font-semibold">{project.name}</h2>
        <ArrowRight className="size-4 shrink-0 text-primary" />
      </div>
      <Status status={status} />
      <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
        {query.isPending
          ? 'Projektquellen werden geprüft…'
          : query.error
            ? `Abruf fehlgeschlagen: ${query.error.message}`
            : `${analysis?.facts.filter((f) => f.status === 'attention').length ?? 0} Auffälligkeiten · ${analysis?.gaps.length ?? 0} Datenlücken`}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Projekt:{' '}
        {project.status === 'active'
          ? 'aktiv'
          : project.status === 'paused'
            ? 'pausiert'
            : 'abgeschlossen'}{' '}
        ·{' '}
        {query.isFetching
          ? 'Aktualisiert…'
          : `Abruf ${date(query.data?.fetchedAt)}`}
      </p>
    </button>
  )
}
function Fact({ fact }: { fact: MissionFact }) {
  return (
    <div
      id={`evidence-${fact.id}`}
      className="min-w-0 space-y-2 rounded-lg border border-border bg-secondary/20 p-4 target:ring-2 target:ring-primary"
    >
      <SourceLink
        href={fact.href}
        className={`text-sm font-semibold hover:underline ${color[fact.status]}`}
      >
        {fact.title}
      </SourceLink>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {fact.detail}
      </p>
      <p className="text-xs text-muted-foreground">
        {fact.source} · {date(fact.at)}
      </p>
    </div>
  )
}
function CockpitActions({ snapshot }: { snapshot: MissionSnapshot }) {
  const [title, setTitle] = useState(''),
    [checking, setChecking] = useState(false)
  const create = useCreateProjectTask(snapshot.project.id),
    api = useApiFetch(),
    cache = useQueryClient()
  const { userId } = useAuth()
  const monitors =
    snapshot.uptime.data?.monitors.filter((m) => m.active && m.linked) ?? []
  const [monitorId, setMonitorId] = useState('')
  const current = monitors.find((m) => m.id === monitorId) ?? monitors[0]
  async function addTask(event: FormEvent) {
    event.preventDefault()
    if (!title.trim() || create.isPending) return
    try {
      await create.mutateAsync({
        title: title.trim(),
        priority: 'medium',
        status: 'backlog',
      })
      setTitle('')
      toast.success('Aufgabe im Projekt-Backlog erstellt.')
      await cache.invalidateQueries({
        queryKey: ['mission-control', userId, snapshot.project.id],
      })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Aufgabe konnte nicht erstellt werden.',
      )
    }
  }
  async function checkMonitor() {
    if (!current || checking) return
    setChecking(true)
    try {
      await api(`/api/uptime/${encodeURIComponent(current.id)}/check`, {
        method: 'POST',
      })
      toast.success('Uptime-Prüfung abgeschlossen.')
      await Promise.all([
        cache.invalidateQueries({
          queryKey: ['mission-control', userId, snapshot.project.id],
        }),
        cache.invalidateQueries({ queryKey: ['uptime-monitors'] }),
      ])
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Prüfung fehlgeschlagen.',
      )
    } finally {
      setChecking(false)
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="text-base">
          Im Projekt handeln
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => void addTask(e)}
          className="flex flex-wrap gap-2"
        >
          <Input
            aria-label="Neue Projektaufgabe"
            placeholder="Nächster Schritt als Projektaufgabe…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={300}
            required
            className="min-w-0 flex-1 basis-48"
          />
          <Button type="submit" disabled={create.isPending || !title.trim()}>
            Aufgabe erstellen
          </Button>
        </form>
        {current ? (
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Verknüpften Monitor prüfen"
              value={current.id}
              onChange={(e) => setMonitorId(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-border bg-background p-2 text-sm"
            >
              {monitors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              disabled={checking}
              onClick={() => void checkMonitor()}
            >
              <Activity className="size-4" />
              {checking ? 'Prüft…' : 'Uptime jetzt prüfen'}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Für eine direkte Uptime-Prüfung oben einen eigenen aktiven Monitor
            mit diesem Projekt verknüpfen.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Aufgaben landen im Backlog dieses Projekts. Prüfungen starten nur auf
          deinen Klick. Der optionale SQL-Test wird hier nicht gestartet.
        </p>
      </CardContent>
    </Card>
  )
}
function Cockpit({ projectId }: { projectId: string }) {
  const query = useMission(projectId)
  const visitId = useContext(MissionVisitContext)
  const api = useApiFetch(),
    cache = useQueryClient(),
    { userId } = useAuth()
  const [prioritizing, setPrioritizing] = useState(false)
  const [report, setReport] = useState<{
    mode: 'ai' | 'rules'
    factIds: string[]
    generatedAt: string
  } | null>(null)
  async function prioritize() {
    if (prioritizing) return
    setPrioritizing(true)
    try {
      const result = await api<{
        snapshot: MissionSnapshot
        report: NonNullable<typeof report>
      }>(`/api/mission-control/${encodeURIComponent(projectId)}/report`, {
        method: 'POST',
      })
      cache.setQueryData(['mission-control', userId, projectId, visitId], {
        ...result.snapshot,
        comparison: query.data?.comparison,
      })
      setReport(result.report)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Omni-Priorisierung fehlgeschlagen.',
      )
    } finally {
      setPrioritizing(false)
    }
  }
  if (query.isPending)
    return (
      <p role="status" className="p-6 text-sm text-muted-foreground">
        Projekt-Cockpit wird geladen…
      </p>
    )
  if (!query.data)
    return (
      <div role="alert" className="rounded-lg border border-destructive/30 p-4">
        <p>{query.error?.message ?? 'Keine Projektdaten verfügbar.'}</p>
        <Button
          className="mt-3"
          variant="outline"
          onClick={() => void query.refetch()}
        >
          Erneut versuchen
        </Button>
      </div>
    )
  const snapshot = query.data,
    analysis = analyzeMission(snapshot)
  const href = missionHref(projectId)
  const state = snapshot.monitoring.data,
    neon = snapshot.neon.data
  return (
    <div className="min-w-0 space-y-6" aria-label="Projekt-Cockpit">
      <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="mb-1 text-xs uppercase tracking-widest text-primary">
                Projekt-Cockpit
              </p>
              <CardTitle
                role="heading"
                aria-level={2}
                className="break-words text-xl"
              >
                {snapshot.project.name}
              </CardTitle>
            </div>
            <Status status={query.error ? 'unknown' : analysis.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {snapshot.project.description ||
              'Alle ausdrücklich verknüpften Quellen dieses Projekts.'}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Abruf: {date(snapshot.fetchedAt)} (Berlin)</span>
            <Button
              size="sm"
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              <RefreshCw
                className={`size-3 ${query.isFetching ? 'animate-spin' : ''}`}
              />
              Quellen aktualisieren
            </Button>
            <Link className="text-primary hover:underline" to={href}>
              Projekt und Verbindungen öffnen →
            </Link>
          </div>
          {query.error && (
            <p role="alert" className="text-sm text-amber-400">
              Aktualisierung fehlgeschlagen: {query.error.message} Angezeigt
              wird der letzte erfolgreiche Abruf.
            </p>
          )}
        </CardHeader>
      </Card>
      <MissionConnections key={projectId} projectId={projectId} />
      <section aria-label="Quellenstatus" className="grid gap-3 sm:grid-cols-2">
        {analysis.facts.map((fact) => (
          <Fact key={fact.id} fact={fact} />
        ))}
      </section>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="text-base">
            Seit deinem letzten Öffnen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!snapshot.comparison ||
          snapshot.comparison.status === 'unavailable' ? (
            <p className="text-sm text-muted-foreground">
              Besuchsvergleich nicht verfügbar. Der aktuelle Quellenstatus
              bleibt unabhängig davon nutzbar.
            </p>
          ) : snapshot.comparison.status === 'first_visit' ? (
            <p className="text-sm text-muted-foreground">
              Erster erfasster Besuch: Der aktuelle Stand dient künftig als
              Vergleich. Frühere Änderungen werden nicht nachträglich erfunden.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Vergleich mit {date(snapshot.comparison.previousAt)} ·{' '}
                {snapshot.comparison.totalChanges} neue oder veränderte
                Beobachtungen.
              </p>
              {snapshot.comparison.changes.map((change) => (
                <div
                  key={change.id}
                  className="space-y-1 rounded-lg border border-border p-3 text-xs"
                >
                  <SourceLink
                    href={change.href}
                    className="font-semibold text-primary hover:underline"
                  >
                    {change.title}
                  </SourceLink>
                  <p className="break-words text-muted-foreground">
                    Vorher:{' '}
                    {change.before ?? 'Nicht im vorherigen Ausschnitt erfasst'}
                  </p>
                  <p className="break-words">Jetzt: {change.after}</p>
                </div>
              ))}
              {snapshot.comparison.totalChanges === 0 && (
                <p className="text-sm text-muted-foreground">
                  Keine neuen oder veränderten Beobachtungen in den erfassten
                  Quellen.
                </p>
              )}
            </>
          )}
          <p className="text-xs text-muted-foreground">
            Pro Projekt bleiben höchstens zehn Besuchsstände gespeichert;
            parallele Tabs haben einen stabilen Vergleich. Fehlende Einträge in
            begrenzten Listen gelten nicht als Löschung.
          </p>
        </CardContent>
      </Card>
      <Card className="border-primary/25">
        <CardHeader>
          <CardTitle
            role="heading"
            aria-level={2}
            className="flex items-center gap-2 text-base"
          >
            <Bot className="size-5 text-primary" />
            Omni-Lagebericht
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Aus den angezeigten Fakten abgeleitet · funktioniert ohne
            KI-Anbieter · keine automatischen Aktionen
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3 rounded-lg border border-primary/20 p-3">
            <Button
              size="sm"
              variant="outline"
              disabled={prioritizing}
              onClick={() => void prioritize()}
            >
              <Bot className="size-4" />
              {prioritizing
                ? 'Omni priorisiert…'
                : 'Schwerpunkte mit Omni priorisieren'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Optional: Übermittelt die angezeigten Projektfakten an deinen
              vorhandenen KI-Anbieter. Omni wählt bis zu drei belegte
              Schwerpunkte; der Faktenbericht bleibt unverändert.
            </p>
            {report && (
              <div role="status" className="space-y-2 text-xs">
                <p className="text-muted-foreground">
                  {report.mode === 'ai'
                    ? 'KI-Priorisierung'
                    : 'KI nicht verfügbar; regelbasierte Auswahl'}{' '}
                  · {date(report.generatedAt)}
                </p>
                {report.factIds
                  .map((id) => analysis.facts.find((f) => f.id === id))
                  .filter((f): f is MissionFact => Boolean(f))
                  .map((fact) => (
                    <p key={fact.id}>
                      <a
                        href={`#evidence-${fact.id}`}
                        className="text-primary hover:underline"
                      >
                        {fact.title} →
                      </a>
                    </p>
                  ))}
              </div>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">
              Was braucht Aufmerksamkeit?
            </h3>
            {analysis.facts.some((f) => f.status === 'attention') ? (
              <ul className="space-y-2">
                {analysis.facts
                  .filter((f) => f.status === 'attention')
                  .map((f) => (
                    <li key={f.id} className="text-sm">
                      <a
                        href={`#evidence-${f.id}`}
                        className="text-amber-400 hover:underline"
                      >
                        {f.title}
                      </a>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {f.detail}
                      </p>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {analysis.status === 'unknown'
                  ? 'Keine belegte aktuelle Störung im erfassten Ausschnitt. Die Datenlage ist unvollständig.'
                  : 'Die erfassten Quellen zeigen aktuell keine Auffälligkeit. Das ist keine vollständige Betriebsprüfung.'}
              </p>
            )}
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">
              Welche Ereignisse gehören zusammen?
            </h3>
            {analysis.connections.map((connection) => (
              <div
                key={connection.title}
                className="rounded-lg bg-secondary/30 p-3"
              >
                <p className="text-sm font-medium">{connection.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {connection.detail}
                </p>
                {connection.evidence.length > 0 && (
                  <div className="mt-2 flex gap-3">
                    {connection.evidence.map((id) => (
                      <a
                        className="text-xs text-primary hover:underline"
                        key={id}
                        href={`#evidence-${id}`}
                      >
                        Beleg: {analysis.facts.find((f) => f.id === id)?.source}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">
              Sinnvolle nächste Schritte
            </h3>
            {analysis.nextSteps.length ? (
              <ul className="space-y-2">
                {analysis.nextSteps.map((step) => (
                  <li key={step.title} className="text-sm">
                    <SourceLink
                      href={step.href}
                      className="text-primary hover:underline"
                    >
                      {step.title} →
                    </SourceLink>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Offene Projektaufgaben und die jüngsten Ereignisse prüfen.
              </p>
            )}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Zeitliche Nähe beweist keine Ursache. Das Monitoring liefert keine
            Messreihe der Datenbankverbindungen; Aussagen wie „Seit dem
            Deployment steigen die Verbindungen“ sind damit nicht belegt.
            Aktuelle API-Abrufe sind von gespeicherten Messzeitpunkten zu
            unterscheiden.
          </p>
        </CardContent>
      </Card>
      {analysis.gaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle
              role="heading"
              aria-level={2}
              className="flex items-center gap-2 text-base"
            >
              <CircleHelp className="size-4" />
              Verbindungen und Datenlücken
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {analysis.gaps.map((gap, index) => (
                <li key={index}>{gap}</li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              GitHub-Zuordnungen im Projekt speichern. Neon und Vercel verwenden
              ihre vorhandenen serverseitigen Projektzuordnungen; die
              Kontoübersicht allein erstellt keine Zuordnung.
            </p>
            <Link
              to={href}
              className="mt-3 inline-block text-sm text-primary hover:underline"
            >
              Verbindungen im Projekt prüfen →
            </Link>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="text-base">
            Messwerte und Quellen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">
                Neon Branchgröße · {date(neon?.checkedAt)}
              </p>
              <p className="mt-1 font-semibold">
                {neon?.branch?.logicalSizeBytes == null
                  ? 'Nicht verfügbar'
                  : `${(neon.branch.logicalSizeBytes / 1024 ** 3).toLocaleString('de-DE', { maximumFractionDigits: 3 })} GiB`}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">
                Gespeicherte Neon-Messhistorie (24 Stunden)
              </p>
              <p className="mt-1 font-semibold">
                {state
                  ? `${state.history.length} Zeitabschnitte · ${state.history.reduce((sum, h) => sum + h.samples, 0)} Messungen`
                  : 'Nicht verfügbar'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to={`${href}#mission-neon`}
              className="text-primary hover:underline"
            >
              Neon-Messwerte & Historie
            </Link>
            <Link
              to={`${href}#mission-github`}
              className="text-primary hover:underline"
            >
              GitHub-Details & Zuordnung
            </Link>
            <Link
              to={`${href}#mission-deployment`}
              className="text-primary hover:underline"
            >
              Deployment-Details & Logs
            </Link>
          </div>
        </CardContent>
      </Card>
      <MissionMetrics snapshot={snapshot} />
      <ProjectBrowserNotes projectId={projectId} />
      <CockpitActions key={projectId} snapshot={snapshot} />
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="text-base">
            Was hat sich zuletzt verändert?
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Bis zu 25 Ereignisse aus den begrenzten Quellenausschnitten;
            Aufgaben zeigen ihren letzten Änderungszeitpunkt. Kein vollständiges
            Änderungsarchiv.
          </p>
        </CardHeader>
        <CardContent>
          {analysis.events.length ? (
            <ol className="space-y-4 border-l border-primary/20 pl-4">
              {analysis.events.map((event) => (
                <li key={event.id} className="min-w-0 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {date(event.at)} · {event.source}
                  </p>
                  <SourceLink
                    href={event.href}
                    className={`break-words text-sm font-medium hover:underline ${color[event.status]}`}
                  >
                    {event.title}
                  </SourceLink>
                  <p className="text-xs text-muted-foreground">
                    {event.detail}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              Keine datierten Ereignisse im erfassten Ausschnitt verfügbar.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
export default function MissionControlPage() {
  const { userId } = useAuth()
  return userId ? <MissionSession key={userId} /> : null
}
function MissionSession() {
  const [visitId] = useState(() => crypto.randomUUID())
  return (
    <MissionVisitContext.Provider value={visitId}>
      <MissionWorkspace />
    </MissionVisitContext.Provider>
  )
}
function MissionWorkspace() {
  const projects = useProjects(),
    [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(''),
    [scope, setScope] = useState('active'),
    [page, setPage] = useState(0)
  const all = projects.data ?? []
  const filtered = all.filter(
    (p) =>
      (scope === 'all' || p.status === scope) &&
      p.name
        .toLocaleLowerCase('de-DE')
        .includes(search.toLocaleLowerCase('de-DE')),
  )
  const pages = Math.max(1, Math.ceil(filtered.length / 6)),
    currentPage = Math.min(page, pages - 1)
  const visible = filtered.slice(currentPage * 6, currentPage * 6 + 6)
  const overview = useMissionOverview(visible.map((p) => p.id))
  const counts = { attention: 0, unknown: 0, ok: 0, pending: 0 }
  for (const item of overview) {
    if (item.isPending) counts.pending++
    else
      counts[
        item.error || !item.data ? 'unknown' : analyzeMission(item.data).status
      ]++
  }
  const requested = params.get('project'),
    selected = all.find((p) => p.id === requested)?.id ?? visible[0]?.id
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
            <Crosshair className="size-7 text-primary" />
            Mission Control
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Deine Projekte. Ihre Verbindungen. Der nächste sinnvolle Schritt.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/projects">
            Projekte verwalten <ArrowRight className="size-4" />
          </Link>
        </Button>
      </header>
      <div
        className="grid gap-3 sm:grid-cols-3"
        aria-label="Statusübersicht der sichtbaren Projekte"
      >
        {(
          [
            ['attention', 'Benötigen Aufmerksamkeit'],
            ['unknown', 'Lage unvollständig'],
            ['ok', 'Unauffällig im erfassten Umfang'],
          ] as const
        ).map(([key, label]) => (
          <div
            key={key}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className={`text-2xl font-semibold ${color[key]}`}>
              {counts[key]}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
        <p className="text-xs text-muted-foreground sm:col-span-3">
          Diese Zählung gilt für die {visible.length} sichtbaren Projekte auf
          dieser Seite; {counts.pending} werden noch geprüft.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Input
          aria-label="Projekte durchsuchen"
          className="max-w-md"
          placeholder="Projekt suchen…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
        />
        <select
          aria-label="Projektstatus filtern"
          value={scope}
          onChange={(e) => {
            setScope(e.target.value)
            setPage(0)
          }}
          className="rounded-md border border-border bg-background p-2 text-sm"
        >
          <option value="active">Aktive Projekte</option>
          <option value="paused">Pausierte Projekte</option>
          <option value="done">Abgeschlossene Projekte</option>
          <option value="all">Alle Projekte</option>
        </select>
      </div>
      {projects.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Projekte werden geladen…
        </p>
      )}
      {projects.error && (
        <div role="alert" className="space-y-3 text-sm text-destructive">
          <p>Projekte konnten nicht geladen werden: {projects.error.message}</p>
          <Button variant="outline" onClick={() => void projects.refetch()}>
            Erneut versuchen
          </Button>
        </div>
      )}
      {!projects.isPending && !projects.error && !all.length && (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Noch keine Projekte vorhanden.{' '}
            <Link className="text-primary hover:underline" to="/projects">
              Lege im Projektmanagement ein Projekt an
            </Link>{' '}
            und verbinde dort deine Quellen.
          </CardContent>
        </Card>
      )}
      {!projects.isPending && all.length > 0 && (
        <div className="space-y-6">
          <section className="space-y-3" aria-label="Live-Lagebild">
            <p className="text-xs text-muted-foreground">
              {filtered.length} passende Projekte · Quellen der sichtbaren
              Projekte werden alle zwei Minuten abgerufen. Messzeiten stehen an
              den Belegen.
            </p>
            {!visible.length && (
              <p className="text-sm text-muted-foreground">
                Keine Projekte für diesen Filter.
              </p>
            )}
            <div
              className={`grid items-stretch gap-3 ${visible.length > 1 ? 'sm:grid-cols-2' : ''} ${visible.length > 2 ? 'xl:grid-cols-3' : ''}`}
            >
              {visible.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  selected={selected === project.id}
                  onSelect={() => setParams({ project: project.id })}
                />
              ))}
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Zurück
                </Button>
                <span className="text-xs">
                  {currentPage + 1} / {pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage + 1 >= pages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Weiter
                </Button>
              </div>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Unauffällig gilt nur für die erfassten Quellen. Fehlende
              Verbindungen sind kein gesunder Zustand.
            </p>
          </section>
          {selected ? (
            <Cockpit key={selected} projectId={selected} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Wähle ein Projekt im Lagebild.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
