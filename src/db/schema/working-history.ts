import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { projects } from './projects'
export const missionRecords = pgTable(
  'v2_mission_records',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id').notNull(),
    creationHash: text('creation_hash').notNull(),
    title: text('title').notNull(),
    projectId: uuid('project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    state: text('state').notNull(),
    context: text('context').notNull(),
    decisions: text('decisions').notNull(),
    outcome: text('outcome').notNull(),
    questions: text('questions').notNull(),
    nextSteps: text('next_steps').notNull(),
    sources: jsonb('sources').notNull(),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [
    index('v2_mission_records_owner').on(t.userId, t.state, t.updatedAt.desc()),
  ],
)
export const historySettings = pgTable('v2_history_settings', {
  userId: text('user_id').primaryKey(),
  enabled: boolean('enabled').notNull().default(true),
  retentionDays: integer('retention_days').notNull().default(90),
  maxVersions: integer('max_versions').notNull().default(50),
})
export const historyHeads = pgTable(
  'v2_history_heads',
  {
    userId: text('user_id').notNull(),
    kind: text('kind').notNull(),
    objectId: uuid('object_id').notNull(),
    revision: integer('revision').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind, t.objectId] })],
)
export const workingHistory = pgTable(
  'v2_working_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    kind: text('kind').notNull(),
    objectId: uuid('object_id').notNull(),
    revision: integer('revision').notNull(),
    snapshot: jsonb('snapshot').notNull(),
    operation: text('operation').notNull(),
    source: text('source').notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('v2_working_history_user_id_kind_object_id_revision_key').on(
      t.userId,
      t.kind,
      t.objectId,
      t.revision,
    ),
    index('v2_working_history_lookup').on(
      t.userId,
      t.kind,
      t.objectId,
      t.capturedAt.desc(),
    ),
  ],
)
