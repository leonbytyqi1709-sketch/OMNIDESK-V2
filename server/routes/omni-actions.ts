import { Hono } from 'hono'
import { z } from 'zod'
import { loadOmniContext } from '../omni-actions-context'
import { planOmniWithAI } from '../omni-actions-ai'
import { prepareOmniOperations } from '../omni-actions-prepare'
import { omniTimeZone, OmniActionError } from '../omni-actions-policy'
import {
  initializeOmniActions,
  readOmniPlans,
  findOmniRequest,
  claimOmniPlanning,
  saveOmniPlan,
  executeOmniPlan,
  cancelOmniPlan,
} from '../omni-actions-storage'
export function createOmniActionsRoute(
  dependencies = {
    initializeOmniActions,
    readOmniPlans,
    findOmniRequest,
    claimOmniPlanning,
    loadOmniContext,
    planOmniWithAI,
    saveOmniPlan,
    executeOmniPlan,
    cancelOmniPlan,
  },
) {
  const route = new Hono()
  route.onError((error, c) =>
    c.json(
      {
        error:
          error instanceof OmniActionError
            ? error.message
            : 'Omni-Aktionen sind gerade nicht verfügbar. Bei unklarem Ausführungsergebnis bitte zuerst den Verlauf laden; denselben Vorschlag erneut bestätigen erzeugt keine Duplikate.',
      },
      error instanceof OmniActionError ? error.status : 503,
    ),
  )
  route.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    await next()
  })
  route.get('/', async (c) =>
    c.json(await dependencies.readOmniPlans(c.get('userId'))),
  )
  route.post('/plan', async (c) => {
    const parsed = z
      .object({
        requestId: z.uuid(),
        prompt: z.string().trim().min(1).max(4000),
        timeZone: omniTimeZone,
      })
      .strict()
      .safeParse(await c.req.json().catch(() => null))
    if (!parsed.success)
      return c.json(
        { error: 'Bitte gültigen Auftrag und Zeitzone angeben.' },
        400,
      )
    const userId = c.get('userId'),
      { requestId, prompt, timeZone } = parsed.data
    await dependencies.initializeOmniActions()
    const existing = await dependencies.findOmniRequest(userId, requestId)
    if (existing) return c.json({ type: 'plan', plan: existing })
    await dependencies.claimOmniPlanning(userId)
    const context = await dependencies.loadOmniContext(userId),
      proposed = await dependencies.planOmniWithAI(prompt, context, timeZone)
    if (proposed.type === 'clarification') return c.json(proposed)
    const prepared = prepareOmniOperations(
      proposed.operations,
      context,
      timeZone,
    )
    return c.json({
      type: 'plan',
      plan: await dependencies.saveOmniPlan(
        userId,
        requestId,
        prompt,
        timeZone,
        prepared,
      ),
    })
  })
  for (const action of ['confirm', 'cancel'] as const)
    route.post(`/:id/${action}`, async (c) => {
      const id = c.req.param('id')
      if (!z.uuid().safeParse(id).success)
        return c.json({ error: 'Ungültige Vorschlagskennung.' }, 400)
      const body = z
        .object({})
        .strict()
        .safeParse(await c.req.json().catch(() => null))
      if (!body.success)
        return c.json(
          {
            error:
              'Nur der gespeicherte Vorschlag kann bestätigt oder abgebrochen werden.',
          },
          400,
        )
      return c.json(
        await (
          action === 'confirm'
            ? dependencies.executeOmniPlan
            : dependencies.cancelOmniPlan
        )(c.get('userId'), id),
      )
    })
  return route
}
export const omniActionsRoute = createOmniActionsRoute()
