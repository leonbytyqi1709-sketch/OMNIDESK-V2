/** URLs are stored as source data, never fetched by the server. Remove fragments and credential/tracking parameters. */
export function browserSourceUrl(value: string) {
  if (value.length > 4096) throw new Error('Die Seitenadresse ist zu lang.')
  const url = new URL(value)
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    !url.hostname
  )
    throw new Error(
      'Nur HTTP-/HTTPS-Seiten ohne Zugangsdaten werden unterstützt.',
    )
  url.hash = ''
  for (const key of [...url.searchParams.keys()])
    if (
      /^(utm_|fbclid$|gclid$|access_token$|refresh_token$|token$|api[_-]?key$|secret$|password$|code$|authorization$|session(?:id)?$)/i.test(
        key,
      )
    )
      url.searchParams.delete(key)
  url.searchParams.sort()
  const result = url.href
  if (result.length > 2048) throw new Error('Die Seitenadresse ist zu lang.')
  return result
}
