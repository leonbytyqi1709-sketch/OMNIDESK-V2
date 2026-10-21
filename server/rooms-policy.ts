import { z } from 'zod'
export class RoomError extends Error {
  status: 400 | 403 | 404 | 409 | 429
  constructor(message: string, status: 400 | 403 | 404 | 409 | 429 = 409) {
    super(message)
    this.status = status
  }
}
export const roomRole = z.enum(['reader', 'editor'])
export const roomExpiry = z.iso.datetime({ offset: true }).refine((value) => {
  const delta = Date.parse(value) - Date.now()
  return delta > 0 && delta <= 366 * 86400000
}, 'Ablauf muss in der Zukunft und innerhalb eines Jahres liegen.')
export const roomText = z.string().trim().min(1).max(5000)
export const roomCreate = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(5000),
    expiresAt: roomExpiry,
    initialItems: z
      .array(
        z.object({ kind: z.enum(['list', 'pin']), text: roomText }).strict(),
      )
      .max(100),
  })
  .strict()
export const roomVersion = z
  .object({ version: z.number().int().positive() })
  .strict()
export const roomItemCreate = z
  .object({ id: z.uuid(), kind: z.enum(['list', 'pin']), text: roomText })
  .strict()
export const roomItemUpdate = z
  .object({
    text: roomText,
    done: z.boolean(),
    version: z.number().int().positive(),
  })
  .strict()
export const roomToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/)
export const roomJoin = z
  .object({ token: roomToken, name: z.string().trim().min(1).max(60) })
  .strict()
