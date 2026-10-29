import { Timer } from 'lucide-react'
import { type FocusKind, formatDuration } from '@/lib/focus'
import { useFocusForTarget } from '../api'

/**
 * Bisher erfasste Fokuszeit an einem Ziel. Bleibt unsichtbar, solange nichts
 * erfasst wurde – ein „0 min“ an jeder Aufgabe wäre nur Rauschen.
 */
export function FocusTotalBadge({ kind, id }: { kind: FocusKind; id: string | null }) {
  const { data } = useFocusForTarget(kind, id)
  if (!data || data.seconds <= 0) return null
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Timer className="size-3.5 text-primary" />
      Fokuszeit: <span className="font-medium text-foreground">{formatDuration(data.seconds)}</span>
      <span>
        in {data.sessions} {data.sessions === 1 ? 'Block' : 'Blöcken'}
      </span>
    </span>
  )
}
