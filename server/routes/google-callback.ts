import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../../src/db/client'
import { connectedAccounts } from '../../src/db/schema/index'
import { exchangeGoogleCode } from '../google-auth'

export const googleCallbackRoute = new Hono()

googleCallbackRoute.get('/callback', async (c) => {
  const code = c.req.query('code')
  const stateRaw = c.req.query('state')
  const errorParam = c.req.query('error')

  // Ursprung der tatsächlichen Anfrage als Grundlage: Ohne gesetzte Variable
  // führte die Rückleitung nach der Google-Anmeldung sonst auf localhost,
  // auch wenn die Anmeldung auf der produktiven Adresse lief.
  const frontendUrl =
    process.env.APP_URL ||
    process.env.FRONTEND_URL ||
    (() => {
      try {
        return new URL(c.req.url).origin
      } catch {
        return 'http://localhost:5173'
      }
    })()

  if (errorParam) {
    return c.redirect(
      `${frontendUrl}/settings?error=${encodeURIComponent(`Google-Anmeldung abgebrochen: ${errorParam}`)}`,
    )
  }

  if (!code || !stateRaw) {
    return c.redirect(
      `${frontendUrl}/settings?error=${encodeURIComponent('Ungültige Antwort von Google erhalten.')}`,
    )
  }

  try {
    let stateData: { userId: string; returnTo?: string }
    try {
      stateData = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf-8'))
    } catch {
      return c.redirect(
        `${frontendUrl}/settings?error=${encodeURIComponent('Ungültiger State-Parameter.')}`,
      )
    }

    const { userId, returnTo = '/settings' } = stateData
    if (!userId) {
      return c.redirect(
        `${frontendUrl}/settings?error=${encodeURIComponent('Benutzer-ID im State fehlt.')}`,
      )
    }

    // 1. Tokens bei Google anfordern
    const tokens = await exchangeGoogleCode(code)

    // 2. Benutzer-Profil von Google abrufen (E-Mail, Name, Avatar)
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!profileRes.ok) {
      throw new Error('Google-Nutzerprofil konnte nicht abgerufen werden.')
    }

    const profile = (await profileRes.json()) as {
      email: string
      name?: string
      picture?: string
    }

    // 3. Echte Speicherkapazität von Google Drive abfragen
    let storageUsed = '0'
    let storageTotal = (15 * 1024 * 1024 * 1024).toString() // 15 GB Fallback
    let driveMeta: Record<string, unknown> = {}

    try {
      const driveRes = await fetch(
        'https://www.googleapis.com/drive/v3/about?fields=storageQuota,user',
        { headers: { Authorization: `Bearer ${tokens.access_token}` } },
      )
      if (driveRes.ok) {
        const driveData = (await driveRes.json()) as {
          storageQuota?: {
            limit?: string
            usage?: string
            usageInDrive?: string
            usageInDriveTrash?: string
          }
        }
        if (driveData.storageQuota) {
          storageUsed = driveData.storageQuota.usage ?? storageUsed
          storageTotal = driveData.storageQuota.limit ?? storageTotal
          driveMeta = {
            driveUsage: driveData.storageQuota.usageInDrive,
            trashUsage: driveData.storageQuota.usageInDriveTrash,
            lastSyncedAt: new Date().toISOString(),
          }
        }
      }
    } catch {
      // Speicherplatz-Abfrage ist optional, Account wird trotzdem gespeichert
    }

    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000)

    // 4. Prüfen, ob das Konto bereits für diesen Nutzer existiert
    const [existing] = await db
      .select()
      .from(connectedAccounts)
      .where(
        and(
          eq(connectedAccounts.userId, userId),
          eq(connectedAccounts.email, profile.email),
          eq(connectedAccounts.provider, 'google'),
        ),
      )

    if (existing) {
      // Bestehendes Konto aktualisieren
      await db
        .update(connectedAccounts)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? existing.refreshToken,
          tokenExpiry,
          avatarUrl: profile.picture ?? existing.avatarUrl,
          label: existing.label || profile.name || 'Google-Konto',
          storageUsedBytes: storageUsed,
          storageTotalBytes: storageTotal,
          metadata: {
            ...((existing.metadata as Record<string, unknown>) ?? {}),
            ...driveMeta,
          },
          updatedAt: new Date(),
        })
        .where(eq(connectedAccounts.id, existing.id))
    } else {
      // Neues Konto einfügen
      await db.insert(connectedAccounts).values({
        userId,
        provider: 'google',
        email: profile.email,
        label: profile.name || 'Google-Konto',
        avatarUrl: profile.picture ?? null,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        tokenExpiry,
        scopes: tokens.scope,
        storageUsedBytes: storageUsed,
        storageTotalBytes: storageTotal,
        metadata: driveMeta,
      })
    }

    const destination = returnTo.startsWith('/') ? returnTo : '/settings'
    return c.redirect(`${frontendUrl}${destination}?connected=google&email=${encodeURIComponent(profile.email)}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unerwarteter Fehler bei der Google-Verbindung.'
    return c.redirect(`${frontendUrl}/settings?error=${encodeURIComponent(msg)}`)
  }
})
