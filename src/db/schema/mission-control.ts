import {
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { projects } from './projects'
import type { MissionObservation } from '../../types/mission-control'
export const missionSettings = pgTable('v2_mission_settings', {
  projectId: uuid('project_id')
    .primaryKey()
    .references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  monitorIds: jsonb('monitor_ids').$type<string[]>().notNull(),
  version: integer('version').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
export const missionVisits = pgTable(
  'v2_mission_visits',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    visitId: uuid('visit_id').notNull(),
    baseline: jsonb('baseline').$type<MissionObservation>(),
    baselineAt: timestamp('baseline_at', { withTimezone: true }),
    latest: jsonb('latest').$type<MissionObservation>().notNull(),
    lastVisitAt: timestamp('last_visit_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId, t.visitId] })],
)
export const missionAiLimits = pgTable('v2_mission_ai_limits', {
  userId: text('user_id').primaryKey(),
  nextAt: timestamp('next_at', { withTimezone: true }).notNull(),
})
