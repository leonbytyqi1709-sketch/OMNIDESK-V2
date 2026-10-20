import { XMLParser } from 'fast-xml-parser'
import { parseRadarFeed, requestRadarFeed } from './radar-feed'
import { RadarError, radarUrl } from './radar-policy'

export interface RadarFeedChoice { title: string; url: string }

// Read only advertised feed links. Never execute HTML or follow page scripts.
export function advertisedRadarFeeds(html: string, address: string): RadarFeedChoice[] {
  const clean = html.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
  const choices = new Map<string, RadarFeedChoice>()
  const parser = new XMLParser({ ignoreAttributes: false, processEntities: true })
  for (const match of clean.matchAll(/<link\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    const attrs: Record<string, string> = {}
    for (const attribute of match[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      const raw = attribute[2] ?? attribute[3] ?? attribute[4]
      attrs[attribute[1].toLowerCase()] = String(parser.parse(`<v>${raw.replace(/</g, '&lt;')}</v>`).v ?? '')
    }
    if (!attrs.rel?.toLowerCase().split(/\s+/).includes('alternate') ||
      !/^(application\/(rss|atom)\+xml|application\/rdf\+xml)(?:\s*;|$)/i.test(attrs.type ?? '') || !attrs.href) continue
    try {
      const url = radarUrl(new URL(attrs.href, address).href).href
      if (!choices.has(url)) choices.set(url, { title: (attrs.title || 'RSS-/Atom-Feed').slice(0, 120), url })
      if (choices.size >= 12) break
    } catch { /* Ignore unsafe advertisements; selected feeds are checked again on fetch. */ }
  }
  return [...choices.values()]
}

export async function discoverRadarFeeds(address: string, fetchPage = requestRadarFeed) {
  const response = await fetchPage(radarUrl(address).href)
  if (response.status !== 200) throw new RadarError(`Website antwortet mit HTTP ${response.status}.`)
  const base = response.url ?? address
  if (/<(?:rss|feed|(?:\w+:)?RDF)\b/i.test(response.body.slice(0, 4000))) {
    parseRadarFeed(response.body, base)
    return { feeds: [{ title: 'RSS-/Atom-Feed', url: base }] }
  }
  const feeds = advertisedRadarFeeds(response.body, base)
  if (!feeds.length) throw new RadarError('Diese Website veröffentlicht keine automatisch erkennbaren RSS-/Atom-Links. Bitte eine Feed-Adresse des Anbieters eintragen.')
  return { feeds }
}
