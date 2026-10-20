import {
  boolean,
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
import type { RadarCategory } from '../../types/radar'
export const radarTopics = pgTable('v2_radar_topics', {
  id: uuid('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  keywords: jsonb('keywords').$type<string[]>().notNull(),
  projectId: uuid('project_id'),
  enabled: boolean('enabled').notNull().default(true),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
export const radarSources = pgTable(
  'v2_radar_sources',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id').notNull(),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => radarTopics.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    url: text('url').notNull(),
    category: text('category').$type<RadarCategory>().notNull(),
    enabled: boolean('enabled').notNull().default(true),
    version: integer('version').notNull().default(1),
    lastAttempt: timestamp('last_attempt', { withTimezone: true }),
    lastSuccess: timestamp('last_success', { withTimezone: true }),
    lastSchedulerAt: timestamp('last_scheduler_at', { withTimezone: true }),
    error: text('error'),
    etag: text('etag'),
    modified: text('modified'),
    leaseToken: uuid('lease_token'),
    leaseUntil: timestamp('lease_until', { withTimezone: true }),
  },
  (t) => [
    unique('v2_radar_sources_user_id_topic_id_url_key').on(
      t.userId,
      t.topicId,
      t.url,
    ),
    check(
      'v2_radar_sources_category_check',
      sql`${t.category} IN ('news','security','release','status')`,
    ),
  ],
)
export const radarItems = pgTable(
  'v2_radar_items',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id').notNull(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => radarSources.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    url: text('url').notNull(),
    excerpt: text('excerpt').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    foundAt: timestamp('found_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    read: boolean('read').notNull().default(false),
    saved: boolean('saved').notNull().default(false),
    projectId: uuid('project_id'),
    projectOverride: boolean('project_override').notNull().default(false),
    memoryId: uuid('memory_id').notNull().defaultRandom(),
    explanation: jsonb('explanation').$type<{
      summary: string
      relevance: string
    } | null>(),
    explanationAt: timestamp('explanation_at', { withTimezone: true }),
  },
  (t) => [
    unique('v2_radar_items_source_id_url_key').on(t.sourceId, t.url),
    index('v2_radar_items_owner_idx').on(t.userId, t.foundAt.desc()),
  ],
)
