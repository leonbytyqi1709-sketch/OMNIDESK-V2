import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/use-api'
import type { NeonMonitoringState } from '@/types/neon-monitoring'
export function useNeonMonitoring(projectId: string, days: number) {
  const api = useApiFetch()
  const { userId } = useAuth()
  return useQuery({ queryKey: ['neon-monitoring', userId, projectId, days],
    queryFn: () => api<NeonMonitoringState>(`/api/neon/${encodeURIComponent(projectId)}/monitoring?days=${days}`),
    enabled: Boolean(userId), retry: false, staleTime: 30_000, refetchInterval: 60_000 })
}
