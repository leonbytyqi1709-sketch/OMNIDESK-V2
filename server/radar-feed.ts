import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import { isIP } from 'node:net'
import {
  radarUrl,
  publicRadarAddress,
  canonicalRadarLink,
  RadarError,
} from './radar-policy'
export interface RadarFeedEntry {
  title: string
  url: string
  excerpt: string
  publishedAt: string | null
}
export interface FeedResponse {
  url?: string
  status: number
  body: string
  etag: string | null
  modified: string | null
}
export function feedText(raw: unknown, max = 700) {
  let value =
    typeof raw === 'object' && raw !== null
      ? '#text' in raw
        ? String((raw as Record<string, unknown>)['#text'])
        : ''
      : String(raw ?? '')
  value = value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
  return value
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi, (entity) => {
      const map: Record<string, string> = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&apos;': "'",
        '&nbsp;': ' ',
      }
      if (map[entity.toLowerCase()]) return map[entity.toLowerCase()]
      const n =
        entity[2]?.toLowerCase() === 'x'
          ? parseInt(entity.slice(3, -1), 16)
          : parseInt(entity.slice(2, -1), 10)
      return Number.isFinite(n) &&
        n > 0 &&
        n <= 0x10ffff &&
        !(n >= 0xd800 && n <= 0xdfff)
        ? String.fromCodePoint(n)
        : ''
    })
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}
const array = (value: unknown): Record<string, unknown>[] =>
  value == null
    ? []
    : (Array.isArray(value) ? value : [value]).filter(
        (v): v is Record<string, unknown> =>
          typeof v === 'object' && v !== null,
      )
export function parseRadarFeed(xml: string, base: string): RadarFeedEntry[] {
  if (/^\s*(?:<!doctype\s+html|<html\b)/i.test(xml))
    throw new RadarError('Diese Adresse ist eine Website. Bitte „Feeds suchen“ verwenden und einen gefundenen Feed auswählen.')
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new RadarError(
      'Dieser Feed enthält nicht unterstützte XML-Deklarationen.',
    )
  if (XMLValidator.validate(xml) !== true)
    throw new RadarError('Ungültiges XML im Feed.')
  const parsed = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    processEntities: false,
    parseTagValue: false,
    trimValues: true,
  }).parse(xml)
  const atom = Boolean(parsed.feed),
    root = atom ? parsed.feed : (parsed.rss?.channel ?? parsed.RDF)
  if (!root)
    throw new RadarError('Keine unterstützte RSS-/Atom-Quelle erkannt.')
  const entries = array(root[atom ? 'entry' : 'item']),
    seen = new Set<string>(),
    result: RadarFeedEntry[] = []
  for (const entry of entries.slice(0, 100)) {
    let link = atom
      ? array(entry.link).find(
          (v) => !v['@_rel'] || v['@_rel'] === 'alternate',
        )?.['@_href']
      : typeof entry.link === 'string'
        ? entry.link
        : (entry.link as Record<string, unknown>)?.['#text']
    if (!link && atom && typeof entry.link === 'string') link = entry.link
    if (typeof link !== 'string') continue
    try {
      const url = canonicalRadarLink(new URL(link, base).href)
      if (seen.has(url)) continue
      const title = feedText(entry.title, 300)
      if (!title) continue
      const date = String(
        entry.pubDate ?? entry.published ?? entry.updated ?? entry.date ?? '',
      )
      const timestamp = Date.parse(date)
      result.push({
        title,
        url,
        excerpt: feedText(
          entry.description ?? entry.summary ?? entry.encoded ?? entry.content,
        ),
        publishedAt: Number.isFinite(timestamp)
          ? new Date(timestamp).toISOString()
          : null,
      })
      seen.add(url)
    } catch {
      /* Invalid entry links are not executable sources. */
    }
  }
  return result
}
export async function resolveRadarAddress(host: string) {
  if (isIP(host)) {
    if (!publicRadarAddress(host))
      throw new RadarError(
        'Interne Adressen sind als Radarquelle nicht erlaubt.',
      )
    return { address: host, family: isIP(host) }
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const addresses = await Promise.race([
      lookup(host, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new RadarError('Namensauflösung der Quelle dauert zu lange.'),
            ),
          2000,
        )
      }),
    ])
    if (
      !addresses.length ||
      addresses.some((a) => !publicRadarAddress(a.address))
    )
      throw new RadarError(
        'Quelle verweist auf eine nicht öffentliche Adresse.',
      )
    return addresses.find((a) => a.family === 4) ?? addresses[0]
  } finally {
    clearTimeout(timer)
  }
}
export async function requestRadarFeed(
  address: string,
  conditional: { etag?: string | null; modified?: string | null } = {},
  redirects = 0,
): Promise<FeedResponse> {
  const url = radarUrl(address),
    host = url.hostname.replace(/^\[|\]$/g, ''),
    pinned = await resolveRadarAddress(host)
  const response = await new Promise<FeedResponse & { location?: string }>(
    (resolve, reject) => {
      const req = request(
        url,
        {
          agent: false,
          signal: AbortSignal.timeout(4000),
          headers: {
            Accept:
              'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8',
            'Accept-Encoding': 'identity',
            'User-Agent': 'OmniDesk-Radar/2.0',
            ...(conditional.etag ? { 'If-None-Match': conditional.etag } : {}),
            ...(conditional.modified
              ? { 'If-Modified-Since': conditional.modified }
              : {}),
          },
          lookup: (_hostname, options, callback) => {
            if (typeof options === 'object' && options.all)
              callback(null, [pinned])
            else callback(null, pinned.address, pinned.family)
          },
        },
        (res) => {
          res.on('error', reject)
          if (
            res.statusCode &&
            [301, 302, 303, 307, 308].includes(res.statusCode)
          ) {
            res.destroy()
            resolve({
              status: res.statusCode,
              body: '',
              etag: null,
              modified: null,
              location: res.headers.location,
            })
            return
          }
          if (
            res.headers['content-encoding'] &&
            res.headers['content-encoding'] !== 'identity'
          ) {
            res.destroy()
            reject(new RadarError('Nicht unterstützte Feed-Komprimierung.'))
            return
          }
          let bytes = 0
          const chunks: Buffer[] = []
          res.on('data', (chunk: Buffer) => {
            bytes += chunk.length
            if (bytes > 1_048_576) {
              res.destroy()
              reject(new RadarError('Der Feed ist größer als 1 MiB.'))
            } else chunks.push(chunk)
          })
          res.on('error', reject)
          res.on('end', () =>
            resolve({
              status: res.statusCode ?? 500,
              url: url.href,
              body: Buffer.concat(chunks).toString('utf8'),
              etag: res.headers.etag?.slice(0, 500) ?? null,
              modified: res.headers['last-modified']?.slice(0, 100) ?? null,
            }),
          )
        },
      )
      req.on('error', reject)
      req.end()
    },
  )
  if (response.location) {
    if (redirects >= 2)
      throw new RadarError('Zu viele Weiterleitungen der Radarquelle.')
    return requestRadarFeed(
      new URL(response.location, url).href,
      {},
      redirects + 1,
    )
  }
  return response
}
