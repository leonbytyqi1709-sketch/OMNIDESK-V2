import { z } from 'zod'
import { browserSourceUrl } from '../src/lib/browser-url'
export class BrowserDeskError extends Error {
  status: 400 | 401 | 404 | 409 | 429 | 503
  constructor(message: string, status: BrowserDeskError['status'] = 400) {
    super(message)
    this.status = status
  }
}
export const browserItemInput = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(1).max(300),
    url: z
      .string()
      .max(4096)
      .transform((value, ctx) => {
        try {
          return browserSourceUrl(value)
        } catch {
          ctx.addIssue({
            code: 'custom',
            message: 'Ungültige oder nicht unterstützte Seitenadresse.',
          })
          return z.NEVER
        }
      }),
    selection: z.string().max(10_000),
    annotation: z.string().max(20_000),
    projectId: z.uuid().nullable(),
  })
  .strict()
  .refine(
    (v) => Boolean(v.selection.trim() || v.annotation.trim()),
    'Eine Textauswahl oder Anmerkung fehlt.',
  )
export const browserUpdateInput = z
  .object({
    title: z.string().trim().min(1).max(300),
    selection: z.string().max(10_000),
    annotation: z.string().max(20_000),
    projectId: z.uuid().nullable(),
    version: z.number().int().positive(),
  })
  .strict()
  .refine((v) => Boolean(v.selection.trim() || v.annotation.trim()))
export const browserPairInput = z
  .object({ challenge: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict()
export const browserExchangeInput = z
  .object({
    code: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    verifier: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  })
  .strict()
