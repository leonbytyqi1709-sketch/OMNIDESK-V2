import { useQuery } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/use-api'

interface NeonOverview {
  configured: boolean
  userId: string
  links: Array<{ projectId: string; projectName: string; neonProjectId: string; branchId: string }>
}

export interface NeonSnapshot {
  checkedAt: string
  project: { id: string; name: string; region: string | null; postgresVersion: number | null } | null
  branch: { id: string; name: string; state: string; logicalSizeBytes: number | null } | null
  endpoints: Array<{ id: string; state: string; pendingState: string | null; type: string;
    disabled: boolean; lastActive: string | null; minCu: number | null; maxCu: number | null }> | null
  consumption: { projectStorageBytes: number | null; computeCuSeconds: number | null;
    activeSeconds: number | null; transferBytes: number | null; periodStart: string | null; periodEnd: string | null } | null
  unavailable: string[]
}

export function useNeonOverview() {
  const api = useApiFetch()
  return useQuery({ queryKey: ['neon', 'overview'], queryFn: () => api<NeonOverview>('/api/neon'), staleTime: 60_000, retry: false })
}

export function useNeonSnapshot(projectId: string | null) {
  const api = useApiFetch()
  return useQuery({ queryKey: ['neon', 'snapshot', projectId],
    queryFn: () => api<NeonSnapshot>(`/api/neon/${encodeURIComponent(projectId!)}`),
    enabled: Boolean(projectId), staleTime: 60_000, retry: false })
}
