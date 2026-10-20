import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { accountSecurity } from './account-security'
import type { AccountRelationType, LoginDependency } from '../../types/account-map'
export const accountRelations = pgTable('v2_account_relations', {
  id: uuid('id').primaryKey().defaultRandom(), userId: text('user_id').notNull(),
  fromAccountId: uuid('from_account_id').notNull().references(() => accountSecurity.id, { onDelete: 'cascade' }),
  toAccountId: uuid('to_account_id').notNull().references(() => accountSecurity.id, { onDelete: 'cascade' }),
  type: text('type').$type<AccountRelationType>().notNull(), loginDependency: text('login_dependency').$type<LoginDependency>(),
  manualReviewedAt: timestamp('manual_reviewed_at', { withTimezone: true }), version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('v2_account_relations_user').on(t.userId), uniqueIndex('v2_account_relations_pair').on(t.userId, t.fromAccountId, t.toAccountId, t.type),
  check('v2_account_relations_no_self', sql`${t.fromAccountId} <> ${t.toAccountId}`),
  check('v2_account_relations_type', sql`${t.type} IN ('login','recovery_email','recovery_other')`),
  check('v2_account_relations_dependency', sql`(${t.type} = 'login' AND ${t.loginDependency} IS NOT NULL AND ${t.loginDependency} IN ('only_known','alternative_known','unknown')) OR (${t.type} <> 'login' AND ${t.loginDependency} IS NULL)`),
])
