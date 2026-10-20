import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { chatMessages } from './chat'
import { omniMemories } from './omni-memory'
export const omniMemoryCaptures = pgTable(
  'v2_omni_memory_captures',
  {
    sourceId: uuid('source_id')
      .primaryKey()
      .references(() => chatMessages.id, { onDelete: 'cascade' }),
    assistantId: uuid('assistant_id')
      .notNull()
      .references(() => chatMessages.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    projectId: uuid('project_id'),
    status: text('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      'v2_omni_memory_captures_status_check',
      sql`${t.status} IN ('processing','done','failed')`,
    ),
  ],
)
export const omniMemoryAutoEvents = pgTable(
  'v2_omni_memory_auto_events',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id').notNull(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => omniMemoryCaptures.sourceId, { onDelete: 'cascade' }),
    slot: integer('slot').notNull(),
    projectId: uuid('project_id'),
    targetId: uuid('target_id').notNull(),
    targetVersion: integer('target_version'),
    memoryId: uuid('memory_id').references(() => omniMemories.id, {
      onDelete: 'cascade',
    }),
    savedVersion: integer('saved_version'),
    status: text('status').notNull(),
    proposal: jsonb('proposal').$type<{
      title: string
      content: string
      category: string
    } | null>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('v2_omni_memory_auto_events_source_id_slot_key').on(
      t.sourceId,
      t.slot,
    ),
    index('v2_omni_memory_auto_owner_idx').on(t.userId, t.createdAt.desc()),
    check(
      'v2_omni_memory_auto_events_status_check',
      sql`${t.status} IN ('pending','saved','dismissed')`,
    ),
  ],
)
