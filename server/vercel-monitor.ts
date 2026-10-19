import { z } from 'zod'
import type { DeploymentLogs, DeploymentSnapshot, DeploymentSummary } from '../src/types/deployments'

const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,150}$/)
const linkSchema = z.object({ userId: z.string().min(1), projectId: z.uuid(),
  vercelProjectId: identifier, teamId: identifier.optional() })
export type VercelLink = z.infer<typeof linkSchema>

export class VercelMonitorError extends Error {
  readonly code: string
  readonly status: 400 | 403 | 404 | 502 | 503
  constructor(code: string, message: string, status: 400 | 403 | 404 | 502 | 503 = 502) {
    super(message)
    this.name = 'VercelMonitorError'
    this.code = code
    this.status = status
  }
}

export function readVercelLinks(): VercelLink[] {
  const value = process.env.DEPLOYMENT_PROJECT_LINKS
  if (!value?.trim()) return []
  let parsed: unknown
  try { parsed = JSON.parse(value) } catch {
    throw new VercelMonitorError('VERCEL_CONFIG_INVALID', 'DEPLOYMENT_PROJECT_LINKS enthält ungültiges JSON. Vollständige Liste von [ bis ] ohne Markdown-Codezeichen eintragen und neu deployen.', 503)
  }
  const result = z.array(linkSchema).max(100).safeParse(parsed)
  if (!result.success) throw new VercelMonitorError('VERCEL_CONFIG_INVALID', `DEPLOYMENT_PROJECT_LINKS ist ungültig. Feld ${result.error.issues[0]?.path.join('.') || 'Liste'} prüfen.`, 503)
  const identities = result.data.map((link) => `${link.userId}:${link.projectId}`)
  if (new Set(identities).size !== identities.length) throw new VercelMonitorError('VERCEL_CONFIG_INVALID', 'Pro Benutzer und OMNIDESK-Projekt ist nur eine Vercel-Zuordnung erlaubt.', 503)
  return result.data
}

async function boundedJson(response: Response, maxBytes = 2_000_000): Promise<unknown> {
  if (!response.body) throw new Error('Empty response')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new VercelMonitorError('VERCEL_RESPONSE_TOO_LARGE', 'Die Vercel-Antwort ist zu groß. Bitte die Logs direkt in Vercel prüfen.')
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

async function vercelGet(path: string, link: VercelLink, query: Record<string, string> = {}) {
  const token = process.env.DEPLOYMENT_API_TOKEN?.trim()
  if (!token) throw new VercelMonitorError('VERCEL_NOT_CONFIGURED', 'Vercel ist noch nicht eingerichtet: DEPLOYMENT_API_TOKEN fehlt.', 503)
  const url = new URL(path, 'https://api.vercel.com')
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
  if (link.teamId) url.searchParams.set('teamId', link.teamId)
  let response: Response
  try {
    response = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      redirect: 'error', signal: AbortSignal.timeout(15_000) })
  } catch {
    throw new VercelMonitorError('VERCEL_UNREACHABLE', 'Vercel ist derzeit nicht erreichbar. Bitte später erneut versuchen.')
  }
  if (!response.ok) throw new VercelMonitorError('VERCEL_API_ERROR', `Vercel-Abfrage fehlgeschlagen (HTTP ${response.status}). Token, Team-Zuordnung, Zugriffsrechte oder API-Limit prüfen.`)
  return boundedJson(response)
}

const deploymentSchema = z.object({ id: z.string().optional(), uid: z.string().optional(),
  projectId: z.string().optional(), url: z.string().optional().nullable(),
  state: z.string().optional(), readyState: z.string().optional(), target: z.string().optional().nullable(),
  createdAt: z.number().optional(), created: z.number().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
}).refine((value) => Boolean(value.id || value.uid), 'Missing deployment identifier')
const projectSchema = z.object({ id: z.string(), name: z.string(),
  targets: z.object({ production: deploymentSchema.nullable().optional() }).optional(),
})

function safeDeploymentUrl(value: string | null | undefined) {
  if (!value) return null
  try {
    const url = new URL(value.startsWith('https://') ? value : `https://${value}`)
    return url.protocol === 'https:' && !url.username && !url.password && url.hostname.endsWith('.vercel.app') ? url.origin : null
  } catch { return null }
}

function publicDeployment(value: z.infer<typeof deploymentSchema>): DeploymentSummary {
  const meta = value.meta ?? {}
  const text = (key: string) => typeof meta[key] === 'string' ? String(meta[key]).slice(0, 1000) : null
  return { id: value.id || value.uid!, url: safeDeploymentUrl(value.url), state: value.readyState || value.state || 'UNKNOWN',
    target: value.target === 'production' ? 'production' : value.target == null ? 'preview' : 'other',
    createdAt: value.createdAt ?? value.created ?? null,
    commit: { sha: text('githubCommitSha') || text('gitlabCommitSha') || text('bitbucketCommitSha'),
      message: text('githubCommitMessage') || text('gitlabCommitMessage') || text('bitbucketCommitMessage'),
      branch: text('githubCommitRef') || text('gitlabCommitRef') || text('bitbucketCommitRef') } }
}

