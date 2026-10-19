import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/use-api'
import type { GitHubOverview, GitHubSnapshot } from '@/types/github'
export function useGitHubOverview() {
  const api = useApiFetch(); const { userId } = useAuth()
  return useQuery({ queryKey: ['github', userId, 'overview'], queryFn: () => api<GitHubOverview>('/api/github'), enabled: Boolean(userId), retry: false, staleTime: 60_000 })
}
export function useGitHubSnapshot(repository: string | null) {
  const api = useApiFetch(); const { userId } = useAuth()
  return useQuery({ queryKey: ['github', userId, 'repository', repository],
    queryFn: () => api<GitHubSnapshot>(`/api/github/repositories/${repository!.split('/').map(encodeURIComponent).join('/')}`),
    enabled: Boolean(userId && repository), retry: false, staleTime: 60_000 })
}
