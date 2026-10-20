import { z } from 'zod'
import { BRIEFING_SOURCES } from '../src/types/briefing'
export const briefingPreferencesSchema = z.object({ timeZone: z.string().max(80).refine((value) => { try { new Intl.DateTimeFormat('de-DE', { timeZone: value }); return true } catch { return false } }), showOnOpen: z.boolean(), aiEnabled: z.boolean(), sources: z.object({ tasks: z.boolean(), projects: z.boolean(), calendar: z.boolean(), uptime: z.boolean(), neon: z.boolean(), security: z.boolean() }).strict() }).strict()
export const briefingContextSchema = z.object({ visitId: z.uuid().optional(), exclude: z.array(z.enum(BRIEFING_SOURCES)).max(6).default([]) }).strict()
export const briefingRecommendationsSchema = z.object({ recommendations: z.array(z.object({ sourceId: z.string().max(160), reason: z.enum(['overdue','today','upcoming','high_priority','attention','review']) }).strict()).max(3) }).strict()
