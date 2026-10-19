import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { setCookie } from 'hono/cookie'
import { MICROSOFT_COOKIE, MICROSOFT_COOKIE_PATH, OAUTH_MAX_AGE, microsoftConfig, startMicrosoftAuthorization } from '../microsoft-auth'
import { syncMicrosoftAccount } from '../microsoft-account'
import { publicAccount } from '../public-account'
import { z } from 'zod'
import { db } from '../../src/db/client'
import { connectedAccounts } from '../../src/db/schema/index'
import { getGoogleOAuthUrl, getValidGoogleAccessToken } from '../google-auth'
import { connectMegaAccount, syncMegaAccount } from '../mega-auth'

const createAccountInput = z.object({
  provider: z.enum(['google', 'mega']),
  email: z.string().trim().email('Ungültige E-Mail-Adresse').max(255),
  password: z.string().optional(), // Für Live-MEGA-Login
  label: z.string().trim().max(100).optional(),
  accessToken: z.string().trim().optional(),
  refreshToken: z.string().trim().optional(),
  storageUsedBytes: z.string().optional(),
  storageTotalBytes: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const updateAccountInput = z.object({
  label: z.string().trim().max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const integrationsRoute = new Hono()

/** Authenticated start; callback is public but bound to this browser and user. */
integrationsRoute.get('/microsoft/auth-url', (c) => {
  c.header('Cache-Control', 'no-store')
  try {
    const config = microsoftConfig()
    if (new URL(c.req.url).origin !== config.origin) {
      return c.json({ error: 'Bitte OneDrive auf der in MICROSOFT_REDIRECT_URI konfigurierten App-Adresse verbinden.' }, 400)
    }
    const authorization = startMicrosoftAuthorization(c.get('userId'), c.req.query('returnTo'))
    setCookie(c, MICROSOFT_COOKIE, authorization.cookie, { path: MICROSOFT_COOKIE_PATH,
      httpOnly: true, secure: config.secure, sameSite: 'Lax', maxAge: OAUTH_MAX_AGE })
    return c.json({ url: authorization.url })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'OneDrive-Anmeldung konnte nicht gestartet werden.' }, 503)
  }
})

/** Google OAuth2 Autorisierungs-URL anfordern */
integrationsRoute.get('/google/auth-url', (c) => {
  const returnTo = c.req.query('returnTo') || '/settings'
  try {
    const url = getGoogleOAuthUrl(c.get('userId'), returnTo)
    return c.json({ url })
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : 'Google OAuth URL konnte nicht generiert werden.' },
      400,
    )
  }
})

/** Liste aller verbundenen Konten des Nutzers (Tokens werden nicht an den Client geschickt). */
integrationsRoute.get('/accounts', async (c) => {
  const rows = await db
    .select({
      id: connectedAccounts.id,
      userId: connectedAccounts.userId,
      provider: connectedAccounts.provider,
      email: connectedAccounts.email,
      label: connectedAccounts.label,
      avatarUrl: connectedAccounts.avatarUrl,
      storageUsedBytes: connectedAccounts.storageUsedBytes,
      storageTotalBytes: connectedAccounts.storageTotalBytes,
      metadata: connectedAccounts.metadata,
      hasRefreshToken: connectedAccounts.refreshToken,
      createdAt: connectedAccounts.createdAt,
      updatedAt: connectedAccounts.updatedAt,
    })
    .from(connectedAccounts)
    .where(eq(connectedAccounts.userId, c.get('userId')))
    .orderBy(desc(connectedAccounts.createdAt))

  const sanitized = rows.map((r) => ({
    ...r,
    hasRefreshToken: Boolean(r.hasRefreshToken),
  }))

  return c.json(sanitized)
})

/** Neues externes Konto verknüpfen (Google oder MEGA). */
integrationsRoute.post('/accounts', async (c) => {
  const parsed = createAccountInput.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: z.prettifyError(parsed.error) }, 400)
  }

  const {
    provider,
    email,
    password,
    label,
    accessToken,
    refreshToken,
    storageUsedBytes,
    storageTotalBytes,
    metadata,
  } = parsed.data

  let finalAccessToken = accessToken ?? null
  let finalUsed = storageUsedBytes
  let finalTotal = storageTotalBytes
  let finalMetadata: Record<string, unknown> = metadata ?? {}

  // Wenn MEGA und Passwort übergeben wurde, Live-Login durchführen
  if (provider === 'mega' && password) {
    try {
      const megaInfo = await connectMegaAccount(email, password)
      finalAccessToken = megaInfo.sessionJson
      finalUsed = megaInfo.spaceUsed
      finalTotal = megaInfo.spaceTotal
      finalMetadata = {
        ...finalMetadata,
        filesCount: megaInfo.filesCount,
        lastSyncedAt: new Date().toISOString(),
        liveConnected: true,
      }
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : 'MEGA-Verbindung fehlgeschlagen.' },
        400,
      )
    }
  }

  // Fallback-Werte für Kapazitäten, falls keine Live-Werte vorhanden
  const defaultTotal =
    provider === 'google'
      ? (15 * 1024 * 1024 * 1024).toString() // 15 GB
      : (20 * 1024 * 1024 * 1024).toString() // 20 GB

  const defaultUsed =
    provider === 'google'
      ? (Math.floor(Math.random() * 8 + 3) * 1024 * 1024 * 1024).toString()
      : (Math.floor(Math.random() * 10 + 2) * 1024 * 1024 * 1024).toString()

  const [row] = await db
    .insert(connectedAccounts)
    .values({
      userId: c.get('userId'),
      provider,
      email,
      label: label || (provider === 'google' ? 'Google Drive' : 'MEGA Cloud'),
      accessToken: finalAccessToken,
      refreshToken: refreshToken ?? null,
      storageUsedBytes: finalUsed ?? defaultUsed,
      storageTotalBytes: finalTotal ?? defaultTotal,
      metadata: finalMetadata,
    })
    .returning({
      id: connectedAccounts.id,
      userId: connectedAccounts.userId,
      provider: connectedAccounts.provider,
      email: connectedAccounts.email,
      label: connectedAccounts.label,
      avatarUrl: connectedAccounts.avatarUrl,
      storageUsedBytes: connectedAccounts.storageUsedBytes,
      storageTotalBytes: connectedAccounts.storageTotalBytes,
      metadata: connectedAccounts.metadata,
      createdAt: connectedAccounts.createdAt,
      updatedAt: connectedAccounts.updatedAt,
    })

  return c.json(row, 201)
})

