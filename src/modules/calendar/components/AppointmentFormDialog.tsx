import { useEffect, useState, type FormEvent } from 'react'
import { format } from 'date-fns'
import { Repeat, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AttachmentsPanel } from '@/components/shared/AttachmentsPanel'
import { ConnectionsPanel } from '@/components/shared/ConnectionsPanel'
import { Switch } from '@/components/ui/switch'
import {
  FREQUENCY_LABEL,
  MAX_OCCURRENCES,
  RECURRENCE_FREQUENCIES,
  WEEKDAY_LABEL,
  type RecurrenceFrequency,
  type RecurrenceRule,
  describeRule,
} from '@/lib/recurrence'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  type AppointmentScope,
  useAppointmentSeries,
  useCreateAppointment,
  useDeleteAppointment,
  useUpdateAppointment,
  type AppointmentDto,
  type AppointmentPriority,
} from '../api'
import { PRIORITY_META } from '../constants'

interface AppointmentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Vorhandener Termin beim Bearbeiten, sonst null */
  editAppointment: AppointmentDto | null
  /** Vorausgewähltes Datum bei Neuanlage (Klick auf einen Tag) */
  initialDate: Date
}

export function AppointmentFormDialog({
  open,
  onOpenChange,
  editAppointment,
  initialDate,
}: AppointmentFormDialogProps) {
  const createAppointment = useCreateAppointment()
  const updateAppointment = useUpdateAppointment()
  const deleteAppointment = useDeleteAppointment()
  const isPending = createAppointment.isPending || updateAppointment.isPending

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [location, setLocation] = useState('')
  const [priority, setPriority] = useState<AppointmentPriority>('medium')
  const [description, setDescription] = useState('')

  // Wiederholung
  const [repeat, setRepeat] = useState(false)
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('weekly')
  const [interval, setInterval] = useState(1)
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [endsType, setEndsType] = useState<'count' | 'until'>('count')
  const [count, setCount] = useState(10)
  const [until, setUntil] = useState('')
  /** Beim Bearbeiten einer Serie: nur dieser Termin oder alle folgenden. */
  const [scope, setScope] = useState<AppointmentScope>('single')

  const inSeries = Boolean(editAppointment?.seriesId)
  const { data: series } = useAppointmentSeries(editAppointment?.id ?? null, open && inSeries)

  // Regel einer bestehenden Serie in die Felder übernehmen.
  useEffect(() => {
    if (!series?.rule) return
    setFrequency(series.rule.frequency)
    setInterval(series.rule.interval)
    setWeekdays(series.rule.weekdays)
    setEndsType(series.rule.ends.type)
    if (series.rule.ends.type === 'count') setCount(series.rule.ends.count)
    else setUntil(series.rule.ends.until)
  }, [series])

  useEffect(() => {
    if (!open) return
    setScope('single')
    setRepeat(false)
    if (editAppointment) {
      const starts = new Date(editAppointment.startsAt)
      const ends = new Date(editAppointment.endsAt)
      setTitle(editAppointment.title)
      setDate(format(starts, 'yyyy-MM-dd'))
      setStartTime(format(starts, 'HH:mm'))
      setEndTime(format(ends, 'HH:mm'))
      setLocation(editAppointment.location)
      setPriority(editAppointment.priority)
      setDescription(editAppointment.description)
    } else {
      setTitle('')
      setDate(format(initialDate, 'yyyy-MM-dd'))
      setStartTime('09:00')
      setEndTime('10:00')
      setLocation('')
      setPriority('medium')
      setDescription('')
    }
  }, [open, editAppointment, initialDate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const startsAt = new Date(`${date}T${startTime}`)
    const endsAt = new Date(`${date}T${endTime}`)
    if (endsAt <= startsAt) {
      toast.error('Das Ende muss nach dem Beginn liegen.')
      return
    }
    const rule: RecurrenceRule = {
      frequency,
      interval,
      weekdays: frequency === 'weekly' ? weekdays : [],
      ends:
        endsType === 'count'
          ? { type: 'count', count }
          : { type: 'until', until },
    }
    if (endsType === 'until' && !until) {
      toast.error('Bitte ein Enddatum für die Wiederholung angeben.')
      return
    }
    const wantsSeries = editAppointment ? inSeries && scope === 'series' : repeat
    const input = {
      title,
      description,
      location,
      priority,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      ...(wantsSeries ? { recurrence: rule } : {}),
    }
    try {
      if (editAppointment) {
        await updateAppointment.mutateAsync({
          id: editAppointment.id,
          scope: wantsSeries ? 'series' : 'single',
          ...input,
        })
        toast.success(wantsSeries ? 'Serie ab diesem Termin aktualisiert' : 'Termin aktualisiert')
      } else {
        await createAppointment.mutateAsync(input)
        toast.success(repeat ? 'Serie angelegt' : 'Termin angelegt')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Speichern fehlgeschlagen')
    }
  }

  const handleDelete = async () => {
    if (!editAppointment) return
    const wholeSeries = inSeries && scope === 'series'
    try {
      await deleteAppointment.mutateAsync({
        id: editAppointment.id,
        scope: wholeSeries ? 'series' : 'single',
      })
      toast.success(
        wholeSeries
          ? 'Dieser und alle folgenden Termine gelöscht'
          : `„${editAppointment.title}“ gelöscht`,
      )
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editAppointment ? 'Termin bearbeiten' : 'Neuer Termin'}
          </DialogTitle>
          <DialogDescription>
            Mit Uhrzeit, Ort und Prioritätsfarbe.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="apt-title">Titel</Label>
            <Input
              id="apt-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Wartungsfenster Kunde X"
              required
              maxLength={300}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="apt-date">Datum</Label>
              <Input
                id="apt-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="apt-start">Von</Label>
              <Input
                id="apt-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="apt-end">Bis</Label>
              <Input
                id="apt-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="apt-location">Ort (optional)</Label>
              <Input
                id="apt-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="z.B. Vor Ort / Teams"
                maxLength={300}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Priorität</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as AppointmentPriority)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_META) as AppointmentPriority[]).map(
                    (p) => (
                      <SelectItem key={p} value={p}>
                        <span
                          className={`size-2 rounded-full ${PRIORITY_META[p].dotClass}`}
                        />
                        {PRIORITY_META[p].label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="apt-description">Beschreibung (optional)</Label>
            <Textarea
              id="apt-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={10_000}
            />
          </div>
          {/* Wiederholung */}
          <div className="space-y-3 border-t pt-3">
            {inSeries ? (
              <>
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Repeat className="size-3.5" />
                  Teil einer Serie
                </p>
                {series?.rule && (
                  <p className="text-xs text-muted-foreground">{describeRule(series.rule)}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['single', 'Nur dieser Termin'],
                      ['series', 'Dieser und alle folgenden'],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={scope === value ? 'default' : 'outline'}
                      className="text-xs"
                      onClick={() => setScope(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                {scope === 'series' && (
                  <p className="text-[11px] text-muted-foreground">
                    Vergangene Termine dieser Serie bleiben unverändert. Alles ab diesem Termin wird
                    neu angelegt.
                  </p>
                )}
              </>
            ) : (
              !editAppointment && (
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="apt-repeat" className="flex items-center gap-1.5 text-sm">
                    <Repeat className="size-4 text-muted-foreground" />
                    Wiederholen
                  </Label>
                  <Switch id="apt-repeat" checked={repeat} onCheckedChange={setRepeat} />
                </div>
              )
            )}

            {(repeat || (inSeries && scope === 'series')) && (
              <div className="space-y-3 rounded-lg border border-border/60 bg-secondary/20 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="apt-frequency" className="text-xs">
                      Rhythmus
                    </Label>
                    <Select
                      value={frequency}
                      onValueChange={(value) => setFrequency(value as RecurrenceFrequency)}
                    >
                      <SelectTrigger id="apt-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RECURRENCE_FREQUENCIES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {FREQUENCY_LABEL[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="apt-interval" className="text-xs">
                      Jeden wievielten
                    </Label>
                    <Input
                      id="apt-interval"
                      type="number"
                      min={1}
                      max={52}
                      value={interval}
                      onChange={(e) => setInterval(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>
                </div>

                {frequency === 'weekly' && (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Wochentage</Label>
                    <div className="flex flex-wrap gap-1">
                      {WEEKDAY_LABEL.map((label, day) => (
                        <Button
                          key={label}
                          type="button"
                          size="sm"
                          variant={weekdays.includes(day) ? 'default' : 'outline'}
                          className="h-7 w-10 p-0 text-xs"
                          onClick={() =>
                            setWeekdays((previous) =>
                              previous.includes(day)
                                ? previous.filter((entry) => entry !== day)
                                : [...previous, day],
                            )
                          }
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Ohne Auswahl gilt der Wochentag des Starttermins.
                    </p>
                  </div>
                )}

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="apt-ends" className="text-xs">
                      Endet
                    </Label>
                    <Select
                      value={endsType}
                      onValueChange={(value) => setEndsType(value as 'count' | 'until')}
                    >
                      <SelectTrigger id="apt-ends">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="count">Nach Anzahl</SelectItem>
                        <SelectItem value="until">An einem Datum</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {endsType === 'count' ? (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="apt-count" className="text-xs">
                        Termine
                      </Label>
                      <Input
                        id="apt-count"
                        type="number"
                        min={1}
                        max={MAX_OCCURRENCES}
                        value={count}
                        onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="apt-until" className="text-xs">
                        Bis einschließlich
                      </Label>
                      <Input
                        id="apt-until"
                        type="date"
                        value={until}
                        onChange={(e) => setUntil(e.target.value)}
                      />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Höchstens {MAX_OCCURRENCES} Termine und zwei Jahre im Voraus.
                </p>
              </div>
            )}
          </div>

          <AttachmentsPanel
            owner={editAppointment ? { kind: 'appointment', id: editAppointment.id } : null}
            compact
            className="border-t pt-3"
          />
          <ConnectionsPanel
            end={editAppointment ? { kind: 'appointment', id: editAppointment.id } : null}
            compact
            className="border-t pt-3"
          />
          <DialogFooter className="justify-between sm:justify-between">
            {editAppointment ? (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
                {inSeries && scope === 'series' ? 'Serie ab hier löschen' : 'Löschen'}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-gradient-accent glow text-white"
              >
                {isPending ? 'Speichert…' : 'Speichern'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
