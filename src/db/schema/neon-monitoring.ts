import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { projects } from './projects'
import type { NeonSettings, NeonSnapshot, SqlCheck } from '../../types/neon-monitoring'
export const neonMonitoringConfig = pgTable('v2_neon_config', {
  projectId: uuid('project_id').primaryKey().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(), resourceKey: text('resource_key').notNull(),
  settings: jsonb('settings').$type<NeonSettings>().notNull(),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  lastSchedulerAt: timestamp('last_scheduler_at', { withTimezone: true }),
  lastSnapshot: jsonb('last_snapshot').$type<NeonSnapshot>(), lastSql: jsonb('last_sql').$type<SqlCheck>(),
  failures: integer('failures').notNull().default(0), leaseToken: uuid('lease_token'),
  leaseUntil: timestamp('lease_until', { withTimezone: true }), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
export const neonMonitoringSamples = pgTable('v2_neon_samples', {
  id: uuid('id').primaryKey().defaultRandom(), projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(), resourceKey: text('resource_key').notNull(), checkedAt: timestamp('checked_at', { withTimezone: true }).notNull(),
  bucket: timestamp('bucket', { withTimezone: true }).notNull(), source: text('source').notNull(),
  snapshot: jsonb('snapshot').$type<NeonSnapshot>(), sqlCheck: jsonb('sql_check').$type<SqlCheck>(), complete: boolean('complete').notNull(),
}, (t) => [check('v2_neon_samples_source_check', sql`${t.source} IN ('manual','scheduler')`), uniqueIndex('v2_neon_samples_unique').on(t.projectId, t.userId, t.resourceKey, t.bucket), index('v2_neon_samples_lookup').on(t.projectId, t.userId, t.resourceKey, t.checkedAt)])
export const neonMonitoringAlerts = pgTable('v2_neon_alerts', {
  id: uuid('id').primaryKey().defaultRandom(), projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(), resourceKey: text('resource_key').notNull(), code: text('code').notNull(), message: text('message').notNull(),
  severity: text('severity').notNull(), startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }), acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
}, (t) => [uniqueIndex('v2_neon_alerts_open').on(t.projectId, t.userId, t.resourceKey, t.code).where(sql`${t.resolvedAt} IS NULL`)])
