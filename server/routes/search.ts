import { Hono } from 'hono'
import {
  SEARCH_KINDS,
  SEARCH_MIN_LENGTH,
  SEARCH_PER_KIND,
  type SearchKind,
} from '../../src/lib/search'
import { searchModules } from '../search-storage'

export const searchRoute = new Hono()

/**
 * Suche über alle Module. Sehr kurze Begriffe liefern bewusst nichts: Ein
 * einzelner Buchstabe träfe fast jeden Eintrag und würde die Palette fluten.
 */
searchRoute.get('/', async (c) => {
  const term = (c.req.query('q') ?? '').trim().slice(0, 100)
  if (term.length < SEARCH_MIN_LENGTH) return c.json([])
  // Ohne Angabe wird über alles gesucht; der Fokus-Timer schränkt auf die
  // Arten ein, an denen sich Zeit erfassen lässt. Unbekannte Werte entfallen.
  const requested = (c.req.query('kinds') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is SearchKind => (SEARCH_KINDS as readonly string[]).includes(value))
  return c.json(
    await searchModules(c.get('userId'), term, {
      perKind: SEARCH_PER_KIND,
      kinds: requested.length > 0 ? requested : undefined,
    }),
  )
})
