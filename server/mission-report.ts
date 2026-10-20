import { createHash } from 'node:crypto'
import { callBriefingAI, validateBriefingRecommendations } from './briefing-ai'
import { analyzeMission } from '../src/lib/mission-control'
import type { BriefingSnapshot } from '../src/types/briefing'
import type { MissionSnapshot } from '../src/types/mission-control'

/** Reuse Omni's grounded selector. AI may prioritize evidence, never invent the report's facts or execute actions. */
export function missionBriefing(snapshot: MissionSnapshot): BriefingSnapshot {
  const analysis = analyzeMission(snapshot)
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(snapshot.fetchedAt))
  return {
    checkedAt: snapshot.fetchedAt,
    day,
    timeZone: 'Europe/Berlin',
    digest: createHash('sha256')
      .update(JSON.stringify(analysis.facts))
      .digest('hex'),
    previousVisitAt: null,
    storageReady: false,
    preferenceVersion: 1,
    preferences: {
      timeZone: 'Europe/Berlin',
      showOnOpen: false,
      aiEnabled: true,
      sources: {
        tasks: true,
        projects: true,
        calendar: false,
        uptime: true,
        neon: true,
        security: false,
      },
    },
    sections: [
      {
        source: 'projects',
        status: 'ready',
        counts: { facts: analysis.facts.length },
        changes: null,
        items: analysis.facts.map((fact) => ({
          id: fact.id,
          title: `${fact.title}: ${fact.detail}`,
          href: fact.href,
          kind: fact.source,
          state: fact.status,
          at: fact.at,
          reasons: [fact.status === 'attention' ? 'attention' : 'review'],
        })),
      },
    ],
  }
}
export function createMissionReport(select = callBriefingAI) {
  return async (snapshot: MissionSnapshot) => {
    const briefing = missionBriefing(snapshot)
    try {
      const response = validateBriefingRecommendations(
        await select(briefing),
        briefing,
      )
      return {
        mode: 'ai' as const,
        factIds: response.recommendations.map((r) => r.sourceId),
        generatedAt: new Date().toISOString(),
      }
    } catch {
      return {
        mode: 'rules' as const,
        factIds: analyzeMission(snapshot)
          .facts.filter((f) => f.status !== 'ok')
          .slice(0, 3)
          .map((f) => f.id),
        generatedAt: new Date().toISOString(),
      }
    }
  }
}
export const generateMissionReport = createMissionReport()
