const APP = 'https://omnidesk-v2-beta.vercel.app'
const el = (id) => document.getElementById(id)
const KIND_HINTS = {
  note: 'Die Notiz erscheint im Notizen-Modul. Eine übernommene Seite wird unter den Text gesetzt.',
  task: 'Die Aufgabe erscheint im Aufgaben-Modul, offen und mit mittlerer Priorität. Eine übernommene Seite wird in die Beschreibung gesetzt.',
  projectTask:
    'Die Projektaufgabe landet im Backlog des gewählten Projekts. Eine übernommene Seite wird unter den Text gesetzt.',
}
const emptyDraft = () => ({
  ownerDeviceId: null,
  id: crypto.randomUUID(),
  kind: 'note',
  title: '',
  text: '',
  projectId: '',
  source: null,
})
let deviceId = null,
  authChanged = false
let state = emptyDraft(),
  connected = false,
  busy = false,
  dirty = false,
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
  el('kind').value = state.kind
  el('title').value = state.title
  el('text').value = state.text
  el('project').value = state.projectId ?? ''
  el('kind-hint').textContent = KIND_HINTS[state.kind] ?? ''
  el('project-field').hidden = state.kind !== 'projectTask'
  if (state.source) {
    el('source').hidden = false
    el('source').textContent =
      (state.source.title ? state.source.title + ' · ' : '') + state.source.url
    el('source-state').textContent =
      'Seite übernommen. Sie wird automatisch unter deinen Text gesetzt.'
  } else {
    el('source').hidden = true
    el('source').textContent = ''
    el('source-state').textContent =
      'Noch keine Seite übernommen. Ohne Übernahme wird nur dein Text gespeichert.'
  }
}
function read() {
  state.kind = el('kind').value
  state.title = el('title').value
  state.text = el('text').value
  state.projectId = el('project').value || ''
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
    el('save').disabled = !connected
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
  // Kontowechsel: Ein Entwurf eines anderen Geräts darf nicht übernommen werden.
  if (connected && state.ownerDeviceId && state.ownerDeviceId !== deviceId) {
    state = emptyDraft()
    dirty = false
  }
  if (connected) state.ownerDeviceId = deviceId
  el('connection').textContent = connected
    ? 'Verbunden · gültig bis ' +
      new Date(value.expiresAt).toLocaleDateString('de-DE')
    : 'Nicht verbunden. Anmeldung und Freigabe erfolgen in deiner OMNIDESK-App.'
  el('connect').hidden = connected
  el('disconnect').hidden = !connected
  el('capture-card').hidden = !connected
  el('save').disabled = !connected
  if (!connected) {
    if (state.ownerDeviceId) {
      state = emptyDraft()
      dirty = false
    }
    fields()
    await loadPanel()
    return
  }
  const projects = await send({ type: 'PROJECTS' }),
    select = el('project')
  select.replaceChildren(new Option('Projekt wählen…', ''))
  for (const p of projects) select.add(new Option(p.name, p.id))
  if (state.projectId && !projects.some((p) => p.id === state.projectId)) {
    state.projectId = ''
    message(
      'Das vorherige Projekt ist nicht mehr zugänglich. Bitte neu auswählen.',
      true,
    )
  }
  fields()
  await loadPanel()
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
function showResult(result) {
  const host = el('result')
  host.replaceChildren()
  const text = document.createElement('span')
  const labels = {
    note: 'Notiz',
    task: 'Aufgabe',
    projectTask: 'Projektaufgabe',
  }
  text.textContent =
    (result.alreadyCaptured
      ? labels[result.kind] + ' war bereits gespeichert. '
      : labels[result.kind] + ' gespeichert. ') + ' '
  const link = document.createElement('button')
  link.className = 'secondary'
  link.textContent = 'In OMNIDESK öffnen'
  link.addEventListener('click', () =>
    task(async () => {
      await openTarget(APP + result.href)
    }),
  )
  host.append(text, link)
}
el('capture').addEventListener('click', () =>
  task(async () => {
    const page = await send({ type: 'CAPTURE' })
    state.source = { url: page.url, title: page.title }
    // Leere Felder sinnvoll vorbelegen, vorhandene Eingaben nie überschreiben.
    if (!state.title.trim()) state.title = page.title
    if (!state.text.trim() && page.selection) state.text = page.selection
    dirty = true
    fields()
    await persist()
    message('Seite übernommen. Titel und Text prüfen, dann speichern.')
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
    state = emptyDraft()
    dirty = false
    fields()
    await status()
    message(
      result.revoked
        ? 'Verbindung getrennt.'
        : 'Lokal getrennt. Server nicht erreichbar: Die Verbindung zusätzlich unter Browser-Kommandoebene in der App widerrufen.',
      !result.revoked,
    )
  }),
)
el('panel-refresh').addEventListener('click', () => task(loadPanel))
el('command-search').addEventListener('input', () => {
  commandFilter = el('command-search').value
  renderCommands()
})
el('new').addEventListener('click', () =>
  task(async () => {
    if (dirty && !confirm('Nicht gespeicherten Entwurf verwerfen?')) return
    const kind = state.kind
    state = { ...emptyDraft(), ownerDeviceId: deviceId, kind }
    dirty = false
    fields()
    el('result').replaceChildren()
    await persist()
    message('Eingaben geleert.')
  }),
)
el('kind').addEventListener('change', () => {
  state.kind = el('kind').value
  dirty = true
  fields()
  void persist()
})
el('editor').addEventListener('submit', (event) => {
  event.preventDefault()
  void task(async () => {
    read()
    if (!state.title.trim())
      throw Error('Ein Titel fehlt. Ohne Titel wird nichts gespeichert.')
    if (state.kind === 'projectTask' && !state.projectId)
      throw Error('Für eine Projektaufgabe fehlt das Projekt.')
    const result = await send({
      type: 'SAVE_CAPTURE',
      input: {
        id: state.id,
        kind: state.kind,
        title: state.title.trim(),
        text: state.text,
        source: state.source,
        projectId: state.kind === 'projectTask' ? state.projectId : null,
      },
    })
    // Neue Kennung: Die nächste Eingabe ist bewusst ein neuer Eintrag.
    const kind = state.kind,
      projectId = state.projectId
    state = { ...emptyDraft(), ownerDeviceId: deviceId, kind, projectId }
    dirty = false
    fields()
    await persist()
    message('In OMNIDESK gespeichert.')
    showResult(result)
  })
})
for (const key of ['title', 'text', 'project'])
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
    state = { ...emptyDraft(), ...saved[draftKey] }
    dirty = Boolean(state.title || state.text)
  }
  fields()
  await status()
})
