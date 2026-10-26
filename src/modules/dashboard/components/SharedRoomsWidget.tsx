import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { NavLink } from 'react-router'
import { UsersRound } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useApiFetch } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import type { SharedRoom } from '@/types/shared-rooms'
import { WidgetCard } from './WidgetCard'

const ROLE_LABELS: Record<SharedRoom['role'], string> = {
  owner: 'Raumleitung',
  editor: 'Bearbeiter',
  reader: 'Leser',
}

/**
 * Verbleibende Laufzeit in lesbarer Form. Räume laufen bewusst ab; ohne diese
 * Angabe fällt erst beim Öffnen auf, dass ein Raum bald schließt.
 */
function remaining(expiresAt: string, now: number) {
  const minutes = Math.round((Date.parse(expiresAt) - now) / 60_000)
  if (!Number.isFinite(minutes)) return { label: 'Ablauf unbekannt', urgent: true }
  if (minutes < 60)
    return { label: `noch ${Math.max(minutes, 0)} Min.`, urgent: true }
  const hours = Math.round(minutes / 60)
  if (hours < 24) return { label: `noch ${hours} Std.`, urgent: hours <= 6 }
  const days = Math.round(hours / 24)
  return { label: `noch ${days} Tage`, urgent: false }
}

/**
 * Laufende gemeinsame Räume mit ihrer Restlaufzeit.
 *
 * Gezeigt werden ausschließlich Räume, die weder geschlossen noch abgelaufen
 * sind – geschlossene bleiben im Modul sichtbar, gehören aber nicht auf das
 * Dashboard.
 */
export function SharedRoomsWidget() {
  const api = useApiFetch()
  const { userId } = useAuth()
  const now = Date.now()

  const { data, isLoading, error } = useQuery({
    queryKey: ['shared-rooms', userId],
    queryFn: () => api<SharedRoom[]>('/api/shared-rooms'),
    enabled: Boolean(userId),
    retry: false,
  })

  const openRooms = (data ?? [])
    .filter((room) => room.active && !room.closed)
    .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt))

  return (
    <WidgetCard
      title={`Gemeinsame Räume (${openRooms.length})`}
      icon={UsersRound}
      to="/shared-rooms"
    >
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-8 rounded-md" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-muted-foreground">
          Räume konnten nicht geladen werden. Daraus folgt nicht, dass keine
          offenen Räume bestehen.
        </p>
      ) : openRooms.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Kein laufender Raum.{' '}
          <NavLink
            to="/shared-rooms"
            className="text-foreground underline underline-offset-4"
          >
            Raum anlegen
          </NavLink>
        </p>
      ) : (
        <ul className="-mx-2">
          {openRooms.slice(0, 4).map((room) => {
            const time = remaining(room.expiresAt, now)
            return (
              <li key={room.id}>
                <NavLink
                  to={`/shared-rooms?room=${encodeURIComponent(room.id)}`}
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {room.title}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {ROLE_LABELS[room.role]}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                      time.urgent
                        ? 'border border-amber-500/50 bg-amber-500/15 text-amber-300'
                        : 'border border-border bg-secondary text-muted-foreground',
                    )}
                  >
                    {time.label}
                  </span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      )}
    </WidgetCard>
  )
}
