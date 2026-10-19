import { and, eq } from 'drizzle-orm'
import { db } from '../src/db/client'
import { connectedAccounts, type ConnectedAccount } from '../src/db/schema/integrations'
import { getMicrosoftStorage, openMicrosoftValue, refreshMicrosoftTokens, sealMicrosoftValue } from './microsoft-auth'

/** Refresh token rotation is persisted before Graph is called, even if the quota request later fails. */
export async function syncMicrosoftAccount(
  account: ConnectedAccount,
  persist: (fields: Partial<ConnectedAccount>) => Promise<ConnectedAccount | undefined> = async (fields) => {
    const [updated] = await db.update(connectedAccounts).set(fields).where(and(
      eq(connectedAccounts.id, account.id), eq(connectedAccounts.userId, account.userId),
    )).returning()
    return updated
  },
) {
  let accessToken: string
  if (account.accessToken && account.tokenExpiry && account.tokenExpiry.getTime() > Date.now() + 300_000) {
    accessToken = openMicrosoftValue(account.accessToken, 'token')
  } else {
    if (!account.refreshToken) throw new Error('OneDrive-Anmeldung abgelaufen. Bitte Konto erneut verbinden.')
    const tokens = await refreshMicrosoftTokens(openMicrosoftValue(account.refreshToken, 'token'))
    accessToken = tokens.access_token
    const refreshed = await persist({
      accessToken: sealMicrosoftValue(accessToken, 'token'),
      refreshToken: tokens.refresh_token ? sealMicrosoftValue(tokens.refresh_token, 'token') : account.refreshToken,
      tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      scopes: tokens.scope ?? account.scopes,
    })
    if (!refreshed) throw new Error('OneDrive-Konto wurde zwischenzeitlich getrennt.')
  }
  const storage = await getMicrosoftStorage(accessToken)
  const updated = await persist({
    storageUsedBytes: storage.storageUsedBytes, storageTotalBytes: storage.storageTotalBytes,
    metadata: { ...account.metadata, ...storage.metadata }, updatedAt: new Date(),
  })
  if (!updated) throw new Error('OneDrive-Konto wurde zwischenzeitlich getrennt.')
  return updated
}
