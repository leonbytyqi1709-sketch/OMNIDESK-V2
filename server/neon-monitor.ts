import { z } from 'zod'

const neonId = z.string().regex(/^[a-z0-9-]{1,60}$/)
export const neonLinkSchema = z.object({ userId: z.string().min(1), projectId: z.uuid(),
  neonProjectId: neonId, branchId: neonId })
export type NeonLink = z.infer<typeof neonLinkSchema>

export class NeonConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NeonConfigurationError'
  }
}

/** Explicit server-owned assignments: no caller can choose another user's Neon project. */
export function readNeonLinks(): NeonLink[] {
  const value = process.env.NEON_MONITOR_LINKS
  if (!value?.trim()) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new NeonConfigurationError('NEON_MONITOR_LINKS enthält ungültiges JSON. In Vercel die vollständige Liste von [ bis ] ohne Markdown-Codezeichen und ohne zusätzliche äußere Anführungszeichen eintragen und neu deployen.')
  }
  const result = z.array(neonLinkSchema).max(100).safeParse(parsed)
  if (!result.success) {
    const path = result.error.issues[0]?.path
    const field = path?.length ? path.join('.') : 'Liste'
    throw new NeonConfigurationError(`Neon-Zuordnung ist ungültig: Feld ${field} in NEON_MONITOR_LINKS prüfen. projectId muss eine OMNIDESK-Projekt-UUID sein; Neon-IDs dürfen nur Kleinbuchstaben, Ziffern und Bindestriche enthalten.`)
  }
  const identities = result.data.map((link) => `${link.userId}:${link.projectId}`)
  if (new Set(identities).size !== identities.length) {
    throw new NeonConfigurationError('Neon-Zuordnung ist ungültig: Mehrere Einträge für denselben Benutzer und dasselbe OMNIDESK-Projekt in NEON_MONITOR_LINKS.')
  }
  return result.data
}

const metric = z.number().finite().nonnegative().optional().nullable()
const projectSchema = z.object({ project: z.object({ id: z.string(), name: z.string(),
  region_id: z.string().optional(), pg_version: z.number().optional(), synthetic_storage_size: metric,
  compute_time_seconds: metric, active_time_seconds: metric, data_transfer_bytes: metric,
  consumption_period_start: z.string().optional(), consumption_period_end: z.string().optional(),
}) })
const branchSchema = z.object({ branch: z.object({ id: z.string(), project_id: z.string(), name: z.string(),
  current_state: z.string(), logical_size: metric,
}) })
const endpointSchema = z.object({ endpoints: z.array(z.object({ id: z.string(), branch_id: z.string(),
  project_id: z.string(), current_state: z.string(), pending_state: z.string().optional(),
  type: z.string(), disabled: z.boolean(), last_active: z.string().optional(),
  autoscaling_limit_min_cu: metric, autoscaling_limit_max_cu: metric,
})) })

async function neonGet(path: string) {
  const key = process.env.NEON_API_KEY?.trim()
  if (!key) throw new Error('Neon ist noch nicht eingerichtet: NEON_API_KEY fehlt.')
  const response = await fetch(`https://console.neon.tech/api/v2${path}`, {
    method: 'GET', headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    redirect: 'error', signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) throw new Error(`Neon-Abfrage fehlgeschlagen (HTTP ${response.status}). Berechtigungen, Projektzuordnung oder API-Limit prüfen.`)
  return response.json() as Promise<unknown>
}

export async function fetchNeonSnapshot(link: NeonLink) {
  const root = `/projects/${encodeURIComponent(link.neonProjectId)}`
  const results = await Promise.allSettled([
    neonGet(root).then((body) => projectSchema.parse(body).project),
    neonGet(`${root}/branches/${encodeURIComponent(link.branchId)}`).then((body) => branchSchema.parse(body).branch),
    neonGet(`${root}/endpoints`).then((body) => endpointSchema.parse(body).endpoints),
  ])
  const [projectResult, branchResult, endpointsResult] = results
  // A different remote resource must never be attributed to the configured project.
  if (projectResult.status === 'fulfilled' && projectResult.value.id !== link.neonProjectId) throw new Error('Neon-Projektzuordnung stimmt nicht mit der Antwort überein.')
  if (branchResult.status === 'fulfilled' && (branchResult.value.id !== link.branchId || branchResult.value.project_id !== link.neonProjectId)) throw new Error('Neon-Branchzuordnung stimmt nicht mit der Antwort überein.')
  if (results.every((result) => result.status === 'rejected')) throw new Error('Neon ist derzeit nicht abrufbar. API-Schlüssel, Freigaben und Zuordnung prüfen.')
  const project = projectResult.status === 'fulfilled' ? projectResult.value : null
  const branch = branchResult.status === 'fulfilled' ? branchResult.value : null
  const endpoints = endpointsResult.status === 'fulfilled'
    ? endpointsResult.value.filter((endpoint) => endpoint.branch_id === link.branchId && endpoint.project_id === link.neonProjectId)
    : null
  return {
    checkedAt: new Date().toISOString(),
    project: project ? { id: project.id, name: project.name, region: project.region_id ?? null,
      postgresVersion: project.pg_version ?? null } : null,
    branch: branch ? { id: branch.id, name: branch.name, state: branch.current_state,
      logicalSizeBytes: branch.logical_size ?? null } : null,
    endpoints: endpoints?.map((endpoint) => ({ id: endpoint.id, state: endpoint.current_state,
      pendingState: endpoint.pending_state ?? null, type: endpoint.type, disabled: endpoint.disabled,
      lastActive: endpoint.last_active ?? null, minCu: endpoint.autoscaling_limit_min_cu ?? null,
      maxCu: endpoint.autoscaling_limit_max_cu ?? null })) ?? null,
    consumption: project ? { projectStorageBytes: project.synthetic_storage_size ?? null,
      computeCuSeconds: project.compute_time_seconds ?? null, activeSeconds: project.active_time_seconds ?? null,
      transferBytes: project.data_transfer_bytes ?? null, periodStart: project.consumption_period_start ?? null,
      periodEnd: project.consumption_period_end ?? null } : null,
    unavailable: results.flatMap((result, index) => result.status === 'rejected' ? [['Projektwerte', 'Branchwerte', 'Compute-Status'][index]] : []),
  }
}
