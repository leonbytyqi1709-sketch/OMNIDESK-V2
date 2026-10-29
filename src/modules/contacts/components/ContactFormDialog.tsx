import { useEffect, useState, type FormEvent } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  useCreateContact,
  useUpdateContact,
  type ContactDto,
  type ContactInput,
} from '../api'

const EMPTY: ContactInput = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  company: '',
  notes: '',
}

interface ContactFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editContact: ContactDto | null
}

export function ContactFormDialog({
  open,
  onOpenChange,
  editContact,
}: ContactFormDialogProps) {
  const createContact = useCreateContact()
  const updateContact = useUpdateContact()
  const isPending = createContact.isPending || updateContact.isPending

  const [form, setForm] = useState<ContactInput>(EMPTY)

  useEffect(() => {
    if (open) {
      setForm(
        editContact
          ? {
              firstName: editContact.firstName,
              lastName: editContact.lastName,
              email: editContact.email,
              phone: editContact.phone,
              company: editContact.company,
              notes: editContact.notes,
            }
          : EMPTY,
      )
    }
  }, [open, editContact])

  const set = (field: keyof ContactInput) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      if (editContact) {
        await updateContact.mutateAsync({ id: editContact.id, ...form })
        toast.success('Kontakt aktualisiert')
      } else {
        await createContact.mutateAsync(form)
        toast.success('Kontakt angelegt')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Speichern fehlgeschlagen')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editContact ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}
          </DialogTitle>
          <DialogDescription>
            Kundendaten für das digitale Adressbuch.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-first">Vorname</Label>
              <Input
                id="contact-first"
                value={form.firstName}
                onChange={(e) => set('firstName')(e.target.value)}
                required
                maxLength={100}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-last">Nachname</Label>
              <Input
                id="contact-last"
                value={form.lastName}
                onChange={(e) => set('lastName')(e.target.value)}
                maxLength={100}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-email">E-Mail</Label>
              <Input
                id="contact-email"
                type="email"
                value={form.email}
                onChange={(e) => set('email')(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contact-phone">Telefon</Label>
              <Input
                id="contact-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => set('phone')(e.target.value)}
                maxLength={50}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="contact-company">Firma</Label>
            <Input
              id="contact-company"
              value={form.company}
              onChange={(e) => set('company')(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="contact-notes">Notizen (optional)</Label>
            <Textarea
              id="contact-notes"
              value={form.notes}
              onChange={(e) => set('notes')(e.target.value)}
              rows={2}
              maxLength={10_000}
            />
          </div>
          <ConnectionsPanel
            end={editContact ? { kind: 'contact', id: editContact.id } : null}
            compact
            className="border-t pt-3"
          />
          <DialogFooter>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
