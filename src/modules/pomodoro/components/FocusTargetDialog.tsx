import { useState } from 'react'
import { CheckSquare, FolderKanban, Loader2, Search, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { FOCUS_LABEL, type FocusKind, type FocusTarget } from '@/lib/focus'
import { SEARCH_MIN_LENGTH, type SearchHit } from '@/lib/search'
import { cn } from '@/lib/utils'
import { useDebounced, useGlobalSearch } from '@/modules/search/api'

const ICON: Record<FocusKind, typeof Target> = {
  task: CheckSquare,
  projectTask: CheckSquare,
  project: FolderKanban,
}

interface FocusTargetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  current: FocusTarget | null
  onSelect: (target: FocusTarget | null) => void
}

/** Auswahl, woran der Timer die Zeit schreibt: Aufgabe, Projektaufgabe oder Projekt. */
export function FocusTargetDialog({
  open,
  onOpenChange,
  current,
  onSelect,
}: FocusTargetDialogProps) {
  const [term, setTerm] = useState('')
  const debounced = useDebounced(term)
  const { data: hits, isFetching } = useGlobalSearch(debounced, open, 'task,projectTask,project')

  const choose = (hit: SearchHit) => {
    onSelect({ kind: hit.kind as FocusKind, id: hit.id, title: hit.title })
    onOpenChange(false)
    setTerm('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="size-5 text-primary" />
            Woran arbeitest du?
          </DialogTitle>
          <DialogDescription>
            Die Zeit dieses Blocks wird der gewählten Aufgabe oder dem Projekt gutgeschrieben.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Aufgabe oder Projekt suchen…"
            className="pl-9"
          />
        </div>

        <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {term.trim().length < SEARCH_MIN_LENGTH ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Mindestens {SEARCH_MIN_LENGTH} Zeichen eingeben.
            </p>
          ) : isFetching && !hits ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              <Loader2 className="mx-auto mb-2 size-4 animate-spin" />
              Wird gesucht…
            </p>
          ) : !hits || hits.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Nichts gefunden.</p>
          ) : (
            hits.map((hit) => {
              const kind = hit.kind as FocusKind
              const Icon = ICON[kind] ?? Target
              const active = current?.kind === hit.kind && current.id === hit.id
              return (
                <button
                  key={`${hit.kind}:${hit.id}`}
                  type="button"
                  onClick={() => choose(hit)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md border p-2 text-left text-xs transition-colors',
                    active
                      ? 'border-primary/50 bg-primary/10'
                      : 'border-border/60 hover:border-primary/40 hover:bg-secondary/40',
                  )}
                >
                  <Icon className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{hit.title}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {FOCUS_LABEL[kind]} · {hit.detail}
                    </span>
                  </span>
                </button>
              )
            })
          )}
        </div>

        {current && (
          <Button
            type="button"
            variant="ghost"
            className="w-full text-xs text-muted-foreground"
            onClick={() => {
              onSelect(null)
              onOpenChange(false)
            }}
          >
            Ohne Ziel weiterarbeiten
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
