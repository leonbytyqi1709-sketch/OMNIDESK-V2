import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../../src/db/client'
import { projects } from '../../src/db/schema/projects'
import { VercelMonitorError, fetchVercelLogs, fetchVercelSnapshot, readVercelLinks } from '../vercel-monitor'

async function listOwnedProjects(userId: string) {
  return db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.userId, userId))
}

async function ownsProject(userId: string, projectId: string) {
  const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
  return Boolean(project)
}

export function createDeploymentsRoute(dependencies = { listOwnedProjects, ownsProject, fetchVercelSnapshot, fetchVercelLogs }) {
  const route = new Hono()
  route.use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next() })
  route.get('/', async (c) => {
    try {
      const userId = c.get('userId')
      const links = readVercelLinks().filter((link) => link.userId === userId)
      if (!links.length) return c.json({ configured: false, userId, links: [] })
      const owned = await dependencies.listOwnedProjects(userId)
      return c.json({ configured: Boolean(process.env.DEPLOYMENT_API_TOKEN?.trim()), userId,
        links: links.flatMap((link) => {
          const project = owned.find((candidate) => candidate.id === link.projectId)
          return project ? [{ projectId: project.id, projectName: project.name,
            vercelProjectId: link.vercelProjectId, teamId: link.teamId ?? null }] : []
        }) })
    } catch (error) {
      if (error instanceof VercelMonitorError) return c.json({ code: error.code, error: error.message }, error.status)
      return c.json({ code: 'VERCEL_PROJECT_LOOKUP_FAILED', error: 'OMNIDESK-Projekte konnten nicht geladen werden. Projektmanagement und Datenbankkonfiguration prüfen.' }, 503)
    }
  })
  route.get('/:projectId', async (c) => {
    try {
      const link = readVercelLinks().find((candidate) => candidate.userId === c.get('userId') && candidate.projectId === c.req.param('projectId'))
      if (!link || !(await dependencies.ownsProject(c.get('userId'), link.projectId))) return c.json({ error: 'Keine Vercel-Zuordnung für dieses Projekt vorhanden.' }, 404)
      return c.json(await dependencies.fetchVercelSnapshot(link))
    } catch (error) {
      if (error instanceof VercelMonitorError) return c.json({ code: error.code, error: error.message }, error.status)
      return c.json({ error: 'Deployment-Daten konnten nicht geladen werden. Bitte später erneut versuchen.' }, 502)
    }
  })
  route.get('/:projectId/:deploymentId/logs', async (c) => {
    try {
      const link = readVercelLinks().find((candidate) => candidate.userId === c.get('userId') && candidate.projectId === c.req.param('projectId'))
      if (!link || !(await dependencies.ownsProject(c.get('userId'), link.projectId))) return c.json({ error: 'Keine Vercel-Zuordnung für dieses Projekt vorhanden.' }, 404)
      return c.json(await dependencies.fetchVercelLogs(link, c.req.param('deploymentId')))
    } catch (error) {
      if (error instanceof VercelMonitorError) return c.json({ code: error.code, error: error.message }, error.status)
      return c.json({ error: 'Build-Logs konnten nicht geladen werden. Zugriff und Verfügbarkeit bei Vercel prüfen.' }, 502)
    }
  })
  return route
}

export const deploymentsRoute = createDeploymentsRoute()
