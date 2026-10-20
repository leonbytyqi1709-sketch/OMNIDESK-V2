import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  boolean,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { chatMessages } from './chat'
import type { MemoryCategory } from '../../types/omni-memory'
export const omniMemories = pgTable(
  'v2_omni_memories',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    category: text('category').$type<MemoryCategory>().notNull(),
    projectId: uuid('project_id'),
    pinned: boolean('pinned').notNull().default(false),
    archived: boolean('archived').notNull().default(false),
    sourceMessageId: uuid('source_message_id'),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('v2_omni_memories_owner_idx').on(t.userId, t.updatedAt.desc()),
    check(
      'v2_omni_memories_category_check',
      sql`${t.category} IN ('preference','knowledge','decision')`,
    ),
  ],
)
export const omniMemoryVersions = pgTable(
  'v2_omni_memory_versions',
  {
    memoryId: uuid('memory_id')
      .notNull()
      .references(() => omniMemories.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    category: text('category').$type<MemoryCategory>().notNull(),
    projectId: uuid('project_id'),
    pinned: boolean('pinned').notNull(),
    archived: boolean('archived').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.memoryId, t.version] })],
)
export const omniMemoryReceipts = pgTable(
  'v2_omni_memory_receipts',
  {
    messageId: uuid('message_id')
      .primaryKey()
      .references(() => chatMessages.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    status: text('status').notNull(),
    projectId: uuid('project_id'),
    refs: jsonb('refs')
      .$type<{ id: string; version: number }[]>()
      .notNull()
      .default([]),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      'v2_omni_memory_receipts_status_check',
      sql`${t.status} IN ('used','none','disabled','unavailable')`,
    ),
  ],
)
