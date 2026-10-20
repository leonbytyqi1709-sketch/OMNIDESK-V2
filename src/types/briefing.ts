export const BRIEFING_SOURCES = ['tasks', 'projects', 'calendar', 'uptime', 'neon', 'security'] as const
export type BriefingSource = typeof BRIEFING_SOURCES[number]
export type BriefingReason = 'overdue' | 'today' | 'upcoming' | 'high_priority' | 'attention' | 'review'
export interface BriefingPreferences { timeZone: string; showOnOpen: boolean; aiEnabled: boolean; sources: Record<BriefingSource, boolean> }
export interface BriefingItem { id: string; title: string; href: string; kind: string; state: string; at: string | null; reasons: BriefingReason[] }
export interface BriefingSection { source: BriefingSource; status: 'ready' | 'unavailable' | 'not_configured' | 'excluded'; counts: Record<string, number>; items: BriefingItem[]; changes: number | null }
export interface BriefingSnapshot { checkedAt: string; day: string; timeZone: string; digest: string; previousVisitAt: string | null;
  storageReady: boolean; preferences: BriefingPreferences; preferenceVersion: number; sections: BriefingSection[] }
export interface BriefingRecommendation { sourceId: string; reason: BriefingReason }
export interface BriefingMessage { digest: string; status: 'not_needed' | 'ready' | 'cached' | 'cooldown' | 'unavailable' | 'disabled' | 'pending';
  recommendations: BriefingRecommendation[]; generatedAt: string | null; retryAt: string | null }
