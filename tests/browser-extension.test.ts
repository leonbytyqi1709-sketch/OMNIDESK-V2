import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { buildSync, transformSync } from 'esbuild'
import { readFileSync } from 'node:fs'
import { webcrypto } from 'node:crypto'

function background() {
  const local: Record<string, unknown> = {},
    session: Record<string, unknown> = {},
    listeners: Record<string, Function> = {},
    requests: Array<{
      url: string
      body: Record<string, unknown> | null
      authorization: string | null
    }> = []
  let tabReads = 0,
    pageReads = 0,
    granted = false
  const area = (values: Record<string, unknown>) => ({
    get: async (key: string) => ({ [key]: values[key] }),
    set: async (data: Record<string, unknown>) => {
      Object.assign(values, data)
    },
    remove: async (key: string) => {
      delete values[key]
    },
    clear: async () => {
      for (const key of Object.keys(values)) delete values[key]
    },
    setAccessLevel: async (o: { accessLevel: string }) =>
      assert.equal(o.accessLevel, 'TRUSTED_CONTEXTS'),
  })
  const chrome = {
    runtime: {
      id: 'a'.repeat(32),
      getURL: (path: string) =>
        'chrome-extension://' + 'a'.repeat(32) + '/' + path,
      onMessage: {
        addListener: (fn: Function) => {
          listeners.internal = fn
        },
      },
      onMessageExternal: {
        addListener: (fn: Function) => {
          listeners.external = fn
        },
      },
    },
    storage: { local: area(local), session: area(session) },
    sidePanel: {
      setPanelBehavior: async (o: unknown) =>
        assert.deepEqual(JSON.parse(JSON.stringify(o)), {
          openPanelOnActionClick: true,
        }),
    },
    tabs: {
      query: async () => {
        tabReads++
        return [{ id: 7 }]
      },
      create: async (o: { url: string }) => {
        assert.ok(
          o.url.startsWith(
            'https://omnidesk-work.vercel.app/browser-desk?extensionId=',
          ),
        )
        return { id: 8 }
      },
    },
    scripting: {
      executeScript: async (o: {
        func: Function
        target: { tabId: number }
      }) => {
        pageReads++
        if (!granted) throw Error('No activeTab permission')
        assert.equal(o.target.tabId, 7)
        return [
          {
            result: vm.runInNewContext('(' + o.func.toString() + ')()', {
              location: {
                href: 'https://example.com/article?token=secret&a=1#fragment',
              },
              document: { title: 'Page title' },
              window: {
                getSelection: () => ({
                  toString: () => '<script>not executed</script>',
                }),
              },
            }),
          },
        ]
      },
    },
  }
  const code = buildSync({
    stdin: {
      contents: readFileSync('browser-extension/background.js', 'utf8').replace(
        "import { browserSourceUrl } from './source-url.js'",
        transformSync(readFileSync('src/lib/browser-url.ts', 'utf8'), {
          loader: 'ts',
          format: 'iife',
          globalName: 'urlPolicy',
        }).code + '\nconst {browserSourceUrl}=urlPolicy',
      ),
      resolveDir: process.cwd(),
    },
    bundle: false,
    write: false,
    format: 'iife',
    platform: 'browser',
  }).outputFiles[0].text
  const fakeFetch = async (url: string, options: RequestInit) => {
    const body = options.body ? JSON.parse(String(options.body)) : null,
      headers = new Headers(options.headers)
    requests.push({ url, body, authorization: headers.get('Authorization') })
    if (url.endsWith('/pair/exchange'))
      return Response.json({
        token: 'omni_ext_' + 't'.repeat(43),
        deviceId: 'device1',
        expiresAt: new Date(Date.now() + 86400_000).toISOString(),
      })
    if (url.endsWith('/projects'))
      return Response.json([{ id: 'project1', name: 'Owned project' }])
    if (url.includes('/items'))
      return Response.json({ items: [], limited: false })
    if (url.endsWith('/disconnect')) return Response.json({ ok: true })
    throw Error('Unexpected fetch')
  }
  vm.runInNewContext(code, {
    chrome,
    crypto: webcrypto,
    TextEncoder,
    btoa,
    URL,
    AbortSignal,
    fetch: fakeFetch,
    Date,
    setTimeout,
    clearTimeout,
  })
  const call = (
    kind: 'internal' | 'external',
    message: unknown,
    sender: unknown,
  ) =>
    new Promise<{ ok: boolean; data?: any; error?: string }>(
      (resolve, reject) => {
        const accepted = listeners[kind](message, sender, resolve)
        if (accepted === false) reject(Error('Rejected sender'))
      },
    )
  const internal = (message: unknown) =>
    call('internal', message, {
      id: chrome.runtime.id,
      url: chrome.runtime.getURL('panel.html'),
    })
  return {
    local,
    session,
    requests,
    call,
    internal,
    get tabReads() {
      return tabReads
    },
    get pageReads() {
      return pageReads
    },
    grant() {
      granted = true
    },
  }
}
test('actual background code reads a page only for explicit capture; rejects untrusted callers and restricted pages', async () => {
  const worker = background()
  const status = await worker.internal({ type: 'STATUS' })
  assert.equal(status.data.connected, false)
  assert.equal(worker.tabReads, 0)
  assert.equal(worker.pageReads, 0)
  await assert.rejects(
    worker.call(
      'internal',
      { type: 'CAPTURE' },
      { id: 'a'.repeat(32), url: 'https://untrusted.example' },
    ),
  )
  const denied = await worker.internal({ type: 'CAPTURE' })
  assert.equal(denied.ok, false)
  assert.ok(denied.error?.includes('nicht freigegeben'))
  worker.grant()
  const captured = await worker.internal({ type: 'CAPTURE' })
  assert.equal(captured.data.url, 'https://example.com/article?a=1')
  assert.equal(captured.data.selection, '<script>not executed</script>')
  assert.equal(worker.requests.length, 0)
})
test('actual background handshake checks sender and verifier binding, keeps token private and limits API commands', async () => {
  const worker = background()
  await worker.internal({ type: 'CONNECT' })
  const pending = worker.session.pending as {
    verifier: string
    challenge: string
  }
  assert.equal(pending.challenge.length, 64)
  assert.equal(pending.verifier.length, 43)
  await assert.rejects(
    worker.call(
      'external',
      {
        type: 'OMNIDESK_PAIR',
        code: 'c'.repeat(43),
        challenge: pending.challenge,
      },
      { url: 'https://untrusted.example' },
    ),
  )
  const invalid = await worker.call(
    'external',
    { type: 'OMNIDESK_PAIR', code: 'c'.repeat(43), challenge: 'b'.repeat(64) },
    { url: 'https://omnidesk-work.vercel.app/browser-desk' },
  )
  assert.equal(invalid.ok, false)
  assert.equal(worker.requests.length, 0)
  const paired = await worker.call(
    'external',
    {
      type: 'OMNIDESK_PAIR',
      code: 'c'.repeat(43),
      challenge: pending.challenge,
    },
    { url: 'https://omnidesk-work.vercel.app/browser-desk' },
  )
  assert.equal(paired.ok, true)
  assert.equal(worker.requests[0].body?.verifier, pending.verifier)
  assert.ok(!JSON.stringify(paired).includes('omni_ext_'))
  const status = await worker.internal({ type: 'STATUS' })
  assert.equal(status.data.connected, true)
  assert.equal(status.data.deviceId, 'device1')
  assert.ok(!JSON.stringify(status).includes('omni_ext_'))
  const projects = await worker.internal({ type: 'PROJECTS' })
  assert.equal(projects.data[0].name, 'Owned project')
  assert.equal(
    worker.requests.at(-1)?.authorization,
    'Bearer omni_ext_' + 't'.repeat(43),
  )
  const unsupported = await worker.internal({
    type: 'FETCH',
    url: 'https://untrusted.example',
    path: '/api/vault',
  })
  assert.equal(unsupported.ok, false)
  assert.equal(worker.requests.length, 2)
  worker.session['draft:test'] = { annotation: 'private draft' }
  const disconnected = await worker.internal({ type: 'DISCONNECT' })
  assert.equal(disconnected.data.revoked, true)
  assert.equal(worker.local.auth, undefined)
  assert.deepEqual(worker.session, {})
  assert.equal((await worker.internal({ type: 'PROJECTS' })).ok, false)
})
