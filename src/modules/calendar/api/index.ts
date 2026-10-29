import { useAuth } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/use-api'
import type { TaskPriority } from '@/db/schema'
import type { RecurrenceRule } from '@/lib/recurrence'

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
  /** Gesetzt, wenn der Termin zu einer Serie gehört. */
  seriesId: string | null
}

export interface AppointmentInput {
  title: string
  description: string
  location: string
  priority: AppointmentPriority
  startsAt: string
  endsAt: string
  /** Nur beim Anlegen oder beim Ändern einer ganzen Serie. */
  recurrence?: RecurrenceRule
}

/** „single“ ändert oder löscht nur diesen Termin, „series“ ihn und alle folgenden. */
export type AppointmentScope = 'single' | 'series'

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
    mutationFn: ({
      id,
      scope,
      ...input
    }: AppointmentInput & { id: string; scope?: AppointmentScope }) =>
      apiFetch<AppointmentDto>(
        `/api/appointments/${id}${scope === 'series' ? '?scope=series' : ''}`,
        { method: 'PUT', body: JSON.stringify(input) },
      ),
    onSuccess: invalidate,
  })
}

export function useDeleteAppointment() {
  const apiFetch = useApiFetch()
  const invalidate = useInvalidateAppointments()
  return useMutation({
    mutationFn: ({ id, scope }: { id: string; scope?: AppointmentScope }) =>
      apiFetch<{ ok: true }>(
        `/api/appointments/${id}${scope === 'series' ? '?scope=series' : ''}`,
        { method: 'DELETE' },
      ),
    onSuccess: invalidate,
  })
}

/** Regel einer Serie, für den Bearbeiten-Dialog. */
export function useAppointmentSeries(id: string | null, enabled: boolean) {
  const apiFetch = useApiFetch()
  return useQuery({
    queryKey: ['appointments', 'series', id],
    queryFn: () => apiFetch<{ seriesId: string; rule: RecurrenceRule }>(`/api/appointments/${id}/series`),
    enabled: enabled && Boolean(id),
  })
}
