import { monitoringSql } from './neon-storage'
export interface ActionTask {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string | null
  description: string
  version: string
}
export interface ActionProject {
  id: string
  name: string
  status: string
  description: string
  version: string
}
export interface ActionProjectTask {
  id: string
  projectId: string
  title: string
  status: string
  priority: string
  version: string
}
export interface OmniContext {
  tasks: ActionTask[]
  projects: ActionProject[]
  projectTasks: ActionProjectTask[]
  truncated: boolean
}
export async function loadOmniContext(userId: string): Promise<OmniContext> {
  const sql = monitoringSql()
  const [tasks, projects, projectTasks] = await sql.transaction(
    [
      sql`SELECT t.id,t.title,t.status,t.priority,t.due_date AS "dueDate",t.description,md5(to_jsonb(t)::text) AS version FROM tasks t WHERE user_id=${userId} ORDER BY updated_at DESC,id LIMIT 201`,
      sql`SELECT p.id,p.name,p.status,p.description,md5(to_jsonb(p)::text) AS version FROM projects p WHERE user_id=${userId} ORDER BY updated_at DESC,id LIMIT 101`,
      sql`SELECT t.id,t.project_id AS "projectId",t.title,t.status,t.priority,md5(to_jsonb(t)::text) AS version FROM project_tasks t JOIN projects p ON p.id=t.project_id AND p.user_id=t.user_id WHERE t.user_id=${userId} ORDER BY t.updated_at DESC,t.id LIMIT 201`,
    ],
    { isolationLevel: 'RepeatableRead', readOnly: true },
  )
  return {
    tasks: (tasks.slice(0, 200) as ActionTask[]).map((task) => ({
      ...task,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
    })),
    projects: projects.slice(0, 100) as ActionProject[],
    projectTasks: projectTasks.slice(0, 200) as ActionProjectTask[],
    truncated:
      tasks.length > 200 || projects.length > 100 || projectTasks.length > 200,
  }
}
/** Private descriptions are needed for conflict checks, never for the model's matching context. */
export function publicOmniContext(context: OmniContext) {
  return {
    tasks: context.tasks.map(
      ({ description: _description, version: _version, ...task }) => task,
    ),
    projects: context.projects.map(
      ({ description: _description, version: _version, ...project }) => project,
    ),
    projectTasks: context.projectTasks.map(
      ({ version: _version, ...task }) => task,
    ),
    truncated: context.truncated,
  }
}
