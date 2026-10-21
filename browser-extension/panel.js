const el = (id) => document.getElementById(id)
let deviceId = null,
  authChanged = false
let state = {
    ownerDeviceId: null,
    id: crypto.randomUUID(),
    version: null,
    url: '',
    title: '',
    selection: '',
    annotation: '',
    projectId: null,
  },
  connected = false,
  busy = false,
  dirty = false,
  items = [],
  draftKey = 'draft'
async function send(message) {
  const reply = await chrome.runtime.sendMessage(message)
  if (!reply?.ok)
    throw Error(
      reply?.error || 'Erweiterung antwortet nicht. Panel erneut öffnen.',
    )
  return reply.data
}
function message(text, error = false) {
  el('message').textContent = text
  el('message').className = error ? 'error' : 'success'
}
function fields() {
  for (const key of ['url', 'title', 'selection', 'annotation'])
    el(key).value = state[key]
  el('project').value = state.projectId ?? ''
}
function read() {
  for (const key of ['title', 'selection', 'annotation'])
    state[key] = el(key).value
  state.projectId = el('project').value || null
}
async function persist() {
  read()
  await chrome.storage.session.set({ [draftKey]: state })
}
async function task(fn) {
  if (busy) return
  busy = true
  document.querySelectorAll('button').forEach((b) => (b.disabled = true))
  try {
    await fn()
  } catch (e) {
    message(e.message || 'Aktion fehlgeschlagen.', true)
  } finally {
    busy = false
    document.querySelectorAll('button').forEach((b) => (b.disabled = false))
    el('save').disabled = !connected || !state.url
    if (authChanged) {
      authChanged = false
      void task(status)
    }
  }
}
async function status() {
  const value = await send({ type: 'STATUS' })
  connected = value.connected
  deviceId = value.deviceId
  if (connected && state.ownerDeviceId && state.ownerDeviceId !== deviceId) {
    state = {
      ownerDeviceId: deviceId,
      id: crypto.randomUUID(),
      version: null,
      url: '',
      title: '',
      selection: '',
      annotation: '',
      projectId: null,
    }
    dirty = false
    items = []
    render()
  }
  if (connected) state.ownerDeviceId = deviceId
  el('connection').textContent = connected
    ? 'Verbunden · gültig bis ' +
      new Date(value.expiresAt).toLocaleDateString('de-DE')
    : 'Nicht verbunden. Anmeldung und Freigabe erfolgen in deiner OMNIDESK-App.'
  el('connect').hidden = connected
  el('disconnect').hidden = !connected
  el('save').disabled = !connected || !state.url
  if (!connected) {
    if (state.ownerDeviceId) {
      state = {
        ownerDeviceId: null,
        id: crypto.randomUUID(),
        version: null,
        url: '',
        title: '',
        selection: '',
        annotation: '',
        projectId: null,
      }
      dirty = false
      fields()
    }
    items = []
    render()
    return
  }
  const projects = await send({ type: 'PROJECTS' }),
    select = el('project')
  select.replaceChildren(new Option('Persönlich · ohne Projekt', ''))
  for (const p of projects) select.add(new Option(p.name, p.id))
  if (state.projectId && !projects.some((p) => p.id === state.projectId)) {
    state.projectId = null
    message(
      'Das vorherige Projekt ist nicht mehr zugänglich. Bitte neu zuordnen.',
      true,
    )
  }
  fields()
  await load()
}
async function load() {
  if (!connected || !state.url) {
    el('list-state').textContent = connected
      ? 'Zuerst einen Seitenkontext übernehmen.'
      : 'Verbinde die Erweiterung, um deine gespeicherten Anmerkungen zu laden.'
    return
  }
  items = []
  render()
  el('list-state').textContent = 'Anmerkungen werden geladen…'
  const data = await send({ type: 'ITEMS', url: state.url })
  items = data.items
  render()
  el('list-state').textContent = items.length
    ? items.length +
      ' Einträge zur übernommenen Quelle.' +
      (data.limited ? ' Der angezeigte Ausschnitt ist begrenzt.' : '')
    : 'Noch keine Anmerkungen zu dieser Quelle.'
}
function render() {
  const host = el('items')
  host.replaceChildren()
  for (const item of items) {
    const section = document.createElement('article')
    section.className = 'item'
    const h = document.createElement('h3')
    h.textContent = item.title
    section.append(h)
    if (item.selection) {
      const quote = document.createElement('blockquote')
      quote.textContent = item.selection
      section.append(quote)
    }
    if (item.annotation) {
      const text = document.createElement('p')
      text.textContent = item.annotation
      section.append(text)
    }
    const meta = document.createElement('p')
    meta.className = 'meta'
    meta.textContent =
      (item.projectName ?? 'Persönlich') +
      ' · ' +
      new Date(item.updatedAt).toLocaleString('de-DE')
    section.append(meta)
    const actions = document.createElement('div')
    actions.className = 'actions'
    const edit = document.createElement('button')
    edit.className = 'secondary'
    edit.textContent = 'Bearbeiten'
    edit.addEventListener('click', () =>
      task(async () => {
        if (dirty && !confirm('Nicht gespeicherten Entwurf verwerfen?')) return
        state = {
          ownerDeviceId: deviceId,
          id: item.id,
          version: item.version,
          url: item.url,
          title: item.title,
          selection: item.selection,
          annotation: item.annotation,
          projectId: item.projectId,
        }
        dirty = false
        fields()
        await persist()
        el('annotation').focus()
      }),
    )
    const remove = document.createElement('button')
    remove.className = 'secondary'
    remove.textContent = 'Löschen'
    remove.addEventListener('click', () =>
      task(async () => {
        if (!confirm('Diese Browser-Anmerkung löschen?')) return
        await send({ type: 'DELETE', id: item.id, version: item.version })
        message('Anmerkung gelöscht.')
        await load()
      }),
    )
    actions.append(edit, remove)
    section.append(actions)
    host.append(section)
  }
}
el('capture').addEventListener('click', () =>
  task(async () => {
    if (
      dirty &&
      !confirm(
        'Nicht gespeicherten Entwurf verwerfen und neue Seite übernehmen?',
      )
    )
      return
    const page = await send({ type: 'CAPTURE' })
    state = {
      ...page,
      ownerDeviceId: deviceId,
      id: crypto.randomUUID(),
      version: null,
      annotation: '',
      projectId: state.projectId,
    }
    dirty = Boolean(page.selection)
    fields()
    await persist()
    message(
      'Seitenkontext übernommen. Prüfe Text und Quelle vor dem Speichern.',
    )
    await load()
  }),
)
el('connect').addEventListener('click', () =>
  task(async () => {
    await send({ type: 'CONNECT' })
    message(
      'Bestätige die Verbindung in der geöffneten OMNIDESK-App. Danach kannst du hier weiterarbeiten.',
    )
  }),
)
el('disconnect').addEventListener('click', () =>
  task(async () => {
    const result = await send({ type: 'DISCONNECT' })
    state = {
      id: crypto.randomUUID(),
      version: null,
      url: '',
      title: '',
      selection: '',
      annotation: '',
      projectId: null,
    }
    fields()
    dirty = false
    await status()
    message(
      result.revoked
        ? 'Verbindung getrennt.'
        : 'Lokal getrennt. Server nicht erreichbar: Die Verbindung zusätzlich unter Browser-Kommandoebene in der App widerrufen.',
      !result.revoked,
    )
  }),
)
el('refresh').addEventListener('click', () => task(load))
el('new').addEventListener('click', () =>
  task(async () => {
    if (dirty && !confirm('Nicht gespeicherten Entwurf verwerfen?')) return
    state = {
      ...state,
      id: crypto.randomUUID(),
      version: null,
      selection: '',
      annotation: '',
    }
    dirty = false
    fields()
    await persist()
    message('Neuer Eintrag zur übernommenen Quelle.')
  }),
)
el('editor').addEventListener('submit', (event) => {
  event.preventDefault()
  void task(async () => {
    read()
    if (!state.url || (!state.selection.trim() && !state.annotation.trim()))
      throw Error(
        'Zuerst eine Seite übernehmen und Text oder Anmerkung eingeben.',
      )
    if (state.version) {
      await send({
        type: 'UPDATE',
        id: state.id,
        input: {
          title: state.title,
          selection: state.selection,
          annotation: state.annotation,
          projectId: state.projectId,
          version: state.version,
        },
      })
    } else {
      await send({
        type: 'CREATE',
        input: {
          id: state.id,
          title: state.title,
          url: state.url,
          selection: state.selection,
          annotation: state.annotation,
          projectId: state.projectId,
        },
      })
    }
    state = {
      ...state,
      id: crypto.randomUUID(),
      version: null,
      selection: '',
      annotation: '',
    }
    dirty = false
    fields()
    await persist()
    message('In OMNIDESK gespeichert.')
    await load()
  })
})
for (const key of ['title', 'selection', 'annotation', 'project'])
  el(key).addEventListener('input', () => {
    dirty = true
    void persist()
  })
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.auth) {
    if (busy) authChanged = true
    else void task(status)
  }
})
void task(async () => {
  const window = await chrome.windows.getCurrent()
  draftKey = 'draft:' + window.id
  const saved = await chrome.storage.session.get(draftKey)
  if (saved[draftKey]) {
    state = saved[draftKey]
    dirty = Boolean(state.selection || state.annotation)
  }
  fields()
  await status()
})
