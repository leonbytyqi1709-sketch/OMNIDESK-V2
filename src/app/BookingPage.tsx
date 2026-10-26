import { useMemo, useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { addDays, format, startOfDay } from 'date-fns'
import { de } from 'date-fns/locale'
import { CalendarCheck2, CalendarX2, ChevronLeft, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { WeekAvailability } from '@/db/schema'

interface PublicBookingConfig {
  slug: string
  slotMinutes: number
  availability: WeekAvailability
}

/** getDay()-Index -> Availability-Schlüssel (identisch zum Server). */
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

/** Unauthentifizierter Fetch für die öffentliche Booking-API. */
async function publicFetch<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Anfrage fehlgeschlagen (${res.status})`)
  }
  return res.json() as Promise<T>
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center gap-8 p-6 pt-16">
      <div className="text-center">
        <h1 className="text-gradient-accent text-4xl font-bold tracking-tight">
          OMNIDESK
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Online-Terminbuchung</p>
      </div>
      {children}
    </main>
  )
}

export default function BookingPage() {
  const { slug = '' } = useParams()

  const {
    data: config,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['public-booking', slug],
    queryFn: () => publicFetch<PublicBookingConfig>(`/api/public/booking/${slug}`),
    retry: false,
  })

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [topic, setTopic] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [booked, setBooked] = useState<{ date: string; time: string } | null>(null)

  /** Die nächsten 14 Tage; Tage ohne Verfügbarkeit sind deaktiviert. */
  const days = useMemo(() => {
    if (!config) return []
    const today = startOfDay(new Date())
    return Array.from({ length: 14 }, (_, i) => {
      const date = addDays(today, i)
      return {
        date,
        iso: format(date, 'yyyy-MM-dd'),
        enabled: config.availability[WEEKDAY_KEYS[date.getDay()]].enabled,
      }
    })
  }, [config])

  const slotsQuery = useQuery({
    queryKey: ['public-booking', slug, 'slots', selectedDate],
    queryFn: () =>
      publicFetch<{ date: string; slots: string[] }>(
        `/api/public/booking/${slug}/slots?date=${selectedDate}`,
      ),
    enabled: config !== undefined && selectedDate !== null,
  })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedDate || !selectedTime) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/public/booking/${slug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          time: selectedTime,
          name,
          email,
          topic,
        }),
      })
      if (res.status === 409) {
        toast.error('Dieser Slot wurde gerade vergeben – bitte wähle einen anderen.')
        setSelectedTime(null)
        await slotsQuery.refetch()
        return
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Buchung fehlgeschlagen (${res.status})`)
      }
      setBooked({ date: selectedDate, time: selectedTime })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Buchung fehlgeschlagen')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <PageShell>
        <Skeleton className="h-72 w-full max-w-xl rounded-xl" />
      </PageShell>
    )
  }

  if (error || !config) {
    return (
      <PageShell>
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CalendarX2 className="text-muted-foreground mx-auto size-8" />
            <CardTitle className="text-center">
              Buchungsseite nicht gefunden
            </CardTitle>
            <CardDescription className="text-center">
              Der Link ist ungültig oder die Buchungsseite ist derzeit
              deaktiviert.
            </CardDescription>
          </CardHeader>
        </Card>
      </PageShell>
    )
  }

  if (booked) {
    const bookedDate = new Date(`${booked.date}T${booked.time}:00`)
    return (
      <PageShell>
        <Card className="glow w-full max-w-xl">
          <CardHeader>
            <div className="bg-gradient-accent glow mx-auto flex size-12 items-center justify-center rounded-full">
              <CalendarCheck2 className="size-6 text-white" />
            </div>
            <CardTitle className="text-center">Termin gebucht!</CardTitle>
            <CardDescription className="text-center">
              {format(bookedDate, "EEEE, d. MMMM yyyy 'um' HH:mm 'Uhr'", {
                locale: de,
              })}{' '}
              ({config.slotMinutes} Minuten)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center text-sm">
              Der Termin wurde in den Kalender übernommen. Du kannst dieses
              Fenster jetzt schließen.
            </p>
          </CardContent>
        </Card>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Termin buchen</CardTitle>
          <CardDescription>
            Slots à {config.slotMinutes} Minuten – wähle zuerst einen Tag.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div>
            <p className="mb-2 text-sm font-medium">Tag wählen</p>
            <div className="grid grid-cols-7 gap-1.5">
              {days.map((day) => (
                <button
                  key={day.iso}
                  type="button"
                  disabled={!day.enabled}
                  onClick={() => {
                    setSelectedDate(day.iso)
                    setSelectedTime(null)
                  }}
                  className={cn(
                    'flex flex-col items-center rounded-md border py-2 text-sm transition-colors',
                    day.iso === selectedDate
                      ? 'bg-gradient-accent glow border-transparent text-white'
                      : 'hover:bg-accent',
                    !day.enabled && 'text-muted-foreground/40 cursor-not-allowed hover:bg-transparent',
                  )}
                >
                  <span className="text-xs">
                    {format(day.date, 'EE', { locale: de })}
                  </span>
                  <span className="font-medium">{format(day.date, 'd.M.')}</span>
                </button>
              ))}
            </div>
          </div>

          {selectedDate && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <Clock className="size-4" /> Freie Slots am{' '}
                {format(new Date(`${selectedDate}T00:00:00`), 'd. MMMM', {
                  locale: de,
                })}
              </p>
              {slotsQuery.isLoading && <Skeleton className="h-10 rounded-md" />}
              {slotsQuery.error && (
                <p className="text-destructive text-sm">
                  Slots konnten nicht geladen werden.
                </p>
              )}
              {slotsQuery.data && slotsQuery.data.slots.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  An diesem Tag sind keine Slots mehr frei.
                </p>
              )}
              {slotsQuery.data && slotsQuery.data.slots.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {slotsQuery.data.slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      className={cn(
                        'rounded-md border px-3 py-1.5 font-mono text-sm transition-colors',
                        slot === selectedTime
                          ? 'bg-gradient-accent glow border-transparent text-white'
                          : 'hover:bg-accent',
                      )}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedDate && selectedTime && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="booking-name">Name</Label>
                <Input
                  id="booking-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={200}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="booking-email">E-Mail</Label>
                <Input
                  id="booking-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={200}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="booking-topic">Anliegen (optional)</Label>
                <Textarea
                  id="booking-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={3}
                  maxLength={1000}
                />
              </div>
              <div className="flex justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedTime(null)}
                >
                  <ChevronLeft className="size-4" /> Zurück
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-gradient-accent glow text-white"
                >
                  {submitting
                    ? 'Bucht…'
                    : `${selectedTime} Uhr verbindlich buchen`}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </PageShell>
  )
}
