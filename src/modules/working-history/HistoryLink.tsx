import { History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { HistoryKind } from '@/types/working-history'
export function HistoryLink({
  kind,
  id,
  compact = false,
  disabled = false,
}: {
  kind: HistoryKind
  id: string
  compact?: boolean
  disabled?: boolean
}) {
  if (disabled)
    return (
      <Button variant="outline" size="sm" disabled>
        <History className="size-4" />
        Verlauf
      </Button>
    )
  return (
    <Button variant="outline" size="sm" asChild>
      <a
        href={'/working-history?kind=' + kind + '&object=' + id}
        target="_blank"
        rel="noreferrer"
        aria-label="Verlauf in neuem Tab öffnen"
      >
        <History className="size-4" />
        {!compact && 'Verlauf'}
      </a>
    </Button>
  )
}
