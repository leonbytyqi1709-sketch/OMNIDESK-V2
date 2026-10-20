import { sql } from 'drizzle-orm'
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import type {
  OmniActionPreview,
  OmniActionResult,
} from '../../types/omni-actions'
export const omniActionPlans = pgTable(
  'v2_omni_action_plans',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id').notNull(),
    requestId: uuid('request_id').notNull(),
    prompt: text('prompt').notNull(),
    timeZone: text('time_zone').notNull(),
    status: text('status').notNull().default('pending'),
    operations: jsonb('operations').notNull(),
    previews: jsonb('previews').$type<OmniActionPreview[]>().notNull(),
    resultLinks: jsonb('result_links').$type<OmniActionResult[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '15 minutes'`),
    executedAt: timestamp('executed_at', { withTimezone: true }),
  },
  (t) => [
    unique('v2_omni_action_plans_user_id_request_id_key').on(
      t.userId,
      t.requestId,
    ),
    index('v2_omni_action_plans_owner_idx').on(t.userId, t.createdAt.desc()),
    check(
      'v2_omni_action_plans_status_check',
      sql`${t.status} IN ('pending','executed','cancelled')`,
    ),
  ],
)
export const omniActionLimits = pgTable('v2_omni_action_limits', {
  userId: text('user_id').primaryKey(),
  nextPlanAt: timestamp('next_plan_at', { withTimezone: true }).notNull(),
})
