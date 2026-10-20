import { z } from 'zod'
import { addBriefingDays, briefingDayStart } from '../src/lib/briefing'
export class OmniActionError extends Error {
  status: 400 | 404 | 409 | 429 | 503
  constructor(message: string, status: OmniActionError['status'] = 400) {
    super(message)
    this.status = status
  }
}
const title = z.string().trim().min(1).max(300),
  priority = z.enum(['high', 'medium', 'low'])
const day = z.iso
  .date()
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
  )
const localTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
export const omniTimeZone = z
  .string()
  .max(80)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat('de-DE', { timeZone: v })
      return true
    } catch {
      return false
    }
  })
const personalFields = z
  .object({
    title: title.optional(),
    description: z.string().max(10000).optional(),
    priority: priority.optional(),
    status: z.enum(['todo', 'in_progress', 'done']).optional(),
    dueDate: day.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0)
const projectFields = z
  .object({
    title: title.optional(),
    priority: priority.optional(),
    status: z.enum(['backlog', 'todo', 'in_progress', 'done']).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0)
export const omniOperationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('create_task'),
      title,
      description: z.string().max(10000),
      priority,
      status: z.enum(['todo', 'in_progress', 'done']),
      dueDate: day.nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('update_task'),
      taskId: z.uuid(),
      changes: personalFields,
    })
    .strict(),
  z
    .object({
      kind: z.literal('create_project_task'),
      projectId: z.uuid(),
      title,
      priority,
      status: z.enum(['backlog', 'todo', 'in_progress', 'done']),
    })
    .strict(),
  z
    .object({
      kind: z.literal('update_project_task'),
      taskId: z.uuid(),
      changes: projectFields,
    })
    .strict(),
  z
    .object({
      kind: z.literal('create_appointment'),
      title,
      description: z.string().max(10000),
      location: z.string().max(300),
      priority,
      startLocal: localTime,
      endLocal: localTime,
    })
    .strict(),
  z
    .object({
      kind: z.literal('append_project_note'),
      projectId: z.uuid(),
      text: z.string().trim().min(1).max(5000),
    })
    .strict(),
])
export const omniPlannerOutput = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('clarification'),
      message: z.string().trim().min(1).max(1500),
    })
    .strict(),
  z
    .object({
      type: z.literal('plan'),
      operations: z.array(omniOperationSchema).min(1).max(5),
    })
    .strict(),
])
export type OmniOperation = z.infer<typeof omniOperationSchema>
export interface StoredOperation {
  kind: OmniOperation['kind']
  id: string
  projectId?: string
  projectVersion?: string
  before: Record<string, unknown> | null
  after: Record<string, unknown>
}
/** Resolve wall time on the server. Missing and repeated DST times must never be silently guessed. */
export function localTimeToIso(local: string, timeZone: string) {
  const parsed = localTime.safeParse(local)
  if (
    !parsed.success ||
    !day.safeParse(local.slice(0, 10)).success ||
    Number(local.slice(11, 13)) > 23 ||
    Number(local.slice(14, 16)) > 59
  )
    throw new OmniActionError(
      'Datum oder Uhrzeit ist ungültig. Bitte konkret angeben.',
    )
  const utc = Date.parse(local + 'Z'),
    candidates = new Set<number>()
  const format = (date: number) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(date))
    const get = (key: string) => parts.find((p) => p.type === key)?.value
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
  }
  for (const delta of [-36, -24, -12, 0, 12, 24, 36]) {
    const sample = utc + delta * 3600_000
    const offset = Date.parse(format(sample) + 'Z') - sample
    const candidate = utc - offset
    if (format(candidate) === local) candidates.add(candidate)
  }
  if (candidates.size !== 1)
    throw new OmniActionError(
      'Diese Ortszeit ist wegen der Zeitumstellung nicht eindeutig oder existiert nicht. Bitte eine andere eindeutige Uhrzeit wählen.',
    )
  return new Date([...candidates][0]).toISOString()
}
export function dueDateToIso(value: string | null, timeZone: string) {
  // Match the existing task form: a day-only deadline expires at the end of that day.
  // Use the next local boundary, rather than adding 24h, to preserve DST correctness.
  return value
    ? new Date(
        Date.parse(briefingDayStart(addBriefingDays(value, 1), timeZone)) -
          1000,
      ).toISOString()
    : null
}
