import { browserSourceUrl } from './source-url.js'
const APP = 'https://omnidesk-work.vercel.app'
chrome.storage.local
  .setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
  .catch(() => {})
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => {})
const random = () =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
const hash = async (value) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('')
async function clearConnection() {
  await chrome.storage.local.remove('auth')
  await chrome.storage.session.clear()
}
async function auth() {
  const { auth: value } = await chrome.storage.local.get('auth')
  if (
    value &&
    (!Number.isFinite(Date.parse(value.expiresAt)) ||
      Date.parse(value.expiresAt) <= Date.now())
  ) {
    await clearConnection()
    return null
  }
  return value ?? null
}
async function request(path, method = 'GET', body, credential) {
  const response = await fetch(APP + '/api/browser-extension' + path, {
    method,
    redirect: 'error',
    signal: AbortSignal.timeout(25000),
    headers: {
      ...(credential ? { Authorization: 'Bearer ' + credential } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await response.text()
  if (text.length > 4_000_000)
    throw Error('Die Antwort ist zu groß. Bitte in OMNIDESK öffnen.')
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw Error(
      'OMNIDESK hat keine gültige API-Antwort geliefert. Bitte später erneut versuchen.',
    )
  }
  if (!response.ok) {
    if (response.status === 401 && credential) await clearConnection()
    throw Error(
      typeof data.error === 'string'
        ? data.error
        : 'Anfrage fehlgeschlagen (' + response.status + ').',
    )
  }
  return data
}
async function capture() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) throw Error('Keine aktive Webseite gefunden.')
  let results
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        url: location.href,
        title: document.title,
        selection: window.getSelection()?.toString().slice(0, 10000) ?? '',
      }),
    })
  } catch {
    throw Error(
      'Diese Seite ist nicht freigegeben oder Chrome sperrt sie. Klicke auf dieser Webseite erneut das OMNIDESK-Symbol oder nutze Alt+Umschalt+O. Chrome-Seiten, Web Store und manche PDF-/eingebetteten Inhalte sind nicht zugänglich.',
    )
  }
  const page = results?.[0]?.result
  if (!page) throw Error('Die Webseite hat keinen lesbaren Kontext geliefert.')
  const url = browserSourceUrl(page.url)
  return {
    url,
    title: String(page.title || new URL(url).hostname).slice(0, 300),
    selection: String(page.selection || '').slice(0, 10000),
  }
}
async function handle(message) {
  if (message?.type === 'STATUS') {
    const value = await auth()
    return {
      connected: Boolean(value),
      expiresAt: value?.expiresAt ?? null,
      deviceId: value?.deviceId ?? null,
    }
  }
  if (message?.type === 'CAPTURE') return capture()
  if (message?.type === 'CONNECT') {
    if (await auth())
      throw Error('Bereits verbunden. Zum Kontowechsel zuerst trennen.')
    const verifier = random(),
      challenge = await hash(verifier)
    await chrome.storage.session.set({
      pending: { verifier, challenge, expiresAt: Date.now() + 5 * 60_000 },
    })
    await chrome.tabs.create({
      url:
        APP +
        '/browser-desk?extensionId=' +
        chrome.runtime.id +
        '&challenge=' +
        challenge,
    })
    return { opened: true }
  }
  const value = await auth()
  if (!value) throw Error('Bitte zuerst mit OMNIDESK verbinden.')
  if (message?.type === 'DISCONNECT') {
    let revoked = true
    try {
      await request('/data/disconnect', 'POST', undefined, value.token)
    } catch {
      revoked = false
    }
    await clearConnection()
    return { revoked }
  }
  const operations = {
    PANEL: () => request('/data/panel', 'GET', undefined, value.token),
    SAVE_CAPTURE: () =>
      request('/data/capture', 'POST', message.input, value.token),
    PROJECTS: () => request('/data/projects', 'GET', undefined, value.token),
    ITEMS: () =>
      request(
        '/data/items?url=' +
          encodeURIComponent(browserSourceUrl(String(message.url))),
        'GET',
        undefined,
        value.token,
      ),
    CREATE: () => request('/data/items', 'POST', message.input, value.token),
    UPDATE: () =>
      request(
        '/data/items/' + encodeURIComponent(String(message.id)),
        'PUT',
        message.input,
        value.token,
      ),
    DELETE: () =>
      request(
        '/data/items/' + encodeURIComponent(String(message.id)),
        'DELETE',
        { version: message.version },
        value.token,
      ),
  }
  if (!Object.hasOwn(operations, message?.type ?? ''))
    throw Error('Nicht unterstützte Aktion.')
  return operations[message.type]()
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (
    sender.id !== chrome.runtime.id ||
    sender.url !== chrome.runtime.getURL('panel.html')
  )
    return false
  handle(message)
    .then((data) => respond({ ok: true, data }))
    .catch((error) =>
      respond({
        ok: false,
        error:
          error instanceof Error ? error.message : 'Aktion fehlgeschlagen.',
      }),
    )
  return true
})
chrome.runtime.onMessageExternal.addListener((message, sender, respond) => {
  let origin
  try {
    origin = new URL(sender.url).origin
  } catch {
    return false
  }
  if (origin !== APP || message?.type !== 'OMNIDESK_PAIR') return false
  ;(async () => {
    const { pending } = await chrome.storage.session.get('pending')
    if (
      !pending ||
      pending.expiresAt < Date.now() ||
      pending.challenge !== message.challenge ||
      !/^[A-Za-z0-9_-]{43}$/.test(message.code ?? '')
    )
      throw Error(
        'Verbindungsanfrage ist abgelaufen. Erneut aus der Erweiterung starten.',
      )
    const data = await request('/pair/exchange', 'POST', {
      code: message.code,
      verifier: pending.verifier,
    })
    if (
      !/^omni_ext_[A-Za-z0-9_-]{43}$/.test(data.token ?? '') ||
      !data.deviceId ||
      !Number.isFinite(Date.parse(data.expiresAt))
    )
      throw Error('Verbindung konnte nicht bestätigt werden.')
    await chrome.storage.local.set({
      auth: {
        token: data.token,
        deviceId: data.deviceId,
        expiresAt: data.expiresAt,
      },
    })
    await chrome.storage.session.remove('pending')
    return { connected: true }
  })()
    .then((data) => respond({ ok: true, data }))
    .catch((error) =>
      respond({
        ok: false,
        error:
          error instanceof Error ? error.message : 'Verbindung fehlgeschlagen.',
      }),
    )
  return true
})
