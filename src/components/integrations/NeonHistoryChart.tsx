import { useId } from 'react'
import type { NeonHistoryPoint } from '@/types/neon-monitoring'
export function NeonHistoryChart({ points, metric, label, unit, bucketMs }: {
  points: NeonHistoryPoint[]; metric: 'storageGiB' | 'branchGiB' | 'computeHours' | 'transferGiB' | 'sqlLatencyMs'; label: string; unit: string; bucketMs: number
}) {
  const title = useId()
  const available = points.filter((point) => point[metric] != null)
  if (!available.length) return <div className="rounded-lg border border-border/60 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-3 text-sm">Noch keine Messwerte verfügbar.</p></div>
  const timestamps = points.map((point) => Date.parse(point.at))
  const from = Math.min(...timestamps)
  const to = Math.max(...timestamps)
  const maximum = Math.max(...available.map((point) => point[metric]!), 0.001)
  const x = (point: NeonHistoryPoint) => 38 + (Date.parse(point.at) - from) / Math.max(to - from, bucketMs) * 440
  const y = (point: NeonHistoryPoint) => 120 - point[metric]! / maximum * 95
  let path = ''
  let previous: NeonHistoryPoint | null = null
  for (const point of points) {
    if (point[metric] == null) { previous = null; continue }
    const connected = previous && Date.parse(point.at) - Date.parse(previous.at) <= bucketMs * 1.5 &&
      (!['computeHours', 'transferGiB'].includes(metric) || previous.periodStart === point.periodStart)
    path += `${connected ? 'L' : 'M'}${x(point)},${y(point)} `
    previous = point
  }
  const number = (value: number) => value.toLocaleString('de-DE', { maximumFractionDigits: 3 })
  const date = (value: string) => new Date(value).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })
  return <figure className="min-w-0 rounded-lg border border-border/60 bg-secondary/10 p-3">
    <figcaption className="flex flex-wrap justify-between gap-2 text-xs"><span className="text-muted-foreground">{label}</span><span>{number(available.at(-1)![metric]!)} {unit}</span></figcaption>
    <svg viewBox="0 0 500 150" className="mt-2 w-full text-emerald-400" role="img" aria-labelledby={title}>
      <title id={title}>{label}: {available.length} Zeitbereiche mit Messwerten. Fehlende Messungen werden nicht verbunden.</title>
      <path d="M38 20V120H480" fill="none" stroke="currentColor" opacity="0.2" />
      <text x="0" y="20" fontSize="9" fill="currentColor">{number(maximum)}</text><text x="20" y="122" fontSize="9" fill="currentColor">0</text>
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
      {available.map((point, i) => <circle key={`${point.at}:${i}`} cx={x(point)} cy={y(point)} r="2" fill="currentColor"><title>{date(point.at)}: {number(point[metric]!)} {unit}</title></circle>)}
    </svg>
    <div className="flex justify-between gap-2 text-[10px] text-muted-foreground"><span>{date(points[0].at)}</span><span>{date(points.at(-1)!.at)}</span></div>
  </figure>
}
