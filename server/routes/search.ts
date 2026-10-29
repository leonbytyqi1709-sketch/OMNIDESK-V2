import { Hono } from 'hono'
import { SEARCH_MIN_LENGTH, SEARCH_PER_KIND } from '../../src/lib/search'
import { searchModules } from '../search-storage'

export const searchRoute = new Hono()

/**
 * Suche über alle Module. Sehr kurze Begriffe liefern bewusst nichts: Ein
 * einzelner Buchstabe träfe fast jeden Eintrag und würde die Palette fluten.
 */
searchRoute.get('/', async (c) => {
  const term = (c.req.query('q') ?? '').trim().slice(0, 100)
  if (term.length < SEARCH_MIN_LENGTH) return c.json([])
  return c.json(await searchModules(c.get('userId'), term, { perKind: SEARCH_PER_KIND }))
})
