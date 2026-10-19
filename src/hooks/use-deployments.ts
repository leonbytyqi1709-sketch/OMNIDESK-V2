import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/use-api'
import type { DeploymentLogs, DeploymentSnapshot } from '@/types/deployments'

interface DeploymentsOverview {
  configured: boolean
  userId: string
  links: Array<{ projectId: string; projectName: string; vercelProjectId: string; teamId: string | null }>
}

export function useDeploymentsOverview() {
  const api = useApiFetch()
  const { userId } = useAuth()
  return useQuery({ queryKey: ['deployments', userId, 'overview'], queryFn: () => api<DeploymentsOverview>('/api/deployments'), enabled: Boolean(userId), retry: false, staleTime: 60_000 })
}

export function useDeploymentSnapshot(projectId: string | null) {
  const api = useApiFetch()
  const { userId } = useAuth()
  return useQuery({ queryKey: ['deployments', userId, 'snapshot', projectId], queryFn: () => api<DeploymentSnapshot>(`/api/deployments/${encodeURIComponent(projectId!)}`),
    enabled: Boolean(userId && projectId), retry: false, staleTime: 30_000 })
}

export function useDeploymentLogs(projectId: string | null, deploymentId: string | null) {
  const api = useApiFetch()
  const { userId } = useAuth()
  return useQuery({ queryKey: ['deployments', userId, 'logs', projectId, deploymentId],
    queryFn: () => api<DeploymentLogs>(`/api/deployments/${encodeURIComponent(projectId!)}/${encodeURIComponent(deploymentId!)}/logs`),
    enabled: Boolean(userId && projectId && deploymentId), retry: false, staleTime: 30_000 })
}
