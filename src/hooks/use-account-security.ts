import { useAuth } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/use-api'
import type { SecurityOverview } from '@/types/account-security'
export function useSecurityOverview() {
  const api = useApiFetch(); const { userId } = useAuth()
  return useQuery({ queryKey: ['account-security', userId], queryFn: () => api<SecurityOverview>('/api/account-security'),
    enabled: Boolean(userId), staleTime: 30_000, refetchInterval: 60_000, retry: false })
}
export function useSecurityMutation() {
  const api = useApiFetch(); const cache = useQueryClient(); const { userId } = useAuth()
  return useMutation({ mutationFn: ({ path = '', method, body }: { path?: string; method: 'POST' | 'PUT' | 'DELETE'; body?: unknown }) =>
    api<{ id?: string; ok?: boolean }>(`/api/account-security${path}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) }),
    onSettled: () => cache.invalidateQueries({ queryKey: ['account-security', userId] }) })
}
