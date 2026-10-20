import { z } from 'zod'
import { MEMORY_CATEGORIES } from '../src/types/omni-memory'
export class OmniMemoryError extends Error {
  status: 400 | 404 | 409 | 503
  constructor(message: string, status: OmniMemoryError['status'] = 400) {
    super(message)
    this.status = status
  }
}
export const memoryInputSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    content: z.string().trim().min(1).max(4000),
    category: z.enum(MEMORY_CATEGORIES),
    projectId: z.uuid().nullable(),
    pinned: z.boolean(),
    archived: z.boolean(),
  })
  .strict()
export const createMemorySchema = memoryInputSchema
  .extend({ id: z.uuid(), sourceMessageId: z.uuid().nullable().default(null) })
  .strict()
export const updateMemorySchema = memoryInputSchema
  .extend({ version: z.number().int().positive() })
  .strict()
export const chatMemoryOptions = z
  .object({
    enabled: z.boolean(),
    projectId: z.uuid().nullable(),
    autoCapture: z.boolean().optional(),
  })
  .strict()
export type ChatMemoryOptions = z.infer<typeof chatMemoryOptions>
