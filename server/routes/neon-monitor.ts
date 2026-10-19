import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../../src/db/client'
import { projects } from '../../src/db/schema/projects'
import { fetchNeonSnapshot, readNeonLinks } from '../neon-monitor'

async function listOwnedProjects(userId: string) {
  return db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.userId, userId))
}

async function ownsProject(userId: string, projectId: string) {
  const [project] = await db.select({ id: projects.id }).from(projects).where(and(
    eq(projects.id, projectId), eq(projects.userId, userId),
  ))
  return Boolean(project)
}

export function createNeonMonitorRoute(dependencies = { listOwnedProjects, ownsProject, fetchNeonSnapshot }) {
  const route = new Hono()
  route.use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next() })
  route.get('/', async (c) => {
    try {
      const userId = c.get('userId')
      const links = readNeonLinks().filter((link) => link.userId === userId)
      if (!links.length) return c.json({ configured: false, userId, links: [] })
      const owned = await dependencies.listOwnedProjects(userId)
      return c.json({ configured: Boolean(process.env.NEON_API_KEY?.trim()), userId,
        links: links.flatMap((link) => {
          const project = owned.find((candidate) => candidate.id === link.projectId)
          return project ? [{ projectId: project.id, projectName: project.name,
            neonProjectId: link.neonProjectId, branchId: link.branchId }] : []
        }) })
    } catch {
      return c.json({ error: 'Neon-Zuordnung konnte nicht geladen werden. Serverkonfiguration und Projektdatenbank prüfen.' }, 503)
    }
  })
  route.get('/:projectId', async (c) => {
    try {
      const userId = c.get('userId')
      const projectId = c.req.param('projectId')
      const link = readNeonLinks().find((candidate) => candidate.userId === userId && candidate.projectId === projectId)
      if (!link || !(await dependencies.ownsProject(userId, projectId))) return c.json({ error: 'Keine Neon-Zuordnung für dieses Projekt vorhanden.' }, 404)
      if (!process.env.NEON_API_KEY?.trim()) return c.json({ error: 'Neon ist noch nicht eingerichtet: NEON_API_KEY fehlt.' }, 503)
      return c.json(await dependencies.fetchNeonSnapshot(link))
    } catch {
      return c.json({ error: 'Neon-Daten konnten nicht geladen werden. API-Zugang und Projekt-/Branchzuordnung prüfen und erneut versuchen.' }, 502)
    }
  })
  return route
}

export const neonMonitorRoute = createNeonMonitorRoute()
