import { z } from 'zod'

/** Optimistic editing is independent of any change-history feature. */
export const editFingerprint = z.string().regex(/^[a-f0-9]{32}$/)
