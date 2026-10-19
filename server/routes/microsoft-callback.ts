import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { deleteCookie, getCookie } from 'hono/cookie'
import { db } from '../../src/db/client'
import { connectedAccounts, type NewConnectedAccount } from '../../src/db/schema/integrations'
import { MICROSOFT_COOKIE, MICROSOFT_COOKIE_PATH, exchangeMicrosoftCode, getMicrosoftProfile,
  getMicrosoftStorage, microsoftConfig, readMicrosoftTransaction, sealMicrosoftValue } from '../microsoft-auth'

async function persistMicrosoftConnection(connection: NewConnectedAccount) {
  const accounts = await db.select().from(connectedAccounts).where(and(
    eq(connectedAccounts.userId, connection.userId), eq(connectedAccounts.provider, 'microsoft'),
  ))
  const existing = accounts.find((account) => account.metadata?.microsoftUserId === connection.metadata?.microsoftUserId)
  if (existing) {
    await db.update(connectedAccounts).set({ ...connection,
      label: existing.label || connection.label,
      refreshToken: connection.refreshToken ?? existing.refreshToken,
    }).where(and(eq(connectedAccounts.id, existing.id), eq(connectedAccounts.userId, connection.userId)))
  } else {
    await db.insert(connectedAccounts).values(connection)
  }
}

export function createMicrosoftCallbackRoute(persist = persistMicrosoftConnection) {
  const route = new Hono()
  route.get('/callback', async (c) => {
  c.header('Cache-Control', 'no-store')
  c.header('Referrer-Policy', 'no-referrer')
  let origin: string
  try { origin = microsoftConfig().origin } catch {
    return c.json({ error: 'OneDrive ist noch nicht vollständig konfiguriert.' }, 503)
  }
  const redirect = (destination: string, key: string, value: string) => {
    const url = new URL(destination, origin)
    url.searchParams.set(key, value)
    return c.redirect(url.toString())
  }
  try {
    // Binding to an encrypted HttpOnly cookie prevents choosing another OMNIDESK user via state.
    const transaction = readMicrosoftTransaction(getCookie(c, MICROSOFT_COOKIE), c.req.query('state'))
    deleteCookie(c, MICROSOFT_COOKIE, { path: MICROSOFT_COOKIE_PATH, secure: microsoftConfig().secure, httpOnly: true, sameSite: 'Lax' })
    if (c.req.query('error')) return redirect(transaction.returnTo, 'error', 'Microsoft-Anmeldung abgebrochen oder nicht erlaubt.')
    const code = c.req.query('code')
    if (!code) return redirect(transaction.returnTo, 'error', 'Microsoft hat keinen Anmeldecode zurückgegeben.')
    const tokens = await exchangeMicrosoftCode(code, transaction.verifier)
    const [profile, storage] = await Promise.all([getMicrosoftProfile(tokens.access_token), getMicrosoftStorage(tokens.access_token)])
    await persist({ userId: transaction.userId, provider: 'microsoft', email: profile.email,
      label: profile.displayName || 'OneDrive', accessToken: sealMicrosoftValue(tokens.access_token, 'token'),
      refreshToken: tokens.refresh_token ? sealMicrosoftValue(tokens.refresh_token, 'token') : null,
      tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000), scopes: tokens.scope ?? null,
      storageUsedBytes: storage.storageUsedBytes, storageTotalBytes: storage.storageTotalBytes,
      metadata: { ...storage.metadata, microsoftUserId: profile.id }, updatedAt: new Date() })
    return redirect(transaction.returnTo, 'connected', 'microsoft')
  } catch {
    // Never forward provider error bodies, codes or tokens into redirect URLs or logs.
    return redirect('/settings', 'error', 'OneDrive konnte nicht verbunden werden. Bitte Anmeldung erneut starten und Microsoft-Konfiguration sowie Speicherberechtigungen prüfen.')
  }
})

  return route
}

export const microsoftCallbackRoute = createMicrosoftCallbackRoute()
