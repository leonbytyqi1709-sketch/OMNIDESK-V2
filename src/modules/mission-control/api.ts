import { createContext, useContext } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/use-api'
import type { MissionSnapshot } from '@/types/mission-control'
export const MissionVisitContext = createContext<string | null>(null)
function missionOptions(
  api: ReturnType<typeof useApiFetch>,
  userId: string | null | undefined,
  projectId: string,
  visitId: string | null,
) {
  return {
    queryKey: ['mission-control', userId, projectId, visitId],
    queryFn: () =>
      api<MissionSnapshot>(
        `/api/mission-control/${encodeURIComponent(projectId)}${visitId ? '/visit' : ''}`,
        visitId
          ? { method: 'POST', body: JSON.stringify({ visitId }) }
          : undefined,
      ),
    enabled: Boolean(userId && projectId),
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: false,
    retry: false as const,
  }
}
export function useMission(projectId: string) {
  const api = useApiFetch(),
    visitId = useContext(MissionVisitContext),
    { userId } = useAuth()
  return useQuery(missionOptions(api, userId, projectId, visitId))
}
export function useMissionOverview(projectIds: string[]) {
  const api = useApiFetch(),
    visitId = useContext(MissionVisitContext),
    { userId } = useAuth()
  return useQueries({
    queries: projectIds.map((id) => missionOptions(api, userId, id, visitId)),
  })
}
