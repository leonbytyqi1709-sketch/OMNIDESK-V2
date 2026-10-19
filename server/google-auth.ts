import { eq } from 'drizzle-orm'
import { db } from '../src/db/client'
import { connectedAccounts, type ConnectedAccount } from '../src/db/schema/index'

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
]

export function getGoogleOAuthUrl(userId: string, returnTo = '/settings'): string {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    'http://localhost:8787/api/integrations/google/callback'

  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID ist nicht in .env.local konfiguriert.')
  }

  const state = Buffer.from(JSON.stringify({ userId, returnTo })).toString('base64url')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

export async function exchangeGoogleCode(code: string): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    'http://localhost:8787/api/integrations/google/callback'

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth-Zugangsdaten fehlen in .env.local.')
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Code-Austausch mit Google fehlgeschlagen (${res.status}): ${errText}`)
  }

  return (await res.json()) as GoogleTokenResponse
}

export async function getValidGoogleAccessToken(account: ConnectedAccount): Promise<string> {
  const now = Date.now()
  const expiryTime = account.tokenExpiry ? new Date(account.tokenExpiry).getTime() : 0
  const isExpired = !account.accessToken || expiryTime - now < 5 * 60 * 1000 // 5 Min Puffer

  if (!isExpired && account.accessToken) {
    return account.accessToken
  }

  if (!account.refreshToken) {
    if (account.accessToken) return account.accessToken
    throw new Error(`Konto ${account.email} hat kein Refresh-Token. Bitte erneut autorisieren.`)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth-Zugangsdaten fehlen in .env.local.')
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    throw new Error(`Google Token-Erneuerung für ${account.email} fehlgeschlagen.`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  const newExpiry = new Date(Date.now() + data.expires_in * 1000)

  await db
    .update(connectedAccounts)
    .set({
      accessToken: data.access_token,
      tokenExpiry: newExpiry,
      updatedAt: new Date(),
    })
    .where(eq(connectedAccounts.id, account.id))

  return data.access_token
}
