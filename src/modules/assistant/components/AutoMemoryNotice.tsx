import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Brain } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApiFetch } from '@/hooks/use-api'
import { useOmniMemories } from '../api/memory'
import type { AutoMemoryState } from '@/types/omni-memory'
export function AutoMemoryNotice({
  state,
  onEdit,
}: {
  state: AutoMemoryState
  onEdit?: (id: string) => void
}) {
  const api = useApiFetch(),
    cache = useQueryClient(),
    { mutation: remove } = useOmniMemories(false)
  const review = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string
      action: 'accept' | 'dismiss'
    }) =>
      api(`/api/omni-memory-auto/${id}/${action}`, {
        method: 'POST',
        body: '{}',
      }),
    onSettled: () =>
      Promise.all([
        cache.invalidateQueries({ queryKey: ['chat-messages'] }),
        cache.invalidateQueries({ queryKey: ['omni-memory'] }),
      ]),
  })
  return (
    <div className="mt-3 space-y-2 border-t border-zinc-800 pt-2 text-xs">
      {state.status === 'unavailable' && (
        <p className="text-amber-400">
          Automatisches Merken konnte nicht abgeschlossen werden. Die
          Chatantwort bleibt erhalten.
        </p>
      )}
      {state.status === 'processing' && (
        <p className="text-zinc-400">
          Automatisches Merken wurde noch nicht abgeschlossen.
        </p>
      )}
      {state.events.map((event) => (
        <section
          key={event.id}
          className="space-y-2 rounded-lg border border-primary/25 p-2.5"
        >
          <p className="flex items-center gap-1.5 font-medium">
            <Brain className="size-3.5 shrink-0" />
            {event.status === 'saved'
              ? event.changed
                ? 'Erinnerung inzwischen geändert'
                : event.targetVersion
                  ? 'Automatisch aktualisiert'
                  : 'Automatisch gemerkt'
              : 'Soll Omni sich das merken?'}
          </p>
          <p className="break-words font-medium">{event.title}</p>
          {event.previousContent && (
            <p className="whitespace-pre-wrap break-words text-zinc-400">
              Bisher: {event.previousContent}
            </p>
          )}
          <p className="whitespace-pre-wrap break-words">{event.content}</p>
          <p className="text-zinc-400">
            {event.projectId ? 'Für das ausgewählte Projekt' : 'Persönlich'}
            {event.archived ? ' · inzwischen archiviert' : ''}
          </p>
          {event.status === 'pending' && (
            <p className="text-zinc-400">
              Unsicherer Punkt oder mögliche Änderung eines bisherigen Eintrags.
              Erst deine Bestätigung übernimmt ihn.
              {event.changed
                ? ' Der Eintrag wurde inzwischen geändert – bitte über Bearbeiten prüfen.'
                : ''}
            </p>
          )}
          <div className="flex flex-wrap gap-1">
            {event.status === 'pending' ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={review.isPending || event.changed}
                  onClick={() =>
                    review.mutate({ id: event.id, action: 'accept' })
                  }
                >
                  Ja, merken
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={review.isPending}
                  onClick={() =>
                    review.mutate({ id: event.id, action: 'dismiss' })
                  }
                >
                  Nicht merken
                </Button>
                {event.memoryId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit?.(event.memoryId!)}
                  >
                    Bearbeiten
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => event.memoryId && onEdit?.(event.memoryId)}
                >
                  Bearbeiten
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={remove.isPending || event.currentVersion == null}
                  onClick={() => {
                    if (
                      event.memoryId &&
                      event.currentVersion != null &&
                      window.confirm(
                        'Die aktuelle Erinnerung samt allen Gedächtnisversionen vergessen? Bisherige Chatnachrichten bleiben erhalten.',
                      )
                    )
                      remove.mutate({
                        type: 'delete',
                        id: event.memoryId,
                        version: event.currentVersion,
                      })
                  }}
                >
                  Vergessen
                </Button>
              </>
            )}
          </div>
        </section>
      ))}
      {(review.error || remove.error) && (
        <p role="alert" className="text-destructive">
          {review.error?.message ?? remove.error?.message}
        </p>
      )}
    </div>
  )
}
