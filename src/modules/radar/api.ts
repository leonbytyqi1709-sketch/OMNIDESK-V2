import { useAuth } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/use-api'
import type { RadarOverview } from '@/types/radar'
export function useRadar(savedOnly = false) {
  const api = useApiFetch(),
    { userId } = useAuth(),
    cache = useQueryClient(),
    key = ['radar', userId, savedOnly ? 'saved' : 'all']
  const data = useQuery({
    queryKey: key,
    enabled: Boolean(userId),
    queryFn: () =>
      api<RadarOverview>('/api/radar' + (savedOnly ? '?view=saved' : '')),
    staleTime: 60000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const action = useMutation({
    mutationFn: ({
      path,
      method = 'POST',
      body = {},
    }: {
      path: string
      method?: 'POST' | 'PUT' | 'DELETE'
      body?: unknown
    }) => api('/api/radar' + path, { method, body: JSON.stringify(body) }),
    onSettled: () =>
      Promise.all([
        cache.invalidateQueries({ queryKey: ['radar', userId] }),
        cache.invalidateQueries({ queryKey: ['omni-memory'] }),
      ]),
  })
  return { data, action }
}
