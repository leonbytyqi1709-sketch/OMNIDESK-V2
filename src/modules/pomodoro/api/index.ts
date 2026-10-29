import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError, useApiFetch } from '@/hooks/use-api'
import type { FocusKind, FocusSummary } from '@/lib/focus'
import { usePomodoroStore } from '@/stores/pomodoro'

export function useFocusSummary(days = 7, enabled = true) {
  const apiFetch = useApiFetch()
  return useQuery({
    queryKey: ['focus', 'summary', days],
    queryFn: () => apiFetch<FocusSummary>(`/api/focus/summary?days=${days}`),
    enabled,
  })
}

/** Gesamtzeit an einem einzelnen Ziel. */
export function useFocusForTarget(kind: FocusKind, id: string | null) {
  const apiFetch = useApiFetch()
  return useQuery({
    queryKey: ['focus', 'target', kind, id],
    queryFn: () => apiFetch<{ seconds: number; sessions: number }>(`/api/focus/for/${kind}/${id}`),
    enabled: Boolean(id),
  })
}

/**
 * Überträgt fertige Fokusblöcke aus dem Timer-Store an den Server.
 *
 * Der Store selbst kann das nicht: Er lebt außerhalb von React und hat kein
 * Anmeldetoken. Einmal gesendete Blöcke werden entfernt; bei einem
 * eindeutigen Fehler (etwa gelöschtes Ziel) ebenfalls, sonst bliebe er für
 * immer liegen. Netzwerkfehler lassen ihn stehen, der nächste Versuch folgt.
 */
export function useFocusRecorder() {
  const pending = usePomodoroStore((state) => state.pending)
  const dropPending = usePomodoroStore((state) => state.dropPending)
  const apiFetch = useApiFetch()
  const queryClient = useQueryClient()
  const inFlight = useRef(new Set<string>())

  useEffect(() => {
    for (const entry of pending) {
      if (inFlight.current.has(entry.id)) continue
      inFlight.current.add(entry.id)
      apiFetch('/api/focus', { method: 'POST', body: JSON.stringify(entry) })
        .then(() => {
          dropPending(entry.id)
          void queryClient.invalidateQueries({ queryKey: ['focus'] })
        })
        .catch((error: unknown) => {
          if (error instanceof ApiError && error.status < 500) {
            dropPending(entry.id)
            toast.error(`Fokuszeit nicht gespeichert: ${error.message}`)
          }
        })
        .finally(() => inFlight.current.delete(entry.id))
    }
  }, [pending, apiFetch, dropPending, queryClient])
}
