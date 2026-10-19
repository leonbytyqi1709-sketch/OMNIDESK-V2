import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

export const INTEGRATION_PROVIDERS = ['google', 'mega'] as const
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number]

export interface AccountStorageMetadata {
  usedBytes: number
  totalBytes: number
  driveBytes?: number
  trashBytes?: number
  lastSyncedAt?: string
}

/** Verbundene externe Konten für Google Drive und MEGA (Spec Phase 4). */
export const connectedAccounts = pgTable(
  'connected_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    provider: text('provider').$type<IntegrationProvider>().notNull(),
    email: text('email').notNull(),
    label: text('label').notNull().default(''),
    avatarUrl: text('avatar_url'),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    tokenExpiry: timestamp('token_expiry', { withTimezone: true }),
    scopes: text('scopes'),
    storageUsedBytes: text('storage_used_bytes').notNull().default('0'),
    storageTotalBytes: text('storage_total_bytes').notNull().default('0'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('connected_accounts_user_id_idx').on(t.userId),
    index('connected_accounts_provider_idx').on(t.provider),
  ],
)

export type ConnectedAccount = typeof connectedAccounts.$inferSelect
export type NewConnectedAccount = typeof connectedAccounts.$inferInsert
