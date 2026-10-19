import type { ConnectedAccount } from '../src/db/schema/integrations'

/** Credentials must never be returned by account detail or synchronization endpoints. */
export function publicAccount(account: ConnectedAccount) {
  return {
    id: account.id, userId: account.userId, provider: account.provider, email: account.email,
    label: account.label, avatarUrl: account.avatarUrl, storageUsedBytes: account.storageUsedBytes,
    storageTotalBytes: account.storageTotalBytes, metadata: account.metadata,
    hasRefreshToken: Boolean(account.refreshToken), createdAt: account.createdAt, updatedAt: account.updatedAt,
  }
}
