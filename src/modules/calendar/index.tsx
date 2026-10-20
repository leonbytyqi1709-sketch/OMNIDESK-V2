import { useLocation, useSearchParams } from 'react-router'
import { useEffect, useRef, useState } from 'react'
import { addMonths, format, subMonths } from 'date-fns'
import { de } from 'date-fns/locale'
import { CalendarClock, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AppointmentFormDialog } from './components/AppointmentFormDialog'
import { BookingSettingsDialog } from './components/BookingSettingsDialog'
import { MonthGrid } from './components/MonthGrid'
import { useAppointments, type AppointmentDto } from './api'

export default function CalendarPage() {
  const { data: appointments, isLoading, error } = useAppointments()

  const [params] = useSearchParams(), location = useLocation(), handledLink = useRef('')
  const [month, setMonth] = useState(() => new Date())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [editAppointment, setEditAppointment] = useState<AppointmentDto | null>(
    null,
  )
  const [initialDate, setInitialDate] = useState(() => new Date())

  useEffect(() => {
    const id = params.get('appointment'), request = `${location.key}:${id}`
    if (!id || !appointments || handledLink.current === request) return
    handledLink.current = request
    const appointment = appointments.find((entry) => entry.id === id)
    if (appointment) { setMonth(new Date(appointment.startsAt)); setEditAppointment(appointment); setDialogOpen(true) }
  }, [params, location.key, appointments])

  const openCreate = (day: Date) => {
    setEditAppointment(null)
    setInitialDate(day)
    setDialogOpen(true)
  }

  const openEdit = (appointment: AppointmentDto) => {
    setEditAppointment(appointment)
    setDialogOpen(true)
  }

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Kalender & Booking
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Klick auf einen Tag legt einen Termin an.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMonth((m) => subMonths(m, 1))}
              aria-label="Vorheriger Monat"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="w-40"
              onClick={() => setMonth(new Date())}
            >
              {format(month, 'MMMM yyyy', { locale: de })}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              aria-label="Nächster Monat"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Button variant="outline" onClick={() => setBookingOpen(true)}>
            <CalendarClock className="size-4" /> Booking einrichten
          </Button>
          <Button
            onClick={() => openCreate(new Date())}
            className="bg-gradient-accent glow text-white"
          >
            <Plus className="size-4" /> Neuer Termin
          </Button>
        </div>
      </div>

      <div className="mt-6">
        {isLoading && <Skeleton className="h-[32rem] rounded-lg" />}

        {error && (
          <p className="text-sm text-destructive">
            Termine konnten nicht geladen werden: {error.message}
          </p>
        )}

        {!isLoading && !error && (
          <MonthGrid
            month={month}
            appointments={appointments ?? []}
            onDayClick={openCreate}
            onAppointmentClick={openEdit}
          />
        )}
      </div>

      <AppointmentFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editAppointment={editAppointment}
        initialDate={initialDate}
      />

      <BookingSettingsDialog open={bookingOpen} onOpenChange={setBookingOpen} />
    </div>
  )
}
