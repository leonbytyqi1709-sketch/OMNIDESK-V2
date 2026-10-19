import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/use-api'
import type { DeploymentLogs, DeploymentSnapshot } from '@/types/deployments'

interface DeploymentsOverview {
  warning?: string
  configured: boolean
  userId: string
  links: Array<{ projectId: string; projectName: string; vercelProjectId: string; teamId: string | null }>
}

export function useDeploymentsOverview(account = false) {
  const api = useApiFetch()
  const { userId } = useAuth()
  return useQuery({ queryKey: ['deployments', userId, 'overview', account], queryFn: async (): Promise<DeploymentsOverview> => {
    if (!account) return api<DeploymentsOverview>('/api/deployments')
    const result = await api<{ projects: Array<{ id: string; name: string; teamId: string | null; scope: string }>; unavailable: string[]; limited: boolean }>('/api/deployments/account/projects')
    return { configured: true, userId: userId!, links: result.projects.map((p) => ({ projectId: `${p.id}:${p.teamId ?? ''}`, vercelProjectId: p.id, projectName: `${p.name} · ${p.scope}`, teamId: p.teamId })), warning: [...result.unavailable.map((scope) => `${scope} konnte nicht geladen werden`), ...(result.limited ? ['Die Projektliste wurde begrenzt.'] : [])].join('. ') }
  }, enabled: Boolean(userId), retry: false, staleTime: 60_000 })
}

export function useDeploymentSnapshot(projectId: string | null, account = false, teamId: string | null = null) {
  const api = useApiFetch()
  const { userId } = useAuth()
  return useQuery({ queryKey: ['deployments', userId, 'snapshot', projectId, account, teamId], queryFn: () => api<DeploymentSnapshot>(`/api/deployments/${account ? 'account/projects/' : ''}${encodeURIComponent(projectId!)}${account && teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''}`),
    enabled: Boolean(userId && projectId), retry: false, staleTime: 30_000 })
}

export function useDeploymentLogs(projectId: string | null, deploymentId: string | null, account = false, teamId: string | null = null) {
  const api = useApiFetch()
  const { userId } = useAuth()
  return useQuery({ queryKey: ['deployments', userId, 'logs', projectId, deploymentId, account, teamId],
    queryFn: () => api<DeploymentLogs>(`/api/deployments/${account ? 'account/projects/' : ''}${encodeURIComponent(projectId!)}/${encodeURIComponent(deploymentId!)}/logs${account && teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''}`),
    enabled: Boolean(userId && projectId && deploymentId), retry: false, staleTime: 30_000 })
}
