import type {
  MissionAnalysis,
  MissionFact,
  MissionSnapshot,
  MissionStatus,
} from '../types/mission-control'

export const missionLabels: Record<MissionStatus, string> = {
  ok: 'Unauffällig im erfassten Umfang',
  attention: 'Aufmerksamkeit nötig',
  unknown: 'Lage unvollständig',
}
export function missionFresh(
  at: string | null | undefined,
  minutes: number,
  now: number,
) {
  if (!at) return false
  const age = now - Date.parse(at)
  return Number.isFinite(age) && age >= -60_000 && age <= minutes * 60_000
}
export function missionHref(projectId: string, section?: string) {
  return `/projects?project=${encodeURIComponent(projectId)}${section ? `#${section}` : ''}`
}
/** Unknown, stale and absent data never count as a successful check. No inferred causality. */
export function analyzeMission(
  snapshot: MissionSnapshot,
  now = Date.now(),
): MissionAnalysis {
  const { project, tasks, github, deployment, neon, monitoring, uptime } =
    snapshot
  const facts: MissionFact[] = [],
    events: MissionFact[] = [],
    gaps: string[] = []
  const connections: MissionAnalysis['connections'] = [],
    nextSteps: MissionAnalysis['nextSteps'] = []
  const projectHref = missionHref(project.id)
  const add = (fact: MissionFact) => {
    facts.push(fact)
    return fact
  }
  for (const [label, source] of [
    ['Aufgaben', tasks],
    ['GitHub', github],
    ['Vercel', deployment],
    ['Neon', neon],
    ['Neon-Historie', monitoring],
    ['Uptime', uptime],
  ] as const) {
    if (source.state !== 'ready' || source.data === null)
      gaps.push(`${label}: ${source.message || 'Keine Daten verfügbar.'}`)
  }
  const taskData = tasks.state === 'ready' ? tasks.data : null
  if (taskData) {
    const open = taskData.filter((t) => t.status !== 'done'),
      high = open.filter((t) => t.priority === 'high')
    add({
      id: 'tasks',
      title: `${open.length} offene Projektaufgaben`,
      detail: `${high.length} mit hoher Priorität. Persönliche Aufgaben ohne Projektbindung sind nicht enthalten.`,
      source: 'Projektboard',
      at: snapshot.fetchedAt,
      href: projectHref,
      status: high.length ? 'attention' : 'ok',
    })
    for (const task of taskData.slice(0, 10))
      events.push({
        id: `task-${task.id}`,
        title: task.title,
        detail: `Aufgabe zuletzt geändert · ${task.status}`,
        at: task.updatedAt,
        href: missionHref(project.id, `project-task-${task.id}`),
        status:
          task.status !== 'done' && task.priority === 'high'
            ? 'attention'
            : 'ok',
        source: 'Projektboard',
      })
    if (high[0])
      nextSteps.push({
        title: `Priorisierte Aufgabe prüfen: ${high[0].title}`,
        href: missionHref(project.id, `project-task-${high[0].id}`),
      })
  }
  const gh = github.state === 'ready' ? github.data : null
  if (gh) {
    const current = missionFresh(gh.checkedAt, 10, now)
    if (!current)
      gaps.push(
        'GitHub-Abruf ist älter als zehn Minuten oder hat keinen gültigen Zeitstempel.',
      )
    if (gh.unavailable.length)
      gaps.push(
        `GitHub teilweise nicht verfügbar: ${gh.unavailable.join(', ')}.`,
      )
    if (gh.runs === null || !gh.runs.length)
      gaps.push(
        'Keine Actions-Läufe im abgefragten Ausschnitt; CI-Erfolg ist unbekannt.',
      )
    // Only the latest run per workflow (title) and branch is used; an old failed rerun is not current CI.
    const latest = new Map<string, NonNullable<typeof gh.runs>[number]>()
    for (const run of [...(gh.runs ?? [])].sort(
      (a, b) => Date.parse(b.updatedAt ?? '') - Date.parse(a.updatedAt ?? ''),
    )) {
      const key = `${run.title}:${run.branch ?? ''}`
      if (!latest.has(key)) latest.set(key, run)
    }
    const failed = [...latest.values()].filter((r) =>
      ['failure', 'timed_out', 'action_required'].includes(r.status),
    )
    const pending = [...latest.values()].some(
      (r) => !['success', 'skipped', 'neutral'].includes(r.status),
    )
    add({
      id: 'github',
      title: failed.length
        ? `${failed.length} letzte Actions-Läufe auffällig`
        : 'GitHub-Repository',
      detail: `${gh.repository.fullName} · ${gh.runs?.length ?? 0} Actions-Läufe im Ausschnitt; keine vollständige CI-Abdeckung.`,
      source: 'GitHub API',
      at: gh.checkedAt,
      href: `${projectHref}#mission-github`,
      status: !current
        ? 'unknown'
        : failed.length
          ? 'attention'
          : !current || pending || !gh.runs?.length || gh.unavailable.length
            ? 'unknown'
            : 'ok',
    })
    for (const [kind, list] of [
      ['Commit', gh.commits],
      ['Action', gh.runs],
      ['Release', gh.releases],
      ['Pull Request', gh.pulls],
      ['Issue', gh.issues],
    ] as const) {
      for (const item of (list ?? []).slice(0, 5))
        events.push({
          id: `github-${kind}-${item.id}`,
          title: item.title,
          detail: `${kind} · ${item.status}`,
          at: item.updatedAt,
          href: safeMissionUrl(item.url) ?? `${projectHref}#mission-github`,
          source: 'GitHub API',
          status:
            kind === 'Action' &&
            ['failure', 'timed_out', 'action_required'].includes(item.status)
              ? 'attention'
              : 'ok',
        })
    }
    if (failed[0])
      nextSteps.push({
        title: 'Fehlgeschlagenen Workflow und Build-Logs prüfen',
        href: safeMissionUrl(failed[0].url) ?? `${projectHref}#mission-github`,
      })
  }
  const dep = deployment.state === 'ready' ? deployment.data : null
  if (dep) {
    const current = missionFresh(dep.checkedAt, 10, now)
    if (!current)
      gaps.push(
        'Vercel-Abruf ist älter als zehn Minuten oder hat keinen gültigen Zeitstempel.',
      )
    if (dep.unavailable.length)
      gaps.push(
        `Vercel teilweise nicht verfügbar: ${dep.unavailable.join(', ')}.`,
      )
    const last = [...(dep.deployments ?? [])].sort(
      (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
    )[0]
    const bad =
      dep.production?.state === 'ERROR' ||
      dep.production?.state === 'BLOCKED' ||
      last?.state === 'ERROR' ||
      last?.state === 'BLOCKED'
    add({
      id: 'deployment',
      title: `Produktion: ${dep.production?.state ?? 'unbekannt'}`,
      detail: `Letztes Deployment: ${last?.state ?? 'keine Historie'}${last ? ` (${last.target})` : ''}. Ein bereites Deployment belegt keine Erreichbarkeit.`,
      at: dep.checkedAt,
      href: `${projectHref}#mission-deployment`,
      source: 'Vercel API',
      status: !current
        ? 'unknown'
        : bad
          ? 'attention'
          : current &&
              dep.production?.state === 'READY' &&
              !dep.unavailable.length &&
              last?.state === 'READY'
            ? 'ok'
            : 'unknown',
    })
    for (const item of (dep.deployments ?? []).slice(0, 10))
      events.push({
        id: `deployment-${item.id}`,
        title: item.commit.message || item.id,
        detail: `${item.target} · ${item.state} · ${item.commit.sha?.slice(0, 8) ?? 'ohne Commit'}`,
        at:
          item.createdAt == null
            ? null
            : new Date(item.createdAt).toISOString(),
        href: `${projectHref}#mission-deployment`,
        source: 'Vercel API',
        status: ['ERROR', 'BLOCKED'].includes(item.state) ? 'attention' : 'ok',
      })
    if (bad)
      nextSteps.push({
        title: 'Deployment-Fehler in den vorhandenen Build-Logs prüfen',
        href: `${projectHref}#mission-deployment`,
      })
    const prod = dep.production
    // Explicit GitHub mapping must match the repository reported by Vercel, then exact SHA.
    if (
      gh &&
      prod?.commit.sha &&
      gh.repository.fullName.toLowerCase() ===
        dep.githubRepository?.toLowerCase()
    ) {
      const runs = (gh.runs ?? []).filter((r) => r.sha === prod.commit.sha)
      if (runs.length)
        connections.push({
          title: 'Deployment und GitHub verwenden denselben Commit',
          detail: `Produktion ${prod.commit.sha.slice(0, 8)} ist ${runs.length} Actions-Läufen im Ausschnitt zugeordnet. Das ist ein Identitätsnachweis, keine Ursachenanalyse.`,
          evidence: ['deployment', 'github'],
        })
    } else if (
      gh &&
      dep.githubRepository &&
      gh.repository.fullName.toLowerCase() !==
        dep.githubRepository.toLowerCase()
    )
      gaps.push(
        'GitHub- und Vercel-Repository stimmen nicht überein; Commit-Zusammenhänge werden nicht gebildet.',
      )
  }
  const ns = neon.state === 'ready' ? neon.data : null
  if (ns) {
    const current = missionFresh(ns.checkedAt, 10, now)
    if (!current)
      gaps.push(
        'Neon-Abruf ist älter als zehn Minuten oder hat keinen gültigen Zeitstempel.',
      )
    if (ns.unavailable.length)
      gaps.push(`Neon teilweise nicht verfügbar: ${ns.unavailable.join(', ')}.`)
    const endpoints = ns.endpoints
    const bad = endpoints?.some(
      (e) => e.disabled || ['failed', 'error'].includes(e.state),
    )
    const known =
      ns.branch &&
      ['ready', 'active', 'idle', 'suspended'].includes(ns.branch.state) &&
      endpoints?.length &&
      endpoints.every(
        (e) =>
          !e.pendingState && ['active', 'idle', 'suspended'].includes(e.state),
      )
    add({
      id: 'neon',
      title: `Neon: ${ns.branch?.state ?? 'unbekannter Branchzustand'}`,
      detail: `${ns.project?.name ?? 'Projekt unbekannt'} · ${endpoints?.length ?? 'unbekannte Anzahl'} Compute-Endpunkte. Ruhende Computes sind kein Ausfall; Verwaltungsstatus ist kein SQL-Test.`,
      source: 'Neon API',
      at: ns.checkedAt,
      href: `${projectHref}#mission-neon`,
      status: !current
        ? 'unknown'
        : bad
          ? 'attention'
          : current && known && !ns.unavailable.length
            ? 'ok'
            : 'unknown',
    })
  }
  const mon = monitoring.state === 'ready' ? monitoring.data : null
  if (mon) {
    if (mon.setupRequired)
      gaps.push('Neon-Monitoring wurde noch nicht eingerichtet.')
    if (!mon.settings.enabled)
      gaps.push('Automatische Neon-Prüfungen sind deaktiviert.')
    if (
      !missionFresh(
        mon.lastSuccessAt,
        Math.max(mon.settings.intervalMinutes, mon.schedulerIntervalMinutes) *
          2,
        now,
      )
    )
      gaps.push('Gespeicherte Neon-Messung fehlt oder ist veraltet.')
    const alerts = mon.alerts.filter((a) => !a.resolvedAt)
    add({
      id: 'neon-alerts',
      title: `${alerts.length} offene Neon-Warnungen`,
      detail:
        'Quittierte Warnungen bleiben bis zur gemessenen Auflösung offen.',
      at: mon.lastSuccessAt,
      href: `${projectHref}#mission-neon`,
      source: 'Gespeichertes Neon-Monitoring',
      status: alerts.length
        ? 'attention'
        : mon.setupRequired ||
            !mon.settings.enabled ||
            !missionFresh(
              mon.lastSuccessAt,
              Math.max(
                mon.settings.intervalMinutes,
                mon.schedulerIntervalMinutes,
              ) * 2,
              now,
            )
          ? 'unknown'
          : 'ok',
    })
    for (const alert of mon.alerts)
      events.push({
        id: `alert-${alert.id}`,
        title: alert.message,
        detail: `Neon-Warnung ${alert.resolvedAt ? 'aufgelöst' : 'offen'}${alert.acknowledgedAt ? ' · quittiert' : ''}`,
        at: alert.resolvedAt ?? alert.startedAt,
        source: 'Neon-Warnungsverlauf',
        href: `${projectHref}#mission-neon`,
        status: alert.resolvedAt ? 'ok' : 'attention',
      })
    if (alerts.length)
      nextSteps.push({
        title: 'Offene Neon-Warnungen und Messhistorie prüfen',
        href: `${projectHref}#mission-neon`,
      })
    // Available samples do not include database connection counts. Never fabricate the requested example.
    const prod = dep?.production
    if (prod?.createdAt != null) {
      const alert = alerts.find((a) => {
        const delta = Date.parse(a.startedAt) - prod.createdAt!
        return delta >= 0 && delta <= 60 * 60_000
      })
      if (alert)
        connections.push({
          title: 'Zeitliche Nähe zum Produktionsdeployment',
          detail:
            'Eine offene Neon-Warnung begann innerhalb einer Stunde nach der Erstellung des Produktionsdeployments. Der Erstellungszeitpunkt ist kein bestätigter Go-live-Zeitpunkt. Die zeitliche Nähe belegt keine Ursache.',
          evidence: ['deployment', 'neon-alerts'],
        })
    }
  }
  const up = uptime.state === 'ready' ? uptime.data : null
  if (up) {
    if (up.missingMonitors)
      gaps.push(
        `${up.missingMonitors} zugeordnete Monitore wurden gelöscht oder sind nicht mehr zugänglich.`,
      )
    const monitors = up.monitors.filter((m) => m.linked)
    if (!monitors.length)
      gaps.push(
        'Keine Uptime-Monitore mit diesem Projekt verbunden. Direkt im Cockpit zuordnen.',
      )
    for (const m of monitors) {
      const current = missionFresh(m.checkedAt, 15, now)
      add({
        id: `uptime-${m.id}`,
        title: m.name,
        detail: !m.active
          ? 'Pausiert; keine aktuelle Verfügbarkeitsaussage.'
          : !current
            ? `Messung fehlt oder älter als 15 Minuten. Letzter Zustand: ${m.status ?? 'unbekannt'}.`
            : `${m.status ?? 'unbekannt'} · ${m.responseTimeMs == null ? 'keine Latenzmessung' : `${m.responseTimeMs} ms`}`,
        at: m.checkedAt,
        href: `/uptime?monitor=${encodeURIComponent(m.id)}`,
        source: 'Uptime-Check',
        status:
          !m.active || !current || !m.status
            ? 'unknown'
            : m.status === 'down'
              ? 'attention'
              : 'ok',
      })
      if (!m.active || !current || !m.status)
        gaps.push(`Uptime ${m.name}: keine aktuelle aktive Prüfung.`)
      if (m.checkedAt)
        events.push({ ...facts[facts.length - 1], id: `check-${m.id}` })
    }
  }
  const productionAt = dep?.production?.createdAt
  if (
    up &&
    productionAt != null &&
    Number.isFinite(productionAt) &&
    productionAt <= now
  ) {
    const median = (values: number[]) => {
      const ordered = [...values].sort((a, b) => a - b),
        mid = Math.floor(ordered.length / 2)
      return ordered.length % 2
        ? ordered[mid]
        : (ordered[mid - 1] + ordered[mid]) / 2
    }
    for (const m of up.monitors) {
      const usable = m.recentChecks.filter(
        (c) =>
          c.status === 'up' &&
          c.responseTimeMs !== null &&
          c.responseTimeMs >= 0 &&
          Number.isFinite(Date.parse(c.at)) &&
          Date.parse(c.at) <= now,
      )
      const before = usable
        .filter(
          (c) =>
            Date.parse(c.at) >= productionAt - 3600_000 &&
            Date.parse(c.at) < productionAt,
        )
        .map((c) => c.responseTimeMs!)
      const after = usable
        .filter(
          (c) =>
            Date.parse(c.at) >= productionAt &&
            Date.parse(c.at) <= productionAt + 3600_000,
        )
        .map((c) => c.responseTimeMs!)
      if (before.length < 3 || after.length < 3) continue
      const beforeMs = median(before),
        afterMs = median(after)
      if (afterMs > beforeMs * 1.25 && afterMs - beforeMs > 50)
        connections.push({
          title: `Höhere gemessene Antwortzeiten: ${m.name}`,
          detail: `Im Zeitfenster von jeweils einer Stunde vor/nach Erstellung des Produktionsdeployments liegt der Median der erfolgreichen Prüfungen bei ${Math.round(beforeMs)} ms (${before.length} Messungen) bzw. ${Math.round(afterMs)} ms (${after.length} Messungen). Ausfälle sind separat zu prüfen. Deployment-Erstellung ist kein bestätigter Go-live-Zeitpunkt; dies belegt keine Ursache.`,
          evidence: ['deployment', `uptime-${m.id}`],
        })
    }
  }
  if (!connections.length)
    connections.push({
      title: 'Kein belastbarer Zusammenhang im geladenen Ausschnitt',
      detail:
        'Ohne passende Projektbindungen, Commit-IDs und Zeitstempel lässt sich kein Zusammenhang belegen. Messreihen zu Datenbankverbindungen liegen hier nicht vor; vorhandene Uptime-Ausschnitte sind im Messverlauf einsehbar.',
      evidence: [],
    })
  if (gaps.length)
    nextSteps.push({
      title: 'Fehlende Verbindungen und Datenfrische im Projekt prüfen',
      href: projectHref,
    })
  const status = facts.some((f) => f.status === 'attention')
    ? 'attention'
    : gaps.length || !facts.length || facts.some((f) => f.status === 'unknown')
      ? 'unknown'
      : 'ok'
  return {
    status,
    facts,
    gaps,
    connections,
    nextSteps: nextSteps.slice(0, 4),
    events: events
      .filter((e) => e.at && Number.isFinite(Date.parse(e.at)))
      .sort((a, b) => Date.parse(b.at!) - Date.parse(a.at!))
      .slice(0, 25),
  }
}
export function safeMissionUrl(value: string | null | undefined) {
  if (!value) return null
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\'))
    return value
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}
