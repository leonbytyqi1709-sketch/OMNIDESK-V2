import { z } from 'zod'
import { MEMORY_CATEGORIES } from '../src/types/omni-memory'
export const autoExtractionSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(160),
            evidence: z.string().trim().min(6).max(1500),
            category: z.enum(MEMORY_CATEGORIES),
            targetId: z.uuid().nullable(),
            certainty: z.enum(['explicit', 'uncertain']),
            correction: z.boolean(),
          })
          .strict(),
      )
      .max(3),
  })
  .strict()
export type AutoExtraction = z.infer<typeof autoExtractionSchema>
export function sensitiveMemoryText(text: string) {
  return /(?:sk[-_](?:proj[-_])?[a-z0-9_-]{16,}|gh[pousr]_[a-z0-9]{15,}|github_pat_|-----BEGIN [A-Z ]*PRIVATE KEY|\bBearer\s+[a-z0-9._~+/-]{10,}|(?:password|passwort|api[ -_]?key|secret|token|wiederherstellungscode|recovery[ -]?code)\s*(?:ist|lautet|[:=])\s*\S{4,})/i.test(
    text,
  )
}
export function needsMemoryQuestion(
  evidence: string,
  certainty: 'explicit' | 'uncertain',
  update: boolean,
  correction: boolean,
) {
  return (
    certainty !== 'explicit' ||
    /\?|\b(vielleicht|vermutlich|eventuell|wahrscheinlich|ich glaube|ich denke|angenommen|falls|wenn|hypothetisch)\b/i.test(
      evidence,
    ) ||
    (update &&
      (!correction ||
        !/\b(statt|jetzt|nicht mehr|ab sofort|ab jetzt|korrigiere|ändere|sondern|inzwischen|wechsel|zukünftig)\b/i.test(
          evidence,
        )))
  )
}
