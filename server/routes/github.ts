import { Hono } from 'hono'
import { z } from 'zod'
import { GitHubError, fetchGitHubSnapshot, listGitHubRepositories, repositoryName } from '../github-monitor'
import { githubProjects, ownsGitHubProject, listGitHubLinks, saveGitHubLink, deleteGitHubLink } from '../github-links'
export function createGitHubRoute(dependencies = { fetchGitHubSnapshot, listGitHubRepositories, githubProjects, ownsGitHubProject, listGitHubLinks, saveGitHubLink, deleteGitHubLink }) {
  const route = new Hono()
  route.onError((error, c) => c.json({ error: error instanceof GitHubError ? error.message : 'GitHub-Daten konnten nicht geladen werden. Einrichtung und Datenbankrechte prüfen.' }, error instanceof GitHubError ? error.status : 503))
  route.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    if (!process.env.GITHUB_ACCOUNT_USER_ID?.trim() || process.env.GITHUB_ACCOUNT_USER_ID.trim() !== c.get('userId')) return c.json({ error: 'GitHub-Zentrale nicht freigeschaltet. GITHUB_ACCOUNT_USER_ID muss deine OMNIDESK-Benutzerkennung enthalten.' }, 403)
    await next()
  })
  route.get('/', async (c) => {
    const userId = c.get('userId')
    if (!process.env.GITHUB_API_TOKEN?.trim()) return c.json({ configured: false, userId, repositories: [], limited: false, projects: [], links: [], mappingUnavailable: false })
    const catalogue = await dependencies.listGitHubRepositories()
    const [projects, links] = await Promise.allSettled([dependencies.githubProjects(userId), dependencies.listGitHubLinks(userId)])
    return c.json({ configured: true, userId, ...catalogue, projects: projects.status === 'fulfilled' ? projects.value : [],
      links: links.status === 'fulfilled' ? links.value : [], mappingUnavailable: projects.status === 'rejected' || links.status === 'rejected' })
  })
  route.get('/repositories/:owner/:repo', async (c) => c.json(await dependencies.fetchGitHubSnapshot(`${c.req.param('owner')}/${c.req.param('repo')}`)))
  route.put('/links/:projectId', async (c) => {
    const projectId = c.req.param('projectId'); const userId = c.get('userId')
    const parsed = z.object({ repository: repositoryName }).strict().safeParse(await c.req.json().catch(() => null))
    if (!z.uuid().safeParse(projectId).success || !parsed.success) return c.json({ error: 'Ungültige Projekt-/Repository-Zuordnung.' }, 400)
    if (!(await dependencies.ownsGitHubProject(userId, projectId))) return c.json({ error: 'Eigenes OMNIDESK-Projekt nicht gefunden.' }, 404)
    // Verifies token access and canonical repository identity before persisting any mapping.
    await dependencies.fetchGitHubSnapshot(parsed.data.repository)
    if (!(await dependencies.saveGitHubLink(userId, projectId, parsed.data.repository))) return c.json({ error: 'Projekt nicht mehr verfügbar.' }, 404)
    return c.json({ ok: true })
  })
  route.delete('/links/:projectId', async (c) => {
    const id = c.req.param('projectId'); const userId = c.get('userId')
    if (!z.uuid().safeParse(id).success) return c.json({ error: 'Ungültige Projektkennung.' }, 400)
    if (!(await dependencies.ownsGitHubProject(userId, id))) return c.json({ error: 'Projekt nicht gefunden.' }, 404)
    await dependencies.deleteGitHubLink(userId, id)
    return c.json({ ok: true })
  })
  return route
}
export const githubRoute = createGitHubRoute()
