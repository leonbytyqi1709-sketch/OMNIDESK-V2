import { z } from 'zod'
import type { GitHubItem, GitHubRepository, GitHubSnapshot } from '../src/types/github'
export const githubOwner = z.string().regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/)
export const githubRepo = z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/).refine((value) => value !== '.' && value !== '..')
export const repositoryName = z.string().refine((value) => {
  const parts = value.split('/')
  return parts.length === 2 && githubOwner.safeParse(parts[0]).success && githubRepo.safeParse(parts[1]).success
})
export class GitHubError extends Error {
  readonly status: 400 | 403 | 404 | 429 | 502 | 503
  constructor(message: string, status: 400 | 403 | 404 | 429 | 502 | 503 = 502) { super(message); this.status = status }
}
const text = z.string()
const nullableDate = z.string().nullable().optional()
const repoSchema = z.object({ id: z.number(), full_name: text, name: text, private: z.boolean(), default_branch: text, updated_at: nullableDate, html_url: text })
function url(value: string) {
  try { const parsed = new URL(value); return parsed.protocol === 'https:' && parsed.hostname === 'github.com' && !parsed.username && !parsed.password ? parsed.href : '' } catch { return '' }
}
function project(value: z.infer<typeof repoSchema>): GitHubRepository {
  if (!repositoryName.safeParse(value.full_name).success) throw new GitHubError('GitHub lieferte eine ungültige Repository-Kennung.')
  return { id: value.id, fullName: value.full_name, name: value.name, private: value.private, defaultBranch: value.default_branch, updatedAt: value.updated_at ?? null, url: url(value.html_url) }
}
export async function githubGet(path: string, query: Record<string, string> = {}) {
  const token = process.env.GITHUB_API_TOKEN?.trim()
  if (!token) throw new GitHubError('GITHUB_API_TOKEN ist noch nicht eingerichtet.', 503)
  const endpoint = new URL(path, 'https://api.github.com')
  if (endpoint.origin !== 'https://api.github.com') throw new GitHubError('Ungültiger API-Pfad.', 400)
  for (const [key, value] of Object.entries(query)) endpoint.searchParams.set(key, value)
  let response: Response
  try { response = await fetch(endpoint, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(12_000), headers: {
    Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'OMNIDESK-V2',
  } }) } catch { throw new GitHubError('GitHub ist derzeit nicht erreichbar.') }
  if (!response.ok) {
    const rateLimited = response.status === 429 || response.headers.get('x-ratelimit-remaining') === '0'
    throw new GitHubError(rateLimited ? 'GitHub-API-Limit erreicht. Bitte später aktualisieren.' : `GitHub-Abfrage fehlgeschlagen (HTTP ${response.status}). Token und Repository-Berechtigungen prüfen.`, rateLimited ? 429 : response.status === 404 ? 404 : 502)
  }
  if (!response.body) throw new GitHubError('Leere GitHub-Antwort.')
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength
    if (size > 2_000_000) { await reader.cancel(); throw new GitHubError('GitHub-Antwort überschreitet die Größenbegrenzung.') }; chunks.push(value) } }
  finally { reader.releaseLock() }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown } catch { throw new GitHubError('GitHub-Antwort konnte nicht gelesen werden.') }
}
export async function listGitHubRepositories() {
  const repositories: GitHubRepository[] = []
  for (let page = 1; page <= 10; page++) {
    const items = z.array(repoSchema).parse(await githubGet('/user/repos', { per_page: '100', page: String(page), sort: 'updated', affiliation: 'owner,collaborator,organization_member' }))
    for (const item of items) if (!repositories.some((repo) => repo.id === item.id)) repositories.push(project(item))
    if (items.length < 100) return { repositories, limited: false }
  }
  return { repositories, limited: true }
}
export async function fetchGitHubSnapshot(name: string): Promise<GitHubSnapshot> {
  if (!repositoryName.safeParse(name).success) throw new GitHubError('Ungültiges Repository.', 400)
  const root = `/repos/${name.split('/').map(encodeURIComponent).join('/')}`
  const repository = project(repoSchema.parse(await githubGet(root)))
  if (repository.fullName.toLowerCase() !== name.toLowerCase()) throw new GitHubError('Repository-Zuordnung stimmt nicht mit der GitHub-Antwort überein.')
  const item = (id: string | number, title: string, href: string, status: string, updatedAt?: string | null, sha?: string, branch?: string): GitHubItem =>
    ({ id: String(id), title: title.slice(0, 1000), url: url(href), status, updatedAt: updatedAt ?? null, ...(sha ? { sha } : {}), ...(branch ? { branch } : {}) })
  const issueSchema = z.object({ id: z.number(), number: z.number(), title: text, html_url: text, state: text, updated_at: nullableDate, draft: z.boolean().optional(), pull_request: z.unknown().optional() })
  const loaders = {
    branches: async () => z.array(z.object({ name: text, protected: z.boolean(), commit: z.object({ sha: text }) })).parse(await githubGet(`${root}/branches`, { per_page: '20' }))
      .map((b) => item(b.name, b.name, `https://github.com/${name}/tree/${encodeURIComponent(b.name)}`, b.protected ? 'Geschützt' : 'Branch', null, b.commit.sha, b.name)),
    commits: async () => z.array(z.object({ sha: text, html_url: text, commit: z.object({ message: text, committer: z.object({ date: nullableDate }).nullable() }) })).parse(await githubGet(`${root}/commits`, { per_page: '20', sha: repository.defaultBranch }))
      .map((c) => item(c.sha, c.commit.message, c.html_url, 'Commit', c.commit.committer?.date, c.sha, repository.defaultBranch)),
    issues: async () => z.array(issueSchema).parse(await githubGet(`${root}/issues`, { per_page: '20', state: 'open', sort: 'updated' }))
      .filter((i) => !i.pull_request).map((i) => item(i.id, `#${i.number} ${i.title}`, i.html_url, i.state, i.updated_at)),
    pulls: async () => z.array(issueSchema).parse(await githubGet(`${root}/pulls`, { per_page: '20', state: 'open', sort: 'updated' }))
      .map((i) => item(i.id, `#${i.number} ${i.title}`, i.html_url, i.draft ? 'Entwurf' : i.state, i.updated_at)),
    runs: async () => z.object({ workflow_runs: z.array(z.object({ id: z.number(), name: text.nullable(), html_url: text, status: text, conclusion: text.nullable(), updated_at: nullableDate, head_sha: text, head_branch: text.nullable() })) }).parse(await githubGet(`${root}/actions/runs`, { per_page: '20' })).workflow_runs
      .map((r) => item(r.id, r.name ?? 'Workflow', r.html_url, r.conclusion ?? r.status, r.updated_at, r.head_sha, r.head_branch ?? undefined)),
    releases: async () => z.array(z.object({ id: z.number(), name: text.nullable(), tag_name: text, html_url: text, published_at: nullableDate, draft: z.boolean(), prerelease: z.boolean() })).parse(await githubGet(`${root}/releases`, { per_page: '20' }))
      .map((r) => item(r.id, r.name || r.tag_name, r.html_url, r.draft ? 'Entwurf' : r.prerelease ? 'Vorabversion' : 'Release', r.published_at)),
  }
  const keys = Object.keys(loaders) as Array<keyof typeof loaders>
  const results = await Promise.allSettled(keys.map((key) => loaders[key]()))
  const values = Object.fromEntries(keys.map((key, i) => [key, results[i].status === 'fulfilled' ? results[i].value : null])) as Pick<GitHubSnapshot, keyof typeof loaders>
  return { repository, ...values, checkedAt: new Date().toISOString(), unavailable: keys.filter((_key, i) => results[i].status === 'rejected'), limit: 20 }
}
