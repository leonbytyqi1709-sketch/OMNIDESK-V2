import { integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import type { BriefingPreferences, BriefingRecommendation } from '../../types/briefing'
export const briefingState = pgTable('v2_briefing_state', {
  userId: text('user_id').primaryKey(), preferences: jsonb('preferences').$type<BriefingPreferences>().notNull(), version: integer('version').notNull().default(1),
  lastVisitAt: timestamp('last_visit_at', { withTimezone: true }), aiDigest: text('ai_digest'), aiMessage: jsonb('ai_message').$type<{ recommendations: BriefingRecommendation[] }>(),
  aiGeneratedAt: timestamp('ai_generated_at', { withTimezone: true }), nextAiAt: timestamp('next_ai_at', { withTimezone: true }), leaseToken: uuid('lease_token'), leaseUntil: timestamp('lease_until', { withTimezone: true }),
})
export const briefingVisits = pgTable('v2_briefing_visits', {
  userId: text('user_id').notNull(), visitId: uuid('visit_id').notNull(), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), previousVisitAt: timestamp('previous_visit_at', { withTimezone: true }),
}, (t) => [primaryKey({ columns: [t.userId, t.visitId] })])