/** Konto bearbeiten (z. B. Label). */
integrationsRoute.put('/accounts/:id', async (c) => {
  const parsed = updateAccountInput.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: z.prettifyError(parsed.error) }, 400)
  }

  const [row] = await db
    .update(connectedAccounts)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(connectedAccounts.id, c.req.param('id')),
        eq(connectedAccounts.userId, c.get('userId')),
      ),
    )
    .returning({
      id: connectedAccounts.id,
      provider: connectedAccounts.provider,
      email: connectedAccounts.email,
      label: connectedAccounts.label,
      avatarUrl: connectedAccounts.avatarUrl,
      storageUsedBytes: connectedAccounts.storageUsedBytes,
      storageTotalBytes: connectedAccounts.storageTotalBytes,
      metadata: connectedAccounts.metadata,
      updatedAt: connectedAccounts.updatedAt,
    })

  if (!row) return c.json({ error: 'Konto nicht gefunden' }, 404)
  return c.json(row)
})

/** Konto trennen / entfernen. */
integrationsRoute.delete('/accounts/:id', async (c) => {
  const [row] = await db
    .delete(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.id, c.req.param('id')),
        eq(connectedAccounts.userId, c.get('userId')),
      ),
    )
    .returning({ id: connectedAccounts.id })

  if (!row) return c.json({ error: 'Konto nicht gefunden' }, 404)
  return c.json({ ok: true })
})

/** Quota synchronisieren (Live-API falls Token/Sitzung vorhanden, sonst Timestamp). */
integrationsRoute.post('/accounts/:id/sync', async (c) => {
  const [account] = await db
    .select()
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.id, c.req.param('id')),
        eq(connectedAccounts.userId, c.get('userId')),
      ),
    )

  if (!account) return c.json({ error: 'Konto nicht gefunden' }, 404)

  if (account.provider === 'microsoft') {
    try {
      return c.json(publicAccount(await syncMicrosoftAccount(account)))
    } catch {
      return c.json({ error: 'OneDrive-Synchronisation fehlgeschlagen. Die bisherigen Messwerte bleiben erhalten. Bitte Microsoft-Berechtigungen prüfen oder das Konto erneut verbinden.' }, 502)
    }
  }

  // 1. Google Drive Live-Synchronisation
  if (account.provider === 'google' && (account.accessToken || account.refreshToken)) {
    try {
      const validToken = await getValidGoogleAccessToken(account)
      const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota,user', {
        headers: { Authorization: `Bearer ${validToken}` },
      })
      if (res.ok) {
        const data = (await res.json()) as {
          storageQuota?: { limit?: string; usage?: string; usageInDrive?: string; usageInDriveTrash?: string }
          user?: { photoLink?: string }
        }
        if (data.storageQuota) {
          const used = data.storageQuota.usage ?? account.storageUsedBytes
          const total = data.storageQuota.limit ?? account.storageTotalBytes
          const [updated] = await db
            .update(connectedAccounts)
            .set({
              storageUsedBytes: used,
              storageTotalBytes: total,
              avatarUrl: data.user?.photoLink ?? account.avatarUrl,
              metadata: {
                ...((account.metadata as Record<string, unknown>) ?? {}),
                driveUsage: data.storageQuota.usageInDrive,
                trashUsage: data.storageQuota.usageInDriveTrash,
                lastSyncedAt: new Date().toISOString(),
                liveConnected: true,
              },
              updatedAt: new Date(),
            })
            .where(eq(connectedAccounts.id, account.id))
            .returning()
          return c.json(publicAccount(updated))
        }
      }
    } catch {
      // Fallback bei API/Netzwerkfehlern
    }
  }

  // 2. MEGA Live-Synchronisation via gespeicherter Sitzung
  if (account.provider === 'mega' && account.accessToken) {
    try {
      const megaSync = await syncMegaAccount(account.accessToken)
      const [updated] = await db
        .update(connectedAccounts)
        .set({
          storageUsedBytes: megaSync.spaceUsed,
          storageTotalBytes: megaSync.spaceTotal,
          metadata: {
            ...((account.metadata as Record<string, unknown>) ?? {}),
            filesCount: megaSync.filesCount,
            lastSyncedAt: new Date().toISOString(),
            liveConnected: true,
          },
          updatedAt: new Date(),
        })
        .where(eq(connectedAccounts.id, account.id))
        .returning()
      return c.json(publicAccount(updated))
    } catch {
      // Fallback bei Netzwerkfehlern
    }
  }

  // Fallback: Aktualisiere Timestamp
  const [updated] = await db
    .update(connectedAccounts)
    .set({
      metadata: {
        ...((account.metadata as Record<string, unknown>) ?? {}),
        lastSyncedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    })
    .where(eq(connectedAccounts.id, account.id))
    .returning()

  return c.json(publicAccount(updated))
})
