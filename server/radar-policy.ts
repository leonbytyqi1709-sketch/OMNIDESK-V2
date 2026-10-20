import { z } from 'zod'
import ipaddr from 'ipaddr.js'
export class RadarError extends Error {
  status: 400 | 404 | 409 | 429 | 503
  constructor(message: string, status: RadarError['status'] = 400) {
    super(message)
    this.status = status
  }
}
export function publicRadarAddress(address: string) {
  try {
    return ipaddr.process(address).range() === 'unicast'
  } catch {
    return false
  }
}
export function radarUrl(value: string) {
  const url = new URL(value)
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    host === 'localhost' ||
    /\.(local|localhost|internal|test|invalid)$/.test(host) ||
    (ipaddr.isValid(host) ? !publicRadarAddress(host) : !host.includes('.'))
  )
    throw new RadarError(
      'Bitte eine öffentliche HTTPS-Adresse ohne Zugangsdaten verwenden.',
    )
  url.hash = ''
  return url
}
export const radarTopicInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    keywords: z
      .array(z.string().trim().min(2).max(70))
      .min(1)
      .max(12)
      .transform((values) => [
        ...new Set(values.map((value) => value.toLocaleLowerCase('de'))),
      ]),
    projectId: z.uuid().nullable(),
    enabled: z.boolean(),
  })
  .strict()
export const radarSourceInput = z
  .object({
    topicId: z.uuid(),
    name: z.string().trim().min(1).max(120),
    url: z
      .string()
      .max(2048)
      .transform((value, ctx) => {
        try {
          return radarUrl(value).href
        } catch {
          ctx.addIssue({
            code: 'custom',
            message: 'Öffentliche HTTPS-Feed-Adresse erforderlich.',
          })
          return z.NEVER
        }
      }),
    category: z.enum(['news', 'security', 'release', 'status']),
  })
  .strict()
export function radarMatches(
  title: string,
  excerpt: string,
  keywords: string[],
) {
  const text = (title + ' ' + excerpt).normalize('NFKC').toLocaleLowerCase('de')
  return keywords.filter((keyword) =>
    text.includes(keyword.normalize('NFKC').toLocaleLowerCase('de')),
  )
}
export function canonicalRadarLink(value: string) {
  const url = radarUrl(value)
  for (const key of [...url.searchParams.keys()])
    if (/^utm_|^(fbclid|gclid|mc_cid|mc_eid)$/i.test(key))
      url.searchParams.delete(key)
  url.searchParams.sort()
  return url.href
}
