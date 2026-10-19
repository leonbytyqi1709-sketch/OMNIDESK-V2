import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/use-api'

export interface ConnectedAccountDto {
  id: string
  provider: 'google' | 'mega' | 'microsoft'
  email: string
  label: string
  avatarUrl: string | null
  storageUsedBytes: string
  storageTotalBytes: string
  metadata: {
    driveUsage?: string
    trashUsage?: string
    filesCount?: number
    lastSyncedAt?: string
    [key: string]: unknown
  }
  createdAt: string
  updatedAt: string
}

export interface CloudOverviewDto {
  summary: {
    totalUsedBytes: string
    totalCapacityBytes: string
    googleUsedBytes: string
    googleCapacityBytes: string
    megaUsedBytes: string
    megaCapacityBytes: string
    accountsCount: number
    googleCount: number
    microsoftUsedBytes: string
    microsoftCapacityBytes: string
    microsoftCount: number
    megaCount: number
  }
  accounts: ConnectedAccountDto[]
}

export interface ConnectAccountInput {
  provider: 'google' | 'mega'
  email: string
  password?: string
  label?: string
  storageUsedBytes?: string
  storageTotalBytes?: string
}

const QUERY_KEY = ['cloud-monitor'] as const

export function useGoogleAuthUrl() {
  const apiFetch = useApiFetch()
  return useMutation({
    mutationFn: (returnTo?: string) =>
      apiFetch<{ url: string }>(
        `/api/integrations/google/auth-url${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`,
      ),
  })
}

export function useMicrosoftAuthUrl() {
  const apiFetch = useApiFetch()
  return useMutation({
    mutationFn: (returnTo?: string) => apiFetch<{ url: string }>(
      `/api/integrations/microsoft/auth-url${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`,
    ),
  })
}

export function useCloudOverview() {
  const apiFetch = useApiFetch()
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiFetch<CloudOverviewDto>('/api/cloud-monitor/overview'),
  })
}

export function useConnectAccount() {
  const apiFetch = useApiFetch()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ConnectAccountInput) =>
      apiFetch<ConnectedAccountDto>('/api/integrations/accounts', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['integrations-accounts'] })
    },
  })
}

export function useDeleteAccount() {
  const apiFetch = useApiFetch()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/integrations/accounts/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['integrations-accounts'] })
    },
  })
}

export function useSyncAccount() {
  const apiFetch = useApiFetch()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ConnectedAccountDto>(`/api/integrations/accounts/${id}/sync`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}
