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
  panel = null,
  commandFilter = '',
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
    await loadPanel()
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
  await loadPanel()
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
async function openTarget(url) {
  await chrome.tabs.create({ url })
}
async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    // Manche Chrome-Versionen verweigern die Zwischenablage im Seitenpanel.
    // Dann bleibt der Befehl sichtbar und kann von Hand kopiert werden.
    return false
  }
}
function renderQuickAccess() {
  const host = el('quick')
  host.replaceChildren()
  const entries = panel?.quickAccess ?? []
  if (!entries.length) {
    el('quick-state').textContent =
      'Noch keine Schnellzugriffe. In OMNIDESK unter Browser-Kommandoebene einrichten.'
    return
  }
  el('quick-state').textContent =
    entries.length + ' Schnellzugriffe aus deiner OMNIDESK-Einrichtung.'
  for (const entry of entries) {
    const button = document.createElement('button')
    button.className = entry.available ? 'secondary' : 'secondary unavailable'
    button.textContent = entry.label
    if (!entry.available) {
      // Nicht deaktivieren: Jede abgeschlossene Aktion gibt alle Schaltflächen
      // wieder frei. Stattdessen bleibt das Ziel sichtbar und erklärt sich.
      button.title = 'Ziel nicht mehr verfügbar. In OMNIDESK prüfen.'
      button.addEventListener('click', () =>
        message(
          'Dieses Ziel ist nicht mehr verfügbar. In OMNIDESK unter Browser-Kommandoebene prüfen.',
          true,
        ),
      )
    } else {
      button.title = entry.url
      button.addEventListener('click', () =>
        task(async () => {
          await openTarget(entry.url)
        }),
      )
    }
    host.append(button)
  }
}
function renderCommands() {
  const host = el('commands')
  host.replaceChildren()
  if (!panel?.showCommands) {
    el('commands-card').hidden = true
    return
  }
  el('commands-card').hidden = false
  const all = panel.commands ?? []
  const needle = commandFilter.trim().toLowerCase()
  const visible = needle
    ? all.filter((command) =>
        [command.title, command.command, command.category].some((value) =>
          String(value).toLowerCase().includes(needle),
        ),
      )
    : all
  el('commands-state').textContent = !all.length
    ? 'Keine Befehle in deiner Befehlsbibliothek.'
    : visible.length +
      ' von ' +
      all.length +
      ' Befehlen.' +
      (panel.commandsLimited
        ? ' Die Anzeige ist begrenzt; in OMNIDESK stehen weitere.'
        : '')
  for (const command of visible.slice(0, 50)) {
    const section = document.createElement('article')
    section.className = 'command'
    const heading = document.createElement('h3')
    heading.textContent = command.title
    const meta = document.createElement('p')
    meta.className = 'meta'
    meta.textContent = command.category
    const code = document.createElement('code')
    code.textContent = command.command
    const copy = document.createElement('button')
    copy.className = 'secondary'
    copy.textContent = 'Befehl kopieren'
    copy.addEventListener('click', () =>
      task(async () => {
        const done = await copyText(command.command)
        message(
          done
            ? 'Befehl in die Zwischenablage kopiert.'
            : 'Kopieren wurde vom Browser abgelehnt. Befehl von Hand markieren.',
          !done,
        )
      }),
    )
    section.append(heading, meta, code, copy)
    host.append(section)
  }
  if (visible.length > 50) {
    const note = document.createElement('p')
    note.className = 'hint'
    note.textContent =
      'Es werden 50 Treffer angezeigt. Suche eingrenzen, um weitere zu sehen.'
    host.append(note)
  }
}
async function loadPanel() {
  if (!connected) {
    panel = null
    el('quick-card').hidden = true
    el('commands-card').hidden = true
    return
  }
  el('quick-card').hidden = false
  el('quick-state').textContent = 'Schnellzugriffe werden geladen…'
  panel = await send({ type: 'PANEL' })
  renderQuickAccess()
  renderCommands()
}
el('panel-refresh').addEventListener('click', () => task(loadPanel))
el('command-search').addEventListener('input', () => {
  commandFilter = el('command-search').value
  renderCommands()
})
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
