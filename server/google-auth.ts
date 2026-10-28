import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../src/db/client'
import { connectedAccounts, type ConnectedAccount } from '../src/db/schema/index'

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
]

export const GOOGLE_COOKIE = 'omnidesk-google-oauth'
export const GOOGLE_COOKIE_PATH = '/api/integrations/google'
export const GOOGLE_OAUTH_MAX_AGE = 600

const DEFAULT_REDIRECT_URI = 'http://localhost:8787/api/integrations/google/callback'

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const secret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !secret) {
    throw new Error(
      'Google ist noch nicht eingerichtet. GOOGLE_CLIENT_ID und GOOGLE_CLIENT_SECRET fehlen oder sind unvollständig.',
    )
  }
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || DEFAULT_REDIRECT_URI
  let redirect: URL
  try {
    redirect = new URL(redirectUri)
  } catch {
    throw new Error('GOOGLE_REDIRECT_URI ist keine gültige Adresse.')
  }
  if (
    redirect.username ||
    redirect.password ||
    redirect.search ||
    redirect.hash ||
    redirect.pathname !== `${GOOGLE_COOKIE_PATH}/callback` ||
    (redirect.protocol !== 'https:' &&
      !(redirect.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(redirect.hostname)))
  ) {
    throw new Error(
      'GOOGLE_REDIRECT_URI muss auf den Google-Callback dieser App zeigen (HTTPS; lokal HTTP erlaubt).',
    )
  }
  return {
    clientId,
    secret,
    redirectUri,
    origin: redirect.origin,
    secure: redirect.protocol === 'https:',
  }
}

/**
 * Die laufende Anmeldung wird verschlüsselt im Browser hinterlegt, nicht im
 * State. Vorher stand die Benutzerkennung unsigniert im State; wer eine
 * gültige Google-Autorisierung besaß, konnte sie damit an ein fremdes
 * OMNIDESK-Konto hängen. Derselbe Weg wie bei Microsoft.
 */
export function sealGoogleValue(value: string, purpose: 'transaction') {
  const key = createHash('sha256')
    .update(`omnidesk-google-${purpose}\0`)
    .update(googleConfig().secret)
    .digest()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `gg1.${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')}`
}

export function openGoogleValue(value: string, purpose: 'transaction') {
  if (!value.startsWith('gg1.')) {
    throw new Error('Google-Anmeldung ungültig. Bitte erneut starten.')
  }
  const buffer = Buffer.from(value.slice(4), 'base64url')
  if (buffer.length < 29) {
    throw new Error('Google-Anmeldung ungültig. Bitte erneut starten.')
  }
  const key = createHash('sha256')
    .update(`omnidesk-google-${purpose}\0`)
    .update(googleConfig().secret)
    .digest()
  const decipher = createDecipheriv('aes-256-gcm', key, buffer.subarray(0, 12))
  decipher.setAuthTag(buffer.subarray(12, 28))
  return Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]).toString('utf8')
}

const transactionSchema = z.object({
  userId: z.string().min(1),
  state: z.string().min(32),
  verifier: z.string().min(43),
  returnTo: z.enum(['/settings', '/cloud-monitor']),
  createdAt: z.number(),
})

export type GoogleTransaction = z.infer<typeof transactionSchema>

export function startGoogleAuthorization(userId: string, returnTo?: string) {
  const config = googleConfig()
  const state = randomBytes(32).toString('base64url')
  const verifier = randomBytes(48).toString('base64url')
  const transaction = transactionSchema.parse({
    userId,
    state,
    verifier,
    returnTo: returnTo === '/cloud-monitor' ? returnTo : '/settings',
    createdAt: Date.now(),
  })
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
  })
  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    cookie: sealGoogleValue(JSON.stringify(transaction), 'transaction'),
  }
}

export function readGoogleTransaction(cookie: string | undefined, state: string | undefined) {
  if (!cookie || !state) {
    throw new Error('Google-Anmeldung fehlt oder ist abgelaufen. Bitte erneut starten.')
  }
  const transaction = transactionSchema.parse(JSON.parse(openGoogleValue(cookie, 'transaction')))
  const expected = Buffer.from(transaction.state)
  const supplied = Buffer.from(state)
  const age = Date.now() - transaction.createdAt
  if (
    age < 0 ||
    age > GOOGLE_OAUTH_MAX_AGE * 1000 ||
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    throw new Error('Google-Anmeldung ungültig oder abgelaufen. Bitte erneut starten.')
  }
  return transaction
}

export interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

export async function exchangeGoogleCode(
  code: string,
  verifier: string,
): Promise<GoogleTokenResponse> {
  const config = googleConfig()

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.secret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    // Antwortinhalte von Google werden bewusst nicht übernommen: Die Meldung
    // landet in der Rückleitungsadresse im Browser.
    throw new Error(
      `Code-Austausch mit Google fehlgeschlagen (HTTP ${res.status}). Bitte Anmeldung erneut starten.`,
    )
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
