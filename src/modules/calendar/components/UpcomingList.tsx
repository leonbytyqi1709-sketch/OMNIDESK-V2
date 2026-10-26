import { useEffect, useMemo, useState } from 'react'
import { format, isSameDay } from 'date-fns'
import { de } from 'date-fns/locale'
import { ChevronDown, Clock, MapPin, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AppointmentDto } from '../api'
import { PRIORITY_META } from '../constants'

const INITIAL_VISIBLE = 8

interface UpcomingListProps {
  appointments: AppointmentDto[]
  onEdit: (appointment: AppointmentDto) => void
}

/** Zeitraum eines Termins als lesbare Zeile, mehrtägige Termine eingeschlossen. */
function timeRange(appointment: AppointmentDto) {
  const start = new Date(appointment.startsAt)
  const end = new Date(appointment.endsAt)
  const startLabel = format(start, 'EEEE, d. MMMM yyyy · HH:mm', { locale: de })
  const endLabel = isSameDay(start, end)
    ? format(end, 'HH:mm', { locale: de })
    : format(end, 'EEEE, d. MMMM yyyy · HH:mm', { locale: de })
  return `${startLabel}–${endLabel}`
}

/**
 * Liste der anstehenden Termine unterhalb des Monatsrasters.
 *
 * Gezeigt werden ausschließlich Termine, die noch nicht vorbei sind: laufende
 * zuerst, danach aufsteigend nach Beginn. Ein Klick klappt die gespeicherten
 * Details auf; das Bearbeiten bleibt bewusst ein eigener Schritt.
 */
export function UpcomingList({ appointments, onEdit }: UpcomingListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  // Minütlich aktualisierte Gegenwart: So wandert ein beginnender Termin ohne
  // Neuladen in den Zustand „Läuft gerade“ und ein beendeter verschwindet.
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const upcoming = useMemo(
    () =>
      appointments
        .filter((entry) => new Date(entry.endsAt).getTime() >= now)
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        ),
    [appointments, now],
  )

  if (!upcoming.length) {
    return (
      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">
          Anstehende Termine
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Keine anstehenden Termine. Bereits vergangene Termine bleiben im
          Monatsraster sichtbar.
        </p>
      </section>
    )
  }

  const visible = showAll ? upcoming : upcoming.slice(0, INITIAL_VISIBLE)

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Anstehende Termine
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {upcoming.length === 1
              ? '1 offener Termin'
              : `${upcoming.length} offene Termine`}{' '}
            · Klick auf einen Eintrag zeigt die Details.
          </p>
        </div>
        {upcoming.length > INITIAL_VISIBLE && (
          <Button variant="outline" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Weniger anzeigen' : `Alle ${upcoming.length} anzeigen`}
          </Button>
        )}
      </div>

      <ul className="mt-4 space-y-2">
        {visible.map((appointment) => {
          const start = new Date(appointment.startsAt)
          const end = new Date(appointment.endsAt)
          const running = start.getTime() <= now && end.getTime() >= now
          const expanded = expandedId === appointment.id
          const priority = PRIORITY_META[appointment.priority]

          return (
            <li
              key={appointment.id}
              className="overflow-hidden rounded-lg border bg-card"
            >
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() =>
                  setExpandedId(expanded ? null : appointment.id)
                }
                className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-secondary/40"
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-1.5 size-2.5 shrink-0 rounded-full',
                    priority.dotClass,
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium break-words">
                      {appointment.title}
                    </span>
                    {running && (
                      <span className="rounded-full border border-emerald-500/50 bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                        Läuft gerade
                      </span>
                    )}
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-xs',
                        priority.chipClass,
                      )}
                    >
                      {priority.label}
                    </span>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5" />
                      {timeRange(appointment)}
                    </span>
                    {appointment.location && (
                      <span className="flex items-center gap-1.5 break-words">
                        <MapPin className="size-3.5" />
                        {appointment.location}
                      </span>
                    )}
                  </span>
                </span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    'mt-1 size-4 shrink-0 text-muted-foreground transition-transform',
                    expanded && 'rotate-180',
                  )}
                />
              </button>

              {expanded && (
                <div className="space-y-3 border-t px-4 py-3">
                  {appointment.description ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {appointment.description}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Keine Beschreibung hinterlegt.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Ort: {appointment.location || 'nicht angegeben'} · Zuletzt
                    geändert{' '}
                    {format(
                      new Date(appointment.updatedAt),
                      'd. MMMM yyyy, HH:mm',
                      { locale: de },
                    )}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(appointment)}
                  >
                    <Pencil className="size-3.5" /> Termin bearbeiten
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
