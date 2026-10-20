import { useAuth } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/use-api'
import type {
  MemoryInput,
  MemoryVersion,
  OmniMemory,
} from '@/types/omni-memory'
export function useOmniMemories(open: boolean) {
  const api = useApiFetch(),
    { userId } = useAuth(),
    cache = useQueryClient(),
    key = ['omni-memory', userId]
  const list = useQuery({
    queryKey: key,
    enabled: open && Boolean(userId),
    queryFn: () => api<OmniMemory[]>('/api/omni-memory'),
    staleTime: 30000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const mutation = useMutation({
    mutationFn: (
      action:
        | {
            type: 'create'
            id: string
            input: MemoryInput
            sourceMessageId: string | null
          }
        | { type: 'update'; id: string; input: MemoryInput; version: number }
        | { type: 'delete'; id: string; version: number },
    ) =>
      api(
        '/api/omni-memory' + (action.type === 'create' ? '' : `/${action.id}`),
        {
          method:
            action.type === 'create'
              ? 'POST'
              : action.type === 'update'
                ? 'PUT'
                : 'DELETE',
          body: JSON.stringify(
            action.type === 'delete'
              ? { version: action.version }
              : action.type === 'create'
                ? {
                    ...action.input,
                    id: action.id,
                    sourceMessageId: action.sourceMessageId,
                  }
                : { ...action.input, version: action.version },
          ),
        },
      ),
    onSettled: () =>
      Promise.all([
        cache.invalidateQueries({ queryKey: key }),
        cache.invalidateQueries({ queryKey: ['omni-memory-versions', userId] }),
        cache.invalidateQueries({ queryKey: ['chat-messages'] }),
      ]),
  })
  return { list, mutation }
}
export function useMemoryVersions(id: string | null, open: boolean) {
  const api = useApiFetch(),
    { userId } = useAuth()
  return useQuery({
    queryKey: ['omni-memory-versions', userId, id],
    enabled: Boolean(open && id && userId),
    queryFn: () => api<MemoryVersion[]>(`/api/omni-memory/${id}/versions`),
    retry: false,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
}
