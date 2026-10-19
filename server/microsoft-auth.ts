import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

export const MICROSOFT_COOKIE = 'omnidesk-ms-oauth'
export const MICROSOFT_COOKIE_PATH = '/api/integrations/microsoft'
export const MICROSOFT_SCOPES = ['offline_access', 'User.Read', 'Files.Read']
export const OAUTH_MAX_AGE = 600

export function microsoftConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim()
  const secret = process.env.MICROSOFT_CLIENT_SECRET
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI?.trim()
  if (!clientId || !secret || !redirectUri) {
    throw new Error('OneDrive ist noch nicht eingerichtet. MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET und MICROSOFT_REDIRECT_URI fehlen oder sind unvollständig.')
  }
  const redirect = new URL(redirectUri)
  if (redirect.username || redirect.password || redirect.search || redirect.hash ||
    redirect.pathname !== `${MICROSOFT_COOKIE_PATH}/callback` ||
    (redirect.protocol !== 'https:' && !(redirect.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(redirect.hostname)))) {
    throw new Error('MICROSOFT_REDIRECT_URI muss auf den OneDrive-Callback dieser App zeigen (HTTPS; lokal HTTP erlaubt).')
  }
  const tenant = process.env.MICROSOFT_TENANT || 'common'
  if (!['consumers', 'organizations', 'common'].includes(tenant)) throw new Error('MICROSOFT_TENANT muss consumers, organizations oder common sein.')
  return { clientId, secret, redirectUri, origin: redirect.origin, secure: redirect.protocol === 'https:', tenant }
}

// Purpose separation prevents exchanging an OAuth transaction for a stored token.
export function sealMicrosoftValue(value: string, purpose: 'transaction' | 'token') {
  const key = createHash('sha256').update(`omnidesk-microsoft-${purpose}\0`).update(microsoftConfig().secret).digest()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `ms1.${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')}`
}

export function openMicrosoftValue(value: string, purpose: 'transaction' | 'token') {
  if (!value.startsWith('ms1.')) throw new Error('OneDrive-Verbindung ungültig. Bitte erneut verbinden.')
  const buffer = Buffer.from(value.slice(4), 'base64url')
  if (buffer.length < 29) throw new Error('OneDrive-Verbindung ungültig. Bitte erneut verbinden.')
  const key = createHash('sha256').update(`omnidesk-microsoft-${purpose}\0`).update(microsoftConfig().secret).digest()
  const decipher = createDecipheriv('aes-256-gcm', key, buffer.subarray(0, 12))
  decipher.setAuthTag(buffer.subarray(12, 28))
  return Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]).toString('utf8')
}

const transactionSchema = z.object({
  userId: z.string().min(1), state: z.string().min(32), verifier: z.string().min(43),
  returnTo: z.enum(['/settings', '/cloud-monitor']), createdAt: z.number(),
})

export function startMicrosoftAuthorization(userId: string, returnTo?: string) {
  const config = microsoftConfig()
  const state = randomBytes(32).toString('base64url')
  const verifier = randomBytes(48).toString('base64url')
  const transaction = transactionSchema.parse({ userId, state, verifier,
    returnTo: returnTo === '/cloud-monitor' ? returnTo : '/settings', createdAt: Date.now() })
  const url = new URL(`https://login.microsoftonline.com/${config.tenant}/oauth2/v2.0/authorize`)
  url.search = new URLSearchParams({ client_id: config.clientId, response_type: 'code',
    redirect_uri: config.redirectUri, response_mode: 'query', scope: MICROSOFT_SCOPES.join(' '),
    state, code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256', prompt: 'select_account' }).toString()
  return { url: url.toString(), cookie: sealMicrosoftValue(JSON.stringify(transaction), 'transaction') }
}

export function readMicrosoftTransaction(cookie: string | undefined, state: string | undefined) {
  if (!cookie || !state) throw new Error('OneDrive-Anmeldung fehlt oder ist abgelaufen. Bitte erneut starten.')
  const transaction = transactionSchema.parse(JSON.parse(openMicrosoftValue(cookie, 'transaction')))
  const expected = Buffer.from(transaction.state)
  const supplied = Buffer.from(state)
  const age = Date.now() - transaction.createdAt
  if (age < 0 || age > OAUTH_MAX_AGE * 1000 || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new Error('OneDrive-Anmeldung ungültig oder abgelaufen. Bitte erneut starten.')
  }
  return transaction
}

const tokenSchema = z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1).optional(),
  expires_in: z.number().positive(), scope: z.string().optional() })

async function requestTokens(parameters: Record<string, string>) {
  const config = microsoftConfig()
  const response = await fetch(`https://login.microsoftonline.com/${config.tenant}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.secret,
      redirect_uri: config.redirectUri, ...parameters }), signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Microsoft-Anmeldung fehlgeschlagen (HTTP ${response.status}). Bitte Konto erneut verbinden und die App-Konfiguration prüfen.`)
  return tokenSchema.parse(await response.json())
}

export const exchangeMicrosoftCode = (code: string, verifier: string) =>
  requestTokens({ grant_type: 'authorization_code', code, code_verifier: verifier })
export const refreshMicrosoftTokens = (refreshToken: string) =>
  requestTokens({ grant_type: 'refresh_token', refresh_token: refreshToken, scope: MICROSOFT_SCOPES.join(' ') })

const bytes = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const driveSchema = z.object({ id: z.string().min(1), driveType: z.string(), quota: z.object({
  used: bytes, total: bytes.positive(), deleted: bytes.optional(), remaining: bytes.optional(), state: z.string().optional(),
}) })
const profileSchema = z.object({ id: z.string().min(1), displayName: z.string().optional(),
  mail: z.string().nullable().optional(), userPrincipalName: z.string().optional() })

export async function getMicrosoftStorage(accessToken: string) {
  const response = await fetch('https://graph.microsoft.com/v1.0/me/drive?$select=id,driveType,quota', {
    headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`OneDrive-Speicher konnte nicht abgerufen werden (HTTP ${response.status}). Bitte Berechtigungen prüfen oder Konto erneut verbinden.`)
  const parsed = driveSchema.safeParse(await response.json())
  if (!parsed.success) throw new Error('Microsoft liefert derzeit keine vollständige unterstützte Speicherquote. Es werden keine Ersatzwerte gespeichert.')
  const { id, driveType, quota } = parsed.data
  return { storageUsedBytes: String(quota.used), storageTotalBytes: String(quota.total), metadata: {
    driveId: id, driveType, quotaState: quota.state, trashUsage: String(quota.deleted ?? 0),
    quotaScope: driveType === 'personal' ? 'microsoft-unified' : 'drive',
    lastSyncedAt: new Date().toISOString(), liveConnected: true,
  } }
}

export async function getMicrosoftProfile(accessToken: string) {
  const response = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error('Microsoft-Kontoprofil konnte nicht abgerufen werden.')
  const profile = profileSchema.parse(await response.json())
  const email = profile.mail || profile.userPrincipalName
  if (!email) throw new Error('Microsoft hat keine Konto-Adresse zurückgegeben.')
  return { ...profile, email }
}
