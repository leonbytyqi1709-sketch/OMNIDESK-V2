import { z } from 'zod'
import type { HistoryKind, HistoryField } from '../src/types/working-history'
export const historyKind = z.enum(['note', 'task', 'project_task'])
export const historyFingerprint = z.string().regex(/^[a-f0-9]{32}$/)
export const historyFields: Record<HistoryKind, readonly HistoryField[]> = {
  note: ['title', 'content'],
  task: [
    'title',
    'description',
    'priority',
    'status',
    'dueDate',
    'tags',
    'subtasks',
  ],
  project_task: ['title', 'status', 'priority'],
}
export const historyPreferences = z
  .object({
    enabled: z.boolean(),
    retentionDays: z.union([
      z.literal(7),
      z.literal(30),
      z.literal(90),
      z.literal(365),
    ]),
    maxVersions: z.union([z.literal(10), z.literal(25), z.literal(50)]),
  })
  .strict()
export const historyRestore = z
  .object({
    versionId: z.uuid(),
    expectedFingerprint: historyFingerprint,
    fields: z
      .array(
        z.enum([
          'title',
          'content',
          'description',
          'status',
          'priority',
          'dueDate',
          'tags',
          'subtasks',
        ]),
      )
      .min(1)
      .max(8),
  })
  .strict()
export class HistoryError extends Error {
  status: 400 | 404 | 409
  constructor(message: string, status: 400 | 404 | 409 = 409) {
    super(message)
    this.status = status
  }
}
