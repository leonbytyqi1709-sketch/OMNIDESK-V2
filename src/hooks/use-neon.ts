import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/use-api'

interface NeonOverview {
  configured: boolean
  userId: string
  links: Array<{ projectId: string; projectName: string; neonProjectId: string; branchId: string }>
}

export type { NeonSnapshot } from '@/types/neon-monitoring'
import type { NeonSnapshot } from '@/types/neon-monitoring'

export function useNeonOverview() {
  const api = useApiFetch()
  const { userId } = useAuth()
  return useQuery({ queryKey: ['neon', userId, 'overview'], queryFn: () => api<NeonOverview>('/api/neon'), staleTime: 60_000, retry: false, enabled: Boolean(userId) })
}

export function useNeonSnapshot(projectId: string | null) {
  const api = useApiFetch()
  const { userId } = useAuth()
  return useQuery({ queryKey: ['neon', userId, 'snapshot', projectId],
    queryFn: () => api<NeonSnapshot>(`/api/neon/${encodeURIComponent(projectId!)}`),
    enabled: Boolean(userId && projectId), staleTime: 60_000, retry: false })
}
