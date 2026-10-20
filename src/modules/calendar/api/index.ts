import { useAuth } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/use-api'
import type { TaskPriority } from '@/db/schema'

export type AppointmentPriority = TaskPriority

/** Termin, wie ihn die API liefert (Timestamps als ISO-Strings). */
export interface AppointmentDto {
  id: string
  title: string
  description: string
  location: string
  priority: AppointmentPriority
  startsAt: string
  endsAt: string
  createdAt: string
  updatedAt: string
}

export interface AppointmentInput {
  title: string
  description: string
  location: string
  priority: AppointmentPriority
  startsAt: string
  endsAt: string
}

const QUERY_KEY = ['appointments'] as const

export function useAppointments() {
  const apiFetch = useApiFetch()
  const { userId } = useAuth()
  return useQuery({
    queryKey: [...QUERY_KEY, userId],
    enabled: Boolean(userId),
    queryFn: () => apiFetch<AppointmentDto[]>('/api/appointments'),
  })
}

function useInvalidateAppointments() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEY })
}

export function useCreateAppointment() {
  const apiFetch = useApiFetch()
  const invalidate = useInvalidateAppointments()
  return useMutation({
    mutationFn: (input: AppointmentInput) =>
      apiFetch<AppointmentDto>('/api/appointments', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  })
}

export function useUpdateAppointment() {
  const apiFetch = useApiFetch()
  const invalidate = useInvalidateAppointments()
  return useMutation({
    mutationFn: ({ id, ...input }: AppointmentInput & { id: string }) =>
      apiFetch<AppointmentDto>(`/api/appointments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  })
}

export function useDeleteAppointment() {
  const apiFetch = useApiFetch()
  const invalidate = useInvalidateAppointments()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/appointments/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}
