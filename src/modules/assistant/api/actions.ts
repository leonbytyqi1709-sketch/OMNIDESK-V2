import { useAuth } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/use-api'
import type { OmniActionPlan, OmniPlanningResponse } from '@/types/omni-actions'
export function useOmniActions(open: boolean) {
  const api = useApiFetch(),
    cache = useQueryClient(),
    { userId } = useAuth(),
    key = ['omni-actions', userId]
  const history = useQuery({
    queryKey: key,
    enabled: open && Boolean(userId),
    queryFn: () => api<OmniActionPlan[]>('/api/omni-actions'),
    retry: false,
    staleTime: 0,
  })
  const plan = useMutation({
    mutationFn: (input: {
      prompt: string
      timeZone: string
      requestId: string
    }) =>
      api<OmniPlanningResponse>('/api/omni-actions/plan', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => cache.invalidateQueries({ queryKey: key }),
  })
  const act = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string
      action: 'confirm' | 'cancel'
    }) =>
      api<OmniActionPlan | { ok: true }>(`/api/omni-actions/${id}/${action}`, {
        method: 'POST',
        body: '{}',
      }),
    onSettled: () =>
      Promise.all([
        cache.invalidateQueries({ queryKey: key }),
        ...['tasks', 'projects', 'appointments', 'briefing'].map((module) =>
          cache.invalidateQueries({ queryKey: [module] }),
        ),
      ]),
  })
  return { history, plan, act }
}
