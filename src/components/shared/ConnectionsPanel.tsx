import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  CalendarDays,
  CheckSquare,
  FolderKanban,
  Link2,
  Link2Off,
  Loader2,
  Plus,
  Search,
  StickyNote,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  CONNECTION_LABEL,
  CONNECTION_PATH,
  type ConnectionEnd,
  type ConnectionKind,
} from '@/lib/connections'
import { cn } from '@/lib/utils'
import {
  useConnect,
  useConnections,
  useConnectionSearch,
  useDisconnect,
} from '@/modules/connections/api'

const ICON: Record<ConnectionKind, typeof StickyNote> = {
  note: StickyNote,
  task: CheckSquare,
  appointment: CalendarDays,
  contact: User,
  project: FolderKanban,
}

const TINT: Record<ConnectionKind, string> = {
  note: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  task: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  appointment: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  contact: 'border-violet-500/30 bg-violet-500/10 text-violet-400',
  project: 'border-primary/30 bg-primary/10 text-primary',
}

/** Modul-Adresse des Gegenstücks; vier der fünf Module öffnen den Eintrag direkt. */
const PARAM: Partial<Record<ConnectionKind, string>> = {
  note: 'note',
  task: 'task',
  appointment: 'appointment',
  project: 'project',
  contact: 'contact',
}

function target(kind: ConnectionKind, id: string) {
  const parameter = PARAM[kind]
  return parameter ? `${CONNECTION_PATH[kind]}?${parameter}=${id}` : CONNECTION_PATH[kind]
}

interface ConnectionsPanelProps {
  /** Das Objekt, dessen Verknüpfungen gezeigt werden. `null`, solange es noch nicht gespeichert ist. */
  end: ConnectionEnd | null
  /** Kompakte Darstellung für Dialoge. */
  compact?: boolean
  className?: string
}

/**
 * „Hängt dran“: zeigt und pflegt die Verknüpfungen eines Objekts zu Notizen,
 * Aufgaben, Terminen, Kontakten und Projekten.
 */
export function ConnectionsPanel({ end, compact = false, className }: ConnectionsPanelProps) {
  const navigate = useNavigate()
  const { data: items, isLoading, error } = useConnections(end)
  const disconnect = useDisconnect()
  const [pickerOpen, setPickerOpen] = useState(false)

  if (!end)
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        Verknüpfungen sind möglich, sobald der Eintrag gespeichert ist.
      </p>
    )

  const remove = async (connectionId: string, other: ConnectionEnd) => {
    try {
      await disconnect.mutateAsync({ connectionId, source: end, target: other })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verknüpfung konnte nicht gelöst werden.')
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Link2 className="size-3.5" />
          Verknüpft{items && items.length > 0 ? ` (${items.length})` : ''}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setPickerOpen(true)}
        >
          <Plus className="size-3.5" />
          Verknüpfen
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Wird geladen…</p>
      ) : error ? (
        <p className="text-xs text-destructive">
          {error instanceof Error ? error.message : 'Verknüpfungen konnten nicht geladen werden.'}
        </p>
      ) : !items || items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Noch nichts verknüpft. Häng eine Notiz, Aufgabe, einen Termin, Kontakt oder ein Projekt an.
        </p>
      ) : (
        <ul className={cn('space-y-1.5', compact && 'max-h-44 overflow-y-auto pr-1')}>
          {items.map((item) => {
            const Icon = ICON[item.kind]
            return (
              <li
                key={item.connectionId}
                className="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/20 p-2 text-xs"
              >
                <Badge variant="outline" className={cn('gap-1 shrink-0', TINT[item.kind])}>
                  <Icon className="size-3" />
                  {CONNECTION_LABEL[item.kind]}
                </Badge>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left hover:underline"
                  onClick={() => navigate(target(item.kind, item.id))}
                  title={`${CONNECTION_LABEL[item.kind]} öffnen`}
                >
                  <span className="block truncate font-medium text-foreground">{item.title}</span>
                  {item.detail && (
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {item.detail}
                    </span>
                  )}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => void remove(item.connectionId, { kind: item.kind, id: item.id })}
                  disabled={disconnect.isPending}
                  aria-label="Verknüpfung lösen"
                  title="Verknüpfung lösen"
                >
                  <Link2Off className="size-3.5" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <ConnectionPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        end={end}
        connected={items ?? []}
      />
    </div>
  )
}

interface PickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  end: ConnectionEnd
  connected: Array<{ kind: ConnectionKind; id: string }>
}

function ConnectionPicker({ open, onOpenChange, end, connected }: PickerProps) {
  const [term, setTerm] = useState('')
  const { data: hits, isLoading } = useConnectionSearch(term, open)
  const connect = useConnect()

  const taken = useMemo(
    () => new Set([`${end.kind}:${end.id}`, ...connected.map((item) => `${item.kind}:${item.id}`)]),
    [end, connected],
  )

  const add = async (hit: { kind: ConnectionKind; id: string; title: string }) => {
    try {
      await connect.mutateAsync({ source: end, target: { kind: hit.kind, id: hit.id } })
      toast.success(`${CONNECTION_LABEL[hit.kind]} „${hit.title}“ verknüpft.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verknüpfung fehlgeschlagen.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-5 text-primary" />
            Verknüpfen
          </DialogTitle>
          <DialogDescription>
            Such ein Objekt aus Notizen, Aufgaben, Terminen, Kontakten oder Projekten.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Suchen…"
            className="pl-9"
          />
        </div>

        <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
          {isLoading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              <Loader2 className="mx-auto mb-2 size-4 animate-spin" />
              Wird gesucht…
            </p>
          ) : !hits || hits.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Nichts gefunden. Tipp: Auch Inhalt und Beschreibung werden durchsucht.
            </p>
          ) : (
            hits.map((hit) => {
              const Icon = ICON[hit.kind]
              const already = taken.has(`${hit.kind}:${hit.id}`)
              return (
                <button
                  key={`${hit.kind}:${hit.id}`}
                  type="button"
                  disabled={already || connect.isPending}
                  onClick={() => void add(hit)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md border border-border/60 p-2 text-left text-xs transition-colors',
                    already
                      ? 'cursor-not-allowed opacity-50'
                      : 'hover:border-primary/40 hover:bg-secondary/40',
                  )}
                >
                  <Badge variant="outline" className={cn('gap-1 shrink-0', TINT[hit.kind])}>
                    <Icon className="size-3" />
                    {CONNECTION_LABEL[hit.kind]}
                  </Badge>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{hit.title}</span>
                    {hit.detail && (
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {hit.detail}
                      </span>
                    )}
                  </span>
                  {already && <span className="shrink-0 text-[10px] text-muted-foreground">bereits verknüpft</span>}
                </button>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
