import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/use-api'
import type { MissionSnapshot } from '@/types/mission-control'
export function useMission(projectId: string) {
  const api = useApiFetch()
  const { userId } = useAuth()
  return useQuery({
    queryKey: ['mission-control', userId, projectId],
    queryFn: () =>
      api<MissionSnapshot>(
        `/api/mission-control/${encodeURIComponent(projectId)}`,
      ),
    enabled: Boolean(userId && projectId),
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: false,
    retry: false,
  })
}
