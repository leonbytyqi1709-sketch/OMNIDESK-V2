import { monitoringSql } from './neon-storage'
import { readMissionUptime } from './mission-storage'
import { fetchGitHubSnapshot } from './github-monitor'
import { listGitHubLinks } from './github-links'
import { readVercelLinks, fetchVercelSnapshot } from './vercel-monitor'
import { readNeonLinks, fetchNeonSnapshot } from './neon-monitor'
import { readNeonMonitoring } from './neon-storage'
import type { GitHubSnapshot } from '../src/types/github'
import type { DeploymentSnapshot } from '../src/types/deployments'
import type {
  NeonSnapshot,
  NeonMonitoringState,
} from '../src/types/neon-monitoring'
import type {
  MissionProject,
  MissionSource,
  MissionSnapshot,
  MissionTask,
  MissionUptime,
} from '../src/types/mission-control'

export async function readMissionProject(userId: string, projectId: string) {
  const sql = monitoringSql()
  const rows =
    await sql`SELECT id,name,description,status,updated_at AS "updatedAt" FROM projects WHERE id=${projectId} AND user_id=${userId}`
  return (rows[0] as unknown as MissionProject | undefined) ?? null
}
export async function readMissionTasks(userId: string, projectId: string) {
  const sql = monitoringSql()
  return (await sql`SELECT t.id,t.title,t.status,t.priority,t.updated_at AS "updatedAt" FROM project_tasks t
    JOIN projects p ON p.id=t.project_id AND p.user_id=t.user_id
    WHERE t.user_id=${userId} AND t.project_id=${projectId} ORDER BY t.updated_at DESC,t.id`) as unknown as MissionTask[]
}
const missing = <T>(message: string): MissionSource<T> => ({
  state: 'missing',
  message,
  data: null,
})
async function source<T>(
  operation: () => Promise<MissionSource<T>>,
  message: string,
): Promise<MissionSource<T>> {
  try {
    return await operation()
  } catch {
    return { state: 'error', message, data: null }
  }
}
const ready = <T>(data: T): MissionSource<T> => ({
  state: 'ready',
  message: '',
  data,
})
export const missionDependencies = {
  readMissionProject,
  readMissionTasks,
  listGitHubLinks,
  fetchGitHubSnapshot,
  readVercelLinks,
  fetchVercelSnapshot,
  readNeonLinks,
  fetchNeonSnapshot,
  readNeonMonitoring,
  readMissionUptime,
}

/** Each provider uses only an owned project's explicit mapping. No account catalogue fallback. */
export function createMissionLoader(deps = missionDependencies) {
  return async (
    userId: string,
    projectId: string,
  ): Promise<MissionSnapshot | null> => {
    const project = await deps.readMissionProject(userId, projectId)
    if (!project) return null // Ownership must precede every provider request.
    const getNeonLink = () =>
      deps
        .readNeonLinks()
        .find((l) => l.userId === userId && l.projectId === projectId)
    const [tasks, github, deployment, neon, monitoring, uptime] =
      await Promise.all([
        source<MissionTask[]>(
          async () => ready(await deps.readMissionTasks(userId, projectId)),
          'Projektaufgaben konnten nicht geladen werden.',
        ),
        source<GitHubSnapshot>(async () => {
          if (
            !process.env.GITHUB_ACCOUNT_USER_ID?.trim() ||
            process.env.GITHUB_ACCOUNT_USER_ID.trim() !== userId
          )
            return missing(
              'GitHub-Zentrale für diesen Benutzer nicht freigeschaltet.',
            )
          const link = (await deps.listGitHubLinks(userId)).find(
            (l) => l.projectId === projectId,
          )
          if (!link)
            return missing(
              'Diesem Projekt ist kein GitHub-Repository zugeordnet.',
            )
          if (!process.env.GITHUB_API_TOKEN?.trim())
            return missing('GitHub-API-Zugang fehlt.')
          return ready(await deps.fetchGitHubSnapshot(link.repository))
        }, 'GitHub-Abruf fehlgeschlagen. Zugang, Repository-Zuordnung und API-Limit prüfen.'),
        source<DeploymentSnapshot>(async () => {
          const link = deps
            .readVercelLinks()
            .find((l) => l.userId === userId && l.projectId === projectId)
          if (!link) return missing('Keine Vercel-Projektzuordnung vorhanden.')
          if (!process.env.DEPLOYMENT_API_TOKEN?.trim())
            return missing('Vercel-API-Zugang fehlt.')
          return ready(await deps.fetchVercelSnapshot(link))
        }, 'Vercel-Abruf fehlgeschlagen. Zugang und Projektzuordnung prüfen.'),
        source<NeonSnapshot>(async () => {
          const link = getNeonLink()
          if (!link)
            return missing('Keine Neon-Projekt-/Branchzuordnung vorhanden.')
          if (!process.env.NEON_API_KEY?.trim())
            return missing('Neon-API-Zugang fehlt.')
          return ready(await deps.fetchNeonSnapshot(link))
        }, 'Neon-Abruf fehlgeschlagen. Zugang und Projekt-/Branchzuordnung prüfen.'),
        source<NeonMonitoringState>(async () => {
          const link = getNeonLink()
          if (!link)
            return missing(
              'Keine Neon-Monitoring-Historie ohne Neon-Projektzuordnung.',
            )
          const state = await deps.readNeonMonitoring(link, 1)
          // The monitoring editor also returns unlinked account monitors. They do not belong in this cockpit.
          return ready({
            ...state,
            monitors: state.monitors.filter((m) => m.linked),
          })
        }, 'Neon-Monitoring-Historie konnte nicht geladen werden.'),
        source<MissionUptime>(
          async () => ready(await deps.readMissionUptime(userId, projectId)),
          'Uptime-Zuordnungen oder Messwerte konnten nicht geladen werden.',
        ),
      ])
    // A project removed during provider requests must not yield an obsolete ownership grant.
    if (!(await deps.readMissionProject(userId, projectId))) return null
    return {
      fetchedAt: new Date().toISOString(),
      project,
      tasks,
      github,
      deployment,
      neon,
      monitoring,
      uptime,
    }
  }
}
export const loadMission = createMissionLoader()
