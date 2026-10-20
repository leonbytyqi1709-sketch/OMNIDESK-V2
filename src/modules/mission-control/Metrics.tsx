import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Link } from 'react-router'
import { NeonHistoryChart } from '@/components/integrations/NeonHistoryChart'
import type { MissionMonitor, MissionSnapshot } from '@/types/mission-control'
const time = (at: string) =>
  new Date(at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })
function ResponseHistory({ monitor }: { monitor: MissionMonitor }) {
  const points = monitor.recentChecks.filter((p) =>
    Number.isFinite(Date.parse(p.at)),
  )
  const valid = points.filter(
    (p) =>
      p.status === 'up' && p.responseTimeMs !== null && p.responseTimeMs >= 0,
  )
  const start = points.length ? Date.parse(points[0].at) : 0,
    end = points.length ? Date.parse(points[points.length - 1].at) : 1
  const max = Math.max(1, ...valid.map((p) => p.responseTimeMs!))
  const segments: string[][] = []
  let segment: string[] = [],
    last: number | null = null
  for (const p of points) {
    const at = Date.parse(p.at)
    if (
      p.status !== 'up' ||
      p.responseTimeMs == null ||
      (last !== null && at - last > 15 * 60_000)
    ) {
      if (segment.length) segments.push(segment)
      segment = []
    }
    if (p.status === 'up' && p.responseTimeMs !== null)
      segment.push(
        `${10 + ((at - start) / Math.max(1, end - start)) * 460},${100 - (p.responseTimeMs / max) * 85}`,
      )
    last = at
  }
  if (segment.length) segments.push(segment)
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold">
        <Link
          to={`/uptime?monitor=${monitor.id}`}
          className="text-primary hover:underline"
        >
          {monitor.name} →
        </Link>
      </h3>
      <p className="text-xs text-muted-foreground">
        Letzte 24 Stunden · maximal 288 vorhandene Prüfungen ·{' '}
        {monitor.sampleCount} Messungen ·{' '}
        {monitor.sampleCount
          ? `${((monitor.upCount / monitor.sampleCount) * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} % davon erfolgreich`
          : 'Erfolg unbekannt'}
        . Keine Aussage über unbeobachtete Zeiten.
      </p>
      {valid.length ? (
        <>
          <svg
            viewBox="0 0 480 120"
            role="img"
            aria-label={`Gemessene Antwortzeiten für ${monitor.name}, bis ${Math.round(max)} Millisekunden`}
            className="h-32 w-full text-primary"
          >
            <line
              x1="10"
              x2="470"
              y1="100"
              y2="100"
              stroke="currentColor"
              opacity=".2"
            />
            {segments.map((s, i) => (
              <polyline
                key={i}
                points={s.join(' ')}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            ))}
            {valid.map((p, i) => (
              <circle
                key={i}
                cx={
                  10 +
                  ((Date.parse(p.at) - start) / Math.max(1, end - start)) * 460
                }
                cy={100 - (p.responseTimeMs! / max) * 85}
                r="2"
                fill="currentColor"
              >
                <title>
                  {time(p.at)} · {p.responseTimeMs} ms
                </title>
              </circle>
            ))}
          </svg>
          <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            <span>{time(points[0].at)}</span>
            <span>Skala 0–{Math.round(max)} ms</span>
            <span>{time(points[points.length - 1].at)}</span>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Keine erfolgreichen Antwortzeitmessungen in diesem Ausschnitt.
        </p>
      )}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">
          Prüfungen und Ausfälle als Tabelle
        </summary>
        <div className="mt-2 max-h-56 overflow-auto">
          <table className="w-full text-left">
            <caption className="sr-only">
              Gespeicherte Uptime-Prüfungen für {monitor.name}
            </caption>
            <thead>
              <tr>
                <th className="p-2">Zeit (Berlin)</th>
                <th className="p-2">Status</th>
                <th className="p-2">Antwortzeit</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p, i) => (
                <tr key={i}>
                  <td className="p-2">{time(p.at)}</td>
                  <td
                    className={`p-2 ${p.status === 'down' ? 'text-rose-400' : ''}`}
                  >
                    {p.status === 'down' ? 'Nicht erreichbar' : 'Erreichbar'}
                  </td>
                  <td className="p-2">
                    {p.responseTimeMs == null
                      ? 'Nicht verfügbar'
                      : `${p.responseTimeMs} ms`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="text-xs text-muted-foreground">
        Fehlende/fehlgeschlagene Latenzen und Lücken über 15 Minuten werden
        nicht durch Linien überbrückt.
      </p>
    </div>
  )
}
export function MissionMetrics({ snapshot }: { snapshot: MissionSnapshot }) {
  const state = snapshot.monitoring.data,
    monitors = snapshot.uptime.data?.monitors ?? []
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="text-base">
          Messverlauf im Projekt
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {monitors.map((m) => (
          <ResponseHistory key={m.id} monitor={m} />
        ))}
        {!monitors.length && (
          <p className="text-sm text-muted-foreground">
            Noch keine verknüpften Uptime-Messungen. Ordne oben einen eigenen
            Monitor zu.
          </p>
        )}
        {state && state.history.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            <NeonHistoryChart
              points={state.history}
              metric="storageGiB"
              label="Neon-Projektspeicher"
              unit="GiB"
              bucketMs={
                Math.max(state.settings.intervalMinutes * 60, 300) * 1000
              }
            />
            <NeonHistoryChart
              points={state.history}
              metric="computeHours"
              label="Neon-Compute-Verbrauch im Abrechnungszeitraum"
              unit="CU-h"
              bucketMs={
                Math.max(state.settings.intervalMinutes * 60, 300) * 1000
              }
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Neon-Verbrauchswerte gelten für das gesamte zugeordnete Neon-Projekt;
          sie sind keine Messung der aktiven Datenbankverbindungen.
        </p>
      </CardContent>
    </Card>
  )
}
