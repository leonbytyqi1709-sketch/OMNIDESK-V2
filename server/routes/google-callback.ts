import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { deleteCookie, getCookie } from 'hono/cookie'
import { db } from '../../src/db/client'
import { connectedAccounts } from '../../src/db/schema/index'
import {
  GOOGLE_COOKIE,
  GOOGLE_COOKIE_PATH,
  exchangeGoogleCode,
  googleConfig,
  readGoogleTransaction,
} from '../google-auth'

export const googleCallbackRoute = new Hono()

googleCallbackRoute.get('/callback', async (c) => {
  c.header('Cache-Control', 'no-store')
  c.header('Referrer-Policy', 'no-referrer')
  const code = c.req.query('code')
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

  try {
    // Die Anmeldung ist an ein verschlüsseltes HttpOnly-Cookie dieses Browsers
    // gebunden; über den State lässt sich kein fremdes OMNIDESK-Konto wählen.
    const transaction = readGoogleTransaction(getCookie(c, GOOGLE_COOKIE), c.req.query('state'))
    deleteCookie(c, GOOGLE_COOKIE, {
      path: GOOGLE_COOKIE_PATH,
      secure: googleConfig().secure,
      httpOnly: true,
      sameSite: 'Lax',
    })

    if (errorParam) {
      return c.redirect(
        `${frontendUrl}${transaction.returnTo}?error=${encodeURIComponent('Google-Anmeldung abgebrochen oder nicht erlaubt.')}`,
      )
    }
    if (!code) {
      return c.redirect(
        `${frontendUrl}${transaction.returnTo}?error=${encodeURIComponent('Google hat keinen Anmeldecode zurückgegeben.')}`,
      )
    }

    const { userId, returnTo } = transaction

    // 1. Tokens bei Google anfordern
    const tokens = await exchangeGoogleCode(code, transaction.verifier)

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

    return c.redirect(
      `${frontendUrl}${returnTo}?connected=google&email=${encodeURIComponent(profile.email)}`,
    )
  } catch {
    // Keine Anbieterinhalte, Codes oder Tokens in Rückleitungsadressen.
    return c.redirect(
      `${frontendUrl}/settings?error=${encodeURIComponent('Google konnte nicht verbunden werden. Bitte Anmeldung erneut starten und die Google-Konfiguration prüfen.')}`,
    )
  }
})
