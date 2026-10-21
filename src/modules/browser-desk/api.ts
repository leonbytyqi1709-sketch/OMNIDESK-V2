import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/use-api'
import type { BrowserItem, BrowserProject } from '@/types/browser-desk'
export function useBrowserItems(projectId: string | null = null) {
  const api = useApiFetch(),
    { userId } = useAuth()
  return useQuery({
    queryKey: ['browser-items', userId, projectId],
    queryFn: () =>
      api<{ items: BrowserItem[]; limited: boolean }>(
        `/api/browser/items${projectId ? '?projectId=' + encodeURIComponent(projectId) : ''}`,
      ),
    enabled: Boolean(userId),
    retry: false,
  })
}
export function useBrowserProjects() {
  const api = useApiFetch(),
    { userId } = useAuth()
  return useQuery({
    queryKey: ['browser-projects', userId],
    queryFn: () => api<BrowserProject[]>('/api/browser/projects'),
    enabled: Boolean(userId),
    retry: false,
  })
}
