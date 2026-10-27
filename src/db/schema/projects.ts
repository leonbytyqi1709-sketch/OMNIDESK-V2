import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import type { TaskPriority } from './tasks'

export const PROJECT_STATUSES = ['active', 'paused', 'done'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const PROJECT_TASK_STATUSES = [
  'backlog',
  'todo',
  'in_progress',
  'done',
] as const
export type ProjectTaskStatus = (typeof PROJECT_TASK_STATUSES)[number]

/** Projektmanagement: IT-Infrastrukturprojekte (Spec, Abschnitt 4). */
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    priority: text('priority').$type<TaskPriority>().notNull().default('medium'),
    status: text('status').$type<ProjectStatus>().notNull().default('active'),
    tags: jsonb('tags').$type<string[]>().default([]),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('projects_user_id_idx').on(t.userId)],
)

/** Aufgaben auf dem Projekt-Kanban (Backlog → To-Do → In Arbeit → Erledigt). */
export const projectTasks = pgTable(
  'project_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    /** Freitext zur Aufgabe, etwa aus der Browser-Kommandoebene übernommen */
    description: text('description').notNull().default(''),
    status: text('status')
      .$type<ProjectTaskStatus>()
      .notNull()
      .default('backlog'),
    priority: text('priority').$type<TaskPriority>().notNull().default('medium'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('project_tasks_user_id_idx').on(t.userId),
    index('project_tasks_project_id_idx').on(t.projectId),
  ],
)

/** Meilensteine eines Projekts. */
export const milestones = pgTable(
  'milestones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    dueDate: timestamp('due_date', { withTimezone: true }),
    done: boolean('done').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('milestones_project_id_idx').on(t.projectId)],
)

export type Project = typeof projects.$inferSelect
export type ProjectTask = typeof projectTasks.$inferSelect
export type Milestone = typeof milestones.$inferSelect
