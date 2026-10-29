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
export interface ActionNote {
  id: string
  title: string
  content: string
  version: string
}
export interface ActionAppointment {
  id: string
  title: string
  startsAt: string
  endsAt: string
  location: string
  description: string
  priority: string
  version: string
}
export interface ActionContact {
  id: string
  name: string
  company: string
  version: string
}
export interface OmniContext {
  tasks: ActionTask[]
  projects: ActionProject[]
  projectTasks: ActionProjectTask[]
  notes: ActionNote[]
  appointments: ActionAppointment[]
  contacts: ActionContact[]
  truncated: boolean
}
export async function loadOmniContext(userId: string): Promise<OmniContext> {
  const sql = monitoringSql()
  const [tasks, projects, projectTasks, notes, appointments, contacts] =
    await sql.transaction(
      [
        sql`SELECT t.id,t.title,t.status,t.priority,t.due_date AS "dueDate",t.description,md5(to_jsonb(t)::text) AS version FROM tasks t WHERE user_id=${userId} ORDER BY updated_at DESC,id LIMIT 201`,
        sql`SELECT p.id,p.name,p.status,p.description,md5(to_jsonb(p)::text) AS version FROM projects p WHERE user_id=${userId} ORDER BY updated_at DESC,id LIMIT 101`,
        sql`SELECT t.id,t.project_id AS "projectId",t.title,t.status,t.priority,md5(to_jsonb(t)::text) AS version FROM project_tasks t JOIN projects p ON p.id=t.project_id AND p.user_id=t.user_id WHERE t.user_id=${userId} ORDER BY t.updated_at DESC,t.id LIMIT 201`,
        sql`SELECT n.id,n.title,n.content,md5(to_jsonb(n)::text) AS version FROM notes n WHERE user_id=${userId} ORDER BY updated_at DESC,id LIMIT 101`,
        // Nur das aktuelle Umfeld: Termine weit in der Vergangenheit helfen
        // beim Planen nicht und blähen den Kontext auf.
        sql`SELECT a.id,a.title,a.starts_at AS "startsAt",a.ends_at AS "endsAt",a.location,a.description,a.priority,md5(to_jsonb(a)::text) AS version FROM appointments a WHERE user_id=${userId} AND ends_at >= now()-interval '7 days' ORDER BY starts_at,id LIMIT 101`,
        sql`SELECT c.id,trim(c.first_name||' '||c.last_name) AS name,c.company,md5(to_jsonb(c)::text) AS version FROM contacts c WHERE user_id=${userId} ORDER BY updated_at DESC,id LIMIT 101`,
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
    notes: notes.slice(0, 100) as ActionNote[],
    appointments: (appointments.slice(0, 100) as ActionAppointment[]).map(
      (appointment) => ({
        ...appointment,
        startsAt: new Date(appointment.startsAt).toISOString(),
        endsAt: new Date(appointment.endsAt).toISOString(),
      }),
    ),
    contacts: contacts.slice(0, 100) as ActionContact[],
    truncated:
      tasks.length > 200 ||
      projects.length > 100 ||
      projectTasks.length > 200 ||
      notes.length > 100 ||
      appointments.length > 100 ||
      contacts.length > 100,
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
    notes: context.notes.map(({ id, title }) => ({ id, title })),
    appointments: context.appointments.map(
      ({ description: _description, version: _version, ...appointment }) =>
        appointment,
    ),
    contacts: context.contacts.map(({ version: _version, ...contact }) => contact),
    truncated: context.truncated,
  }
}
