import { z } from 'zod'
export const accountRelationSchema = z.object({
  fromAccountId: z.uuid(), toAccountId: z.uuid(), type: z.enum(['login', 'recovery_email', 'recovery_other']),
  loginDependency: z.enum(['only_known', 'alternative_known', 'unknown']).nullable(), reviewed: z.boolean(),
}).strict().refine((value) => value.fromAccountId !== value.toAccountId, 'Ein Konto kann nicht auf sich selbst verweisen.')
  .refine((value) => value.type === 'login' ? value.loginDependency !== null : value.loginDependency === null, 'Anmeldeabhängigkeit passt nicht zum Verbindungstyp.')
export const relationVersionSchema = z.object({ version: z.number().int().positive() }).strict()
export const relationUpdateSchema = z.object({ relation: accountRelationSchema, version: z.number().int().positive() }).strict()