export async function fetchVercelSnapshot(link: VercelLink): Promise<DeploymentSnapshot> {
  const [projectResult, deploymentsResult] = await Promise.allSettled([
    vercelGet(`/v9/projects/${encodeURIComponent(link.vercelProjectId)}`, link).then((value) => projectSchema.parse(value)),
    vercelGet('/v7/deployments', link, { projectId: link.vercelProjectId, limit: '20' })
      .then((value) => z.object({ deployments: z.array(deploymentSchema) }).parse(value).deployments),
  ])
  if (projectResult.status === 'fulfilled' && projectResult.value.id !== link.vercelProjectId) {
    throw new VercelMonitorError('VERCEL_PROJECT_MISMATCH', 'Die Vercel-Antwort passt nicht zur hinterlegten Projekt-ID.')
  }
  if (projectResult.status === 'rejected' && deploymentsResult.status === 'rejected') {
    if (projectResult.reason instanceof VercelMonitorError) throw projectResult.reason
    throw new VercelMonitorError('VERCEL_RESPONSE_INVALID', 'Die Vercel-Antwort konnte nicht ausgewertet werden.')
  }
  const project = projectResult.status === 'fulfilled' ? projectResult.value : null
  const production = project?.targets?.production
  if (production?.projectId && production.projectId !== link.vercelProjectId) throw new VercelMonitorError('VERCEL_PROJECT_MISMATCH', 'Produktionszuordnung stimmt nicht mit dem Projekt überein.')
  const deployments = deploymentsResult.status === 'fulfilled' ? deploymentsResult.value : null
  if (deployments?.some((deployment) => deployment.projectId && deployment.projectId !== link.vercelProjectId)) throw new VercelMonitorError('VERCEL_PROJECT_MISMATCH', 'Die Deployment-Liste enthält eine fremde Projektzuordnung.')
  return { checkedAt: new Date().toISOString(), project: project ? { id: project.id, name: project.name } : null,
    production: production ? { ...publicDeployment(production), target: 'production' } : null,
    deployments: deployments?.slice(0, 20).map(publicDeployment) ?? null, historyLimit: 20,
    unavailable: [projectResult.status === 'rejected' ? 'Projekt und Produktionszuordnung' : null,
      deploymentsResult.status === 'rejected' ? 'Deployment-Verlauf' : null].filter((item): item is string => Boolean(item)) }
}

/** Best effort only: arbitrary secrets printed by a build cannot be identified reliably. */
export function redactBuildLog(text: string) {
  const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, 'g')
  let result = text.replace(ansi, '').replace(/\p{Cc}/gu, (character) => ['\n', '\r', '\t'].includes(character) ? character : '')
  for (const [name, value] of Object.entries(process.env)) {
    if (value && value.length >= 6 && /TOKEN|SECRET|PASSWORD|API_KEY|DATABASE_URL/i.test(name)) result = result.split(value).join('[ENTFERNT]')
  }
  result = result.replace(/(\b(?:password|token|secret|api[_-]?key|authorization|database_url)\b\s*[=:]\s*)(?:Bearer\s+)?[^\s,;]+/gi, '$1[ENTFERNT]')
    .replace(/(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[ENTFERNT]@')
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, '[PRIVATER SCHLÜSSEL ENTFERNT]')
  return result.slice(0, 8000)
}

export async function fetchVercelLogs(link: VercelLink, deploymentId: string): Promise<DeploymentLogs> {
  if (!identifier.safeParse(deploymentId).success) throw new VercelMonitorError('VERCEL_DEPLOYMENT_INVALID', 'Ungültige Deployment-ID.', 400)
  // Project ownership must be verified against deployment details before requesting its logs.
  const detail = z.object({ id: z.string(), projectId: z.string() }).parse(await vercelGet(`/v13/deployments/${encodeURIComponent(deploymentId)}`, link))
  if (detail.id !== deploymentId || detail.projectId !== link.vercelProjectId) throw new VercelMonitorError('VERCEL_DEPLOYMENT_FORBIDDEN', 'Dieses Deployment gehört nicht zum zugeordneten Projekt.', 404)
  const raw = await vercelGet(`/v3/deployments/${encodeURIComponent(deploymentId)}/events`, link,
    { follow: '0', builds: '1', direction: 'backward', limit: '100' })
  const parsedEvents = z.array(z.object({ text: z.string().nullable().optional(), type: z.string().optional(),
    created: z.number().optional(), date: z.number().optional(), deploymentId: z.string().optional() }).nullable()).parse(raw)
  const events = parsedEvents.filter((event) => event !== null)
  if (events.some((event) => event.deploymentId && event.deploymentId !== deploymentId)) throw new VercelMonitorError('VERCEL_DEPLOYMENT_FORBIDDEN', 'Log-Zuordnung stimmt nicht mit dem Deployment überein.', 404)
  return { deploymentId, checkedAt: new Date().toISOString(), limit: 100, truncated: events.length >= 100 || events.some((event) => (event.text?.length ?? 0) > 8000),
    entries: events.slice(0, 100).filter((event) => event.text).map((event) => ({ text: redactBuildLog(event.text!), type: event.type ?? 'log', timestamp: event.created ?? event.date ?? null })).reverse() }
}
