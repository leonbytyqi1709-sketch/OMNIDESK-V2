import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { CheckSquare, FolderKanban, History, Minus } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { FOCUS_LABEL, type FocusKind, formatDuration } from '@/lib/focus'
import { cn } from '@/lib/utils'
import { useFocusSummary } from '../api'

const WEEKDAY = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

const TARGET_PATH: Record<FocusKind, (id: string) => string> = {
  task: (id) => `/tasks?task=${id}`,
  projectTask: () => '/projects',
  project: (id) => `/projects?project=${id}`,
}

/** Die letzten sieben Tage: Gesamtzeit, Verlauf und Zeit je Ziel. */
export function FocusReview() {
  const { data, isLoading } = useFocusSummary(7)
  const navigate = useNavigate()

  // Lücken auffüllen: Tage ohne Fokuszeit sollen als leere Säule erscheinen.
  const week = useMemo(() => {
    const byDate = new Map((data?.days ?? []).map((entry) => [entry.date, entry.seconds]))
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - index))
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      return { key, label: WEEKDAY[date.getDay()], seconds: byDate.get(key) ?? 0 }
    })
  }, [data])

  const peak = Math.max(1, ...week.map((day) => day.seconds))

  if (isLoading)
    return <Skeleton className="h-40 w-full max-w-xl rounded-xl" />

  return (
    <div className="w-full max-w-xl space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <History className="size-3.5" />
          Letzte sieben Tage
        </h2>
        <span className="text-sm font-semibold text-foreground">
          {formatDuration(data?.seconds ?? 0)}
          {data && data.sessions > 0 && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              in {data.sessions} {data.sessions === 1 ? 'Block' : 'Blöcken'}
            </span>
          )}
        </span>
      </div>

      <div className="flex h-20 items-end gap-1.5">
        {week.map((day) => (
          <div key={day.key} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={cn(
                'w-full rounded-t transition-all',
                day.seconds > 0 ? 'bg-gradient-accent' : 'bg-secondary',
              )}
              style={{ height: `${Math.max(3, (day.seconds / peak) * 60)}px` }}
              title={`${day.label}: ${formatDuration(day.seconds)}`}
            />
            <span className="text-[10px] text-muted-foreground">{day.label}</span>
          </div>
        ))}
      </div>

      {!data || data.totals.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Noch keine Fokuszeit erfasst. Wähl oben ein Ziel und starte den Timer – ab einer Minute
          wird der Block festgehalten.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {data.totals.slice(0, 6).map((total) => {
            const Icon =
              total.kind === 'project' ? FolderKanban : total.kind ? CheckSquare : Minus
            const share = data.seconds > 0 ? (total.seconds / data.seconds) * 100 : 0
            const path = total.kind && total.id ? TARGET_PATH[total.kind](total.id) : null
            return (
              <li key={`${total.kind ?? 'none'}:${total.id ?? 'none'}`} className="text-xs">
                <div className="flex items-center gap-2">
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                  {path ? (
                    <button
                      type="button"
                      onClick={() => navigate(path)}
                      className="min-w-0 flex-1 truncate text-left font-medium text-foreground hover:underline"
                    >
                      {total.title}
                    </button>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {total.title}
                    </span>
                  )}
                  <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                    {formatDuration(total.seconds)}
                  </span>
                </div>
                <div className="mt-1 ml-5.5 h-1 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary/70" style={{ width: `${share}%` }} />
                </div>
                {total.kind && (
                  <span className="sr-only">{FOCUS_LABEL[total.kind]}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
