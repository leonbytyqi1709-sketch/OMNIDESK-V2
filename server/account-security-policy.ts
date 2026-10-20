import { z } from 'zod'
import { SECURITY_STATES } from '../src/types/account-security'
const state = z.enum(SECURITY_STATES)
export const securityAccountSchema = z.object({
  name: z.string().trim().min(1).max(120), provider: z.string().trim().max(100), login: z.string().trim().max(200),
  securityUrl: z.string().trim().max(1000).refine((value) => {
    if (!value) return true
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash } catch { return false }
  }, 'Nur HTTPS-Adressen ohne Zugangsdaten, Suchparameter oder Fragment verwenden.'),
  importance: z.enum(['critical', 'high', 'normal']), passkey: state, twoFactor: state, recovery: state, recoveryCodes: state,
  recoveryMethods: z.array(z.enum(['email', 'phone', 'trusted_contact', 'recovery_key', 'hardware_key'])).max(5)
    .refine((items) => new Set(items).size === items.length),
  reviewIntervalDays: z.union([z.literal(30), z.literal(90), z.literal(180), z.literal(365)]),
  connectedAccountId: z.uuid().nullable(), reviewed: z.boolean(),
}).strict().refine((value) => value.recovery === 'enabled' || value.recoveryMethods.length === 0, 'Wiederherstellungsarten nur bei vorhandenem Wiederherstellungsweg angeben.')
export const securityVersionSchema = z.object({ version: z.number().int().positive() }).strict()
export const securityUpdateSchema = z.object({ account: securityAccountSchema, version: z.number().int().positive() }).strict()
export class SecurityAccountError extends Error {
  readonly status: 400 | 404 | 409 | 503
  constructor(message: string, status: 400 | 404 | 409 | 503) { super(message); this.status = status }
}
