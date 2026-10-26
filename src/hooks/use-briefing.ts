import { useMemo } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/use-api'
import { useSettingsStore } from '@/stores/settings'
import type { BriefingMessage, BriefingPreferences, BriefingSnapshot, BriefingSource } from '@/types/briefing'
export const BRIEFING_VISIT_ID = crypto.randomUUID()
export function useBriefingContext() {
  const disabled = useSettingsStore((state) => state.disabledModules)
  const exclude = useMemo<BriefingSource[]>(() => {
    const sources: BriefingSource[] = []
    for (const source of ['tasks', 'projects', 'calendar', 'uptime', 'security'] as const) {
      if (disabled.includes(source === 'security' ? 'account-security' : source)) sources.push(source)
    }
    if (disabled.includes('uptime')) sources.push('neon')
    return sources
  }, [disabled])
  return { visitId: BRIEFING_VISIT_ID, exclude, aiModuleEnabled: !disabled.includes('assistant') }
}
export function useBriefingFacts() {
  const api = useApiFetch(), { userId } = useAuth(), cache = useQueryClient(), context = useBriefingContext()
  // Früher wurde die Faktenabfrage nach JEDER erfolgreichen Mutation der App
  // ungültig gemacht. Da sie Aufgaben, Projekte, Kalender, Uptime, Neon und
  // Kontosicherheit zusammenträgt, löste schon ein Notiz-Autosave einen
  // teuren Sammelabruf aus. Die Fakten werden stattdessen beim Öffnen des
  // Briefings aktualisiert; der Knopf lädt sie ab 60 Sekunden Alter neu.
  return useQuery({ queryKey: ['briefing', userId, 'facts', context.exclude.join(',')], enabled: Boolean(userId), retry: false, staleTime: 60_000, refetchOnWindowFocus: false,
    queryFn: async () => {
      let visitRecorded = true
      try { await cache.fetchQuery({ queryKey: ['briefing', userId, 'visit', context.visitId], staleTime: Infinity, retry: false, queryFn: () => api('/api/briefing/visit', { method: 'POST', body: JSON.stringify({ visitId: context.visitId }) }) }) } catch { visitRecorded = false }
      const facts = await api<BriefingSnapshot>(`/api/briefing?visitId=${context.visitId}&exclude=${context.exclude.join(',')}`)
      return { ...facts, visitRecorded }
    } })
}
export function useBriefingMessage(snapshot: BriefingSnapshot | undefined, open: boolean) {
  const api = useApiFetch(), { userId } = useAuth(), context = useBriefingContext(), cache = useQueryClient()
  return useQuery({ queryKey: ['briefing', userId, 'message', snapshot?.digest], enabled: Boolean(userId && open && snapshot?.preferences.aiEnabled && snapshot.storageReady && context.aiModuleEnabled),
    staleTime: 30 * 60_000, retry: false, refetchOnMount: false, refetchOnWindowFocus: false,
    queryFn: async () => {
      const response = await api<BriefingMessage>('/api/briefing/message', { method: 'POST', body: JSON.stringify({ visitId: context.visitId, exclude: context.exclude }) })
      if (snapshot && response.digest !== snapshot.digest) void cache.invalidateQueries({ queryKey: ['briefing', userId, 'facts'] })
      return response
    } })
}
export function useBriefingPreferences() {
  const api = useApiFetch(), cache = useQueryClient(), { userId } = useAuth()
  return useMutation({ mutationFn: ({ preferences, version }: { preferences: BriefingPreferences; version: number }) => api('/api/briefing/preferences', { method: 'PUT', body: JSON.stringify({ preferences, version }) }),
    onSettled: async () => { await Promise.all([cache.invalidateQueries({ queryKey: ['briefing', userId, 'facts'] }), cache.removeQueries({ queryKey: ['briefing', userId, 'message'] })]) } })
}
