import { and, eq } from 'drizzle-orm'
import { db } from '../src/db/client'
import { projects } from '../src/db/schema/projects'
import { monitoringSql } from './neon-storage'
export async function githubProjects(userId: string) {
  return db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.userId, userId))
}
export async function ownsGitHubProject(userId: string, projectId: string) {
  const [row] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
  return Boolean(row)
}
export async function listGitHubLinks(userId: string) {
  const sql = monitoringSql()
  try {
    const rows = await sql`SELECT l.project_id AS "projectId", l.repository FROM v2_github_links l
      JOIN projects p ON p.id=l.project_id AND p.user_id=l.user_id WHERE l.user_id=${userId}`
    return rows as Array<{ projectId: string; repository: string }>
  } catch (error) { if ((error as { code?: string }).code === '42P01') return []; throw error }
}
export const githubLinksDdl = `CREATE TABLE IF NOT EXISTS v2_github_links (
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  user_id text NOT NULL, repository text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`
export async function saveGitHubLink(userId: string, projectId: string, repository: string) {
  const sql = monitoringSql()
  const [exists] = await sql`SELECT to_regclass('v2_github_links') IS NOT NULL AS ready`
  if (!exists?.ready) await sql.transaction([sql`SELECT pg_advisory_xact_lock(184730020)`, sql.query(githubLinksDdl)])
  // Ownership is checked again inside the mutation, so a concurrent transfer cannot grant access.
  const rows = await sql`INSERT INTO v2_github_links(project_id,user_id,repository)
    SELECT id,user_id,${repository} FROM projects WHERE id=${projectId} AND user_id=${userId}
    ON CONFLICT(project_id) DO UPDATE SET user_id=EXCLUDED.user_id,repository=EXCLUDED.repository,updated_at=now() RETURNING project_id`
  return rows.length > 0
}
export async function deleteGitHubLink(userId: string, projectId: string) {
  const sql = monitoringSql()
  await sql`DELETE FROM v2_github_links l USING projects p WHERE l.project_id=${projectId} AND l.user_id=${userId} AND p.id=l.project_id AND p.user_id=${userId}`
}
