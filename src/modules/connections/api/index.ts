import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/use-api'
import type { ConnectedItem, ConnectionEnd, ConnectionKind } from '@/lib/connections'

export interface ConnectionHit {
  kind: ConnectionKind
  id: string
  title: string
  detail: string
}

const key = (end: ConnectionEnd) => ['connections', end.kind, end.id] as const

/** Verknüpfungen eines Objekts. `enabled: false`, solange es noch keine Kennung hat. */
export function useConnections(end: ConnectionEnd | null) {
  const apiFetch = useApiFetch()
  return useQuery({
    queryKey: end ? key(end) : ['connections', 'none'],
    queryFn: () => apiFetch<ConnectedItem[]>(`/api/connections/${end!.kind}/${end!.id}`),
    enabled: Boolean(end),
  })
}

/**
 * Auswahl für den Verknüpfen-Dialog. Ohne Suchbegriff kommen die jüngsten
 * Einträge, damit die Liste nicht leer startet.
 */
export function useConnectionSearch(term: string, enabled: boolean) {
  const apiFetch = useApiFetch()
  return useQuery({
    queryKey: ['connections', 'search', term],
    queryFn: () => apiFetch<ConnectionHit[]>(`/api/connections/search?q=${encodeURIComponent(term)}`),
    enabled,
    staleTime: 30_000,
  })
}

/**
 * Beide Seiten werden ungültig gemacht: Die Verknüpfung erscheint sonst nur
 * dort, wo man sie angelegt hat.
 */
function useRefreshBothSides() {
  const queryClient = useQueryClient()
  return (one: ConnectionEnd, other: ConnectionEnd) => {
    void queryClient.invalidateQueries({ queryKey: key(one) })
    void queryClient.invalidateQueries({ queryKey: key(other) })
  }
}

export function useConnect() {
  const apiFetch = useApiFetch()
  const refresh = useRefreshBothSides()
  return useMutation({
    mutationFn: (input: { source: ConnectionEnd; target: ConnectionEnd }) =>
      apiFetch<{ connectionId: string }>('/api/connections', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (_result, input) => refresh(input.source, input.target),
  })
}

export function useDisconnect() {
  const apiFetch = useApiFetch()
  const refresh = useRefreshBothSides()
  return useMutation({
    mutationFn: (input: { connectionId: string; source: ConnectionEnd; target: ConnectionEnd }) =>
      apiFetch<{ ok: true }>(`/api/connections/${input.connectionId}`, { method: 'DELETE' }),
    onSuccess: (_result, input) => refresh(input.source, input.target),
  })
}
