import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { connectedAccounts } from './integrations'
import type { SecurityAccountInput } from '../../types/account-security'
export const accountSecurity = pgTable('v2_account_security', {
  id: uuid('id').primaryKey().defaultRandom(), userId: text('user_id').notNull(),
  connectedAccountId: uuid('connected_account_id').references(() => connectedAccounts.id, { onDelete: 'set null' }),
  details: jsonb('details').$type<Omit<SecurityAccountInput, 'connectedAccountId' | 'reviewed'>>().notNull(),
  manualReviewedAt: timestamp('manual_reviewed_at', { withTimezone: true }), version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('v2_account_security_user').on(t.userId), uniqueIndex('v2_account_security_connection').on(t.userId, t.connectedAccountId).where(sql`${t.connectedAccountId} IS NOT NULL`)])
