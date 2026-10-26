import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/use-api'

/** Befehl, wie ihn die API liefert. */
export interface CommandDto {
  id: string
  title: string
  command: string
  category: string
  createdAt?: string
  updatedAt?: string
}

export interface CommandInput {
  title: string
  command: string
  category: string
}

const QUERY_KEY = ['commands'] as const

/**
 * Gespeicherte Befehle.
 *
 * `enabled` erlaubt Aufrufern wie der Command-Palette, den Abruf erst beim
 * Öffnen auszulösen statt auf jeder Seite der Anwendung.
 */
export function useCommands(enabled = true) {
  const apiFetch = useApiFetch()
  return useQuery({
    queryKey: QUERY_KEY,
    enabled,
    queryFn: () => apiFetch<CommandDto[]>('/api/commands'),
  })
}

function useInvalidateCommands() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEY })
}

export function useCreateCommand() {
  const apiFetch = useApiFetch()
  const invalidate = useInvalidateCommands()
  return useMutation({
    mutationFn: (input: CommandInput) =>
      apiFetch<CommandDto>('/api/commands', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  })
}

/** Mehrere Befehle auf einmal (Starter-Bibliothek). */
export function useCreateCommandsBulk() {
  const apiFetch = useApiFetch()
  const invalidate = useInvalidateCommands()
  return useMutation({
    mutationFn: (inputs: CommandInput[]) =>
      apiFetch<CommandDto[]>('/api/commands/bulk', {
        method: 'POST',
        body: JSON.stringify(inputs),
      }),
    onSuccess: invalidate,
  })
}

export function useUpdateCommand() {
  const apiFetch = useApiFetch()
  const invalidate = useInvalidateCommands()
  return useMutation({
    mutationFn: ({ id, ...input }: CommandInput & { id: string }) =>
      apiFetch<CommandDto>(`/api/commands/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  })
}

export function useDeleteCommand() {
  const apiFetch = useApiFetch()
  const invalidate = useInvalidateCommands()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/commands/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}
