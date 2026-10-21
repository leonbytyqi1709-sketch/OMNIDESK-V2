const key = 'omnidesk-room-invitation'
/** Capture before Clerk's hash router starts. The secret never goes in a URL query. */
export function captureRoomInvitation(): string {
  try {
    const token = new URLSearchParams(window.location.hash.slice(1)).get(
      'invite',
    )
    if (
      window.location.pathname === '/shared-rooms' &&
      token &&
      /^[A-Za-z0-9_-]{43}$/.test(token)
    ) {
      sessionStorage.setItem(
        key,
        JSON.stringify({ token, until: Date.now() + 3600000 }),
      )
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      )
    }
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null')
    if (saved?.until > Date.now() && /^[A-Za-z0-9_-]{43}$/.test(saved.token))
      return saved.token
    sessionStorage.removeItem(key)
  } catch {
    /* A blocked session store still allows in-session joining below. */
    const token = new URLSearchParams(window.location.hash.slice(1)).get(
      'invite',
    )
    if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) return token
  }
  return ''
}
export function forgetRoomInvitation() {
  try {
    sessionStorage.removeItem(key)
  } catch {
    /* optional browser storage */
  }
  if (window.location.hash.includes('invite='))
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search,
    )
}
