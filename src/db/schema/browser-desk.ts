import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import type { BrowserPanelEntry } from '../../types/browser-desk'
import { projects } from './projects'
export const browserItems = pgTable(
  'v2_browser_items',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id').notNull(),
    url: text('url').notNull(),
    title: text('title').notNull(),
    selection: text('selection').notNull(),
    annotation: text('annotation').notNull(),
    projectId: uuid('project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('v2_browser_items_owner_url').on(t.userId, t.url, t.updatedAt.desc()),
  ],
)
export const browserPairings = pgTable('v2_browser_pairings', {
  codeHash: text('code_hash').primaryKey(),
  userId: text('user_id').notNull(),
  challenge: text('challenge').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
export const browserDevices = pgTable('v2_browser_devices', {
  id: uuid('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  tokenHash: text('token_hash')
    .notNull()
    .unique('v2_browser_devices_token_hash_key'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
})
/** Konfiguration des Browser-Seitenpanels, eine Zeile je Benutzer. */
export const browserPanel = pgTable('v2_browser_panel', {
  userId: text('user_id').primaryKey(),
  entries: jsonb('entries').$type<BrowserPanelEntry[]>().notNull().default([]),
  showCommands: boolean('show_commands').notNull().default(true),
  commandCategory: text('command_category'),
  version: integer('version').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
