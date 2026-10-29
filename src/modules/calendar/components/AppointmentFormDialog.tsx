import { useEffect, useState, type FormEvent } from 'react'
import { format } from 'date-fns'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConnectionsPanel } from '@/components/shared/ConnectionsPanel'
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

  useEffect(() => {
    if (!open) return
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
    const input = {
      title,
      description,
      location,
      priority,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    }
    try {
      if (editAppointment) {
        await updateAppointment.mutateAsync({ id: editAppointment.id, ...input })
        toast.success('Termin aktualisiert')
      } else {
        await createAppointment.mutateAsync(input)
        toast.success('Termin angelegt')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Speichern fehlgeschlagen')
    }
  }

  const handleDelete = async () => {
    if (!editAppointment) return
    try {
      await deleteAppointment.mutateAsync(editAppointment.id)
      toast.success(`„${editAppointment.title}“ gelöscht`)
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
                <Trash2 className="size-4" /> Löschen
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
