import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { Contact, Mail, MoreVertical, Pencil, Phone, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ContactFormDialog } from './components/ContactFormDialog'
import { useContacts, useDeleteContact, type ContactDto } from './api'

function initials(contact: ContactDto): string {
  return (
    (contact.firstName[0] ?? '') + (contact.lastName[0] ?? '')
  ).toUpperCase()
}

export default function ContactsPage() {
  const { data: contacts, isLoading, error } = useContacts()
  const deleteContact = useDeleteContact()

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editContact, setEditContact] = useState<ContactDto | null>(null)

  // Aufruf aus einer Verknüpfung: ?contact=<id> öffnet den Eintrag direkt.
  const [params] = useSearchParams(),
    location = useLocation(),
    handledLink = useRef('')
  useEffect(() => {
    const id = params.get('contact'),
      request = `${location.key}:${id}`
    if (!id || !contacts || handledLink.current === request) return
    handledLink.current = request
    const contact = contacts.find((entry) => entry.id === id)
    if (contact) {
      setEditContact(contact)
      setDialogOpen(true)
    } else toast.info('Dieser Kontakt ist nicht mehr verfügbar.')
  }, [params, location.key, contacts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (contacts ?? []).filter(
      (c) =>
        q === '' ||
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q),
    )
  }, [contacts, search])

  const openCreate = () => {
    setEditContact(null)
    setDialogOpen(true)
  }

  const openEdit = (contact: ContactDto) => {
    setEditContact(contact)
    setDialogOpen(true)
  }

  const handleDelete = async (contact: ContactDto) => {
    const name = `${contact.firstName} ${contact.lastName}`.trim()
    try {
      await deleteContact.mutateAsync(contact.id)
      toast.success(`„${name}“ gelöscht`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen')
    }
  }

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kontakte</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {(contacts ?? []).length} Kontakte im Adressbuch
          </p>
        </div>
        <Button onClick={openCreate} className="bg-gradient-accent glow text-white">
          <Plus className="size-4" /> Neuer Kontakt
        </Button>
      </div>

      <div className="relative mt-6 max-w-sm">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, Firma, E-Mail…"
          className="pl-9"
        />
      </div>

      <div className="mt-6">
        {isLoading && <Skeleton className="h-64 rounded-lg" />}

        {error && (
          <p className="text-sm text-destructive">
            Kontakte konnten nicht geladen werden: {error.message}
          </p>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground">
            <Contact className="size-8" />
            <p className="text-sm">
              {search ? 'Keine Treffer.' : 'Noch keine Kontakte – lege den ersten an.'}
            </p>
          </div>
        )}

        {!isLoading && !error && filtered.length > 0 && (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Firma</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">
                            {initials(contact)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {contact.firstName} {contact.lastName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {contact.company || '–'}
                    </TableCell>
                    <TableCell>
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Mail className="size-3.5" /> {contact.email}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.phone ? (
                        <a
                          href={`tel:${contact.phone}`}
                          className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Phone className="size-3.5" /> {contact.phone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label="Kontakt-Aktionen"
                          >
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(contact)}>
                            <Pencil className="size-4" /> Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => handleDelete(contact)}
                          >
                            <Trash2 className="size-4" /> Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ContactFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editContact={editContact}
      />
    </div>
  )
}
