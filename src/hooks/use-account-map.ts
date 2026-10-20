import { useAuth } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/use-api'
import type { AccountMapOverview } from '@/types/account-map'
export function useAccountMap() {
  const api = useApiFetch(); const { userId } = useAuth()
  return useQuery({ queryKey: ['account-map', userId], queryFn: () => api<AccountMapOverview>('/api/account-map'), enabled: Boolean(userId), retry: false, staleTime: 30_000, refetchInterval: 60_000 })
}
export function useAccountMapMutation() {
  const api = useApiFetch(); const cache = useQueryClient(); const { userId } = useAuth()
  return useMutation({ mutationFn: ({ path = '', method, body }: { path?: string; method: 'POST' | 'PUT' | 'DELETE'; body?: unknown }) =>
    api<{ id?: string; ok?: boolean }>(`/api/account-map${path}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) }),
    onSettled: async () => { await Promise.all([cache.invalidateQueries({ queryKey: ['account-map', userId] }), cache.invalidateQueries({ queryKey: ['account-security', userId] })]) } })
}
