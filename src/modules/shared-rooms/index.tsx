import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useSearchParams } from 'react-router'
import {
  UsersRound,
  RefreshCw,
  Plus,
  ArrowLeft,
  Copy,
  LockKeyhole,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useApiFetch } from '@/hooks/use-api'
import {
  captureRoomInvitation,
  forgetRoomInvitation,
} from '@/lib/room-invitation'
import type {
  SharedRoom,
  RoomDetail,
  RoomSource,
  RoomItem,
} from '@/types/shared-rooms'

const base = '/api/shared-rooms'
const fieldClass =
  'w-full min-w-0 rounded-md border border-border bg-background p-3 text-sm'
const roleLabel = {
  owner: 'Raumleitung',
  reader: 'Lesen',
  editor: 'Bearbeiten',
}
const date = (value: string) =>
  new Date(value).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })
const localDate = (days: number) => {
  const d = new Date(Date.now() + days * 86400000)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
}
function Failure({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div
      role="alert"
      className="space-y-3 rounded-lg border border-destructive/30 p-4"
    >
      <p>{message}</p>
      <Button variant="outline" onClick={onRetry}>
        Neu laden
      </Button>
    </div>
  )
}
function CreateRoom({
  projectId,
  onDone,
  onCancel,
}: {
  projectId: string
  onDone: (id: string) => void
  onCancel: () => void
}) {
  const api = useApiFetch(),
    { userId } = useAuth()
  const source = useQuery({
    queryKey: ['room-source', userId, projectId],
    queryFn: () => api<RoomSource>(base + '/source/' + projectId),
    enabled: !!projectId,
    retry: false,
  })
  const [id] = useState(() => crypto.randomUUID()),
    [title, setTitle] = useState(''),
    [description, setDescription] = useState(''),
    [expires, setExpires] = useState(() => localDate(7)),
    [selected, setSelected] = useState<string[]>([]),
    [copyDescription, setCopyDescription] = useState(false),
    [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<{
    title: string
    description: string
    expiresAt: string
    initialItems: { kind: 'list'; text: string }[]
  } | null>(null)
  function review(e: FormEvent) {
    e.preventDefault()
    setPreview({
      title: title.trim(),
      description: [
        description.trim(),
        copyDescription ? source.data?.description : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
      expiresAt: new Date(expires).toISOString(),
      initialItems: (source.data?.tasks ?? [])
        .filter((t) => selected.includes(t.id))
        .map((t) => ({ kind: 'list', text: t.title })),
    })
  }
  async function save() {
    if (!preview || busy) return
    setBusy(true)
    try {
      const room = await api<{ id: string }>(base, {
        method: 'POST',
        body: JSON.stringify({ id, ...preview }),
      })
      onDone(room.id)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (preview)
    return (
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Freigabe prüfen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Genau diese Texte werden als unabhängige Kopien im Raum gespeichert.
            Eingeladene Personen erhalten keinen Projektzugriff. Spätere
            Änderungen am Original werden nicht übernommen.
          </p>
          <h3 className="break-words font-semibold">{preview.title}</h3>
          <p className="whitespace-pre-wrap break-words">
            {preview.description || 'Keine Beschreibung'}
          </p>
          <ul className="list-inside list-disc space-y-2 break-words">
            {preview.initialItems.map((i, n) => (
              <li key={n}>{i.text}</li>
            ))}
          </ul>
          <p className="text-sm">Ablauf: {date(preview.expiresAt)} (Berlin)</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void save()}>
              Raum mit diesen Inhalten erstellen
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setPreview(null)}
            >
              Zurück
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Neuer gemeinsamer Raum
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={review} className="space-y-4">
          <label className="grid gap-2 text-sm">
            Raumname
            <Input
              aria-label="Raumname"
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm">
            Geteilte Beschreibung
            <textarea
              aria-label="Geteilte Beschreibung"
              className={fieldClass}
              rows={3}
              maxLength={5000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm">
            Ablaufdatum (deine Ortszeit)
            <Input
              aria-label="Ablaufdatum"
              required
              type="datetime-local"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          </label>
          {projectId && (
            <section className="space-y-3 rounded-lg border p-4">
              <h3 className="font-medium">
                Bewusst aus dem Projekt übernehmen
              </h3>
              {source.isPending && <p>Projekt wird geladen …</p>}
              {source.isError && <p role="alert">{source.error.message}</p>}
              {source.data && !source.isError && (
                <>
                  <p className="break-words text-sm">
                    {source.data.name} · Die Auswahl ist zunächst leer.
                  </p>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={copyDescription}
                      onChange={(e) => setCopyDescription(e.target.checked)}
                    />
                    Projektbeschreibung kopieren
                  </label>
                  <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {source.data.description}
                  </p>
                  <div className="max-h-64 space-y-2 overflow-auto">
                    {source.data.tasks.map((t) => (
                      <label
                        key={t.id}
                        className="flex items-start gap-2 break-words text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(t.id)}
                          onChange={(e) =>
                            setSelected((s) =>
                              e.target.checked
                                ? [...s, t.id]
                                : s.filter((id) => id !== t.id),
                            )
                          }
                        />
                        <span className="min-w-0">{t.title}</span>
                      </label>
                    ))}
                  </div>
                  {source.data.limited && (
                    <p className="text-sm text-muted-foreground">
                      Auswahl auf 100 Projektaufgaben begrenzt.
                    </p>
                  )}
                </>
              )}
            </section>
          )}
          <p className="text-sm text-muted-foreground">
            Nach Ablauf oder Schließen verlieren Teilnehmer den Zugriff. Die
            Raumleitung behält die Inhalte, bis sie den Raum endgültig löscht.
            Dateien und private Modulbereiche werden nicht geteilt.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Inhalte prüfen</Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Abbrechen
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
function Invitation({
  token,
  onJoined,
  onDismiss,
}: {
  token: string
  onJoined: (id: string) => void
  onDismiss: () => void
}) {
  const api = useApiFetch(),
    { userId } = useAuth(),
    [name, setName] = useState(''),
    [busy, setBusy] = useState(false)
  const query = useQuery({
    queryKey: ['room-invitation', userId, token],
    queryFn: () =>
      api<{ title: string; role: 'reader' | 'editor'; expiresAt: string }>(
        base + '/invitation/preview',
        { method: 'POST', body: JSON.stringify({ token }) },
      ),
    retry: false,
  })
  async function join(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const result = await api<{ id: string }>(base + '/invitation/join', {
        method: 'POST',
        body: JSON.stringify({ token, name }),
      })
      forgetRoomInvitation()
      onJoined(result.id)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Einladung zu einem gemeinsamen Raum
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isPending && <p>Einladung wird geprüft …</p>}
        {query.isError && <p role="alert">{query.error.message}</p>}
        {query.data && !query.isError && (
          <form className="space-y-4" onSubmit={join}>
            <h3 className="break-words font-semibold">{query.data.title}</h3>
            <p>
              Deine Berechtigung: {roleLabel[query.data.role]} · Einladung
              gültig bis {date(query.data.expiresAt)} (Berlin)
            </p>
            <label className="grid gap-2 text-sm">
              Dein Anzeigename im Raum
              <Input
                aria-label="Dein Anzeigename im Raum"
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <p className="text-sm text-muted-foreground">
              Der selbst gewählte Name wird der Raumleitung gezeigt und ist kein
              Identitätsnachweis. Dein privater OMNIDESK-Bereich wird nicht
              geteilt.
            </p>
            <Button disabled={busy}>Einladung annehmen</Button>
          </form>
        )}
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            forgetRoomInvitation()
            onDismiss()
          }}
        >
          Einladung verwerfen
        </Button>
      </CardContent>
    </Card>
  )
}
function RoomView({ id, onBack }: { id: string; onBack: () => void }) {
  const api = useApiFetch(),
    { userId } = useAuth(),
    cache = useQueryClient()
  const query = useQuery({
    queryKey: ['room-detail', userId, id],
    queryFn: () => api<RoomDetail>(base + '/' + id),
    retry: false,
    refetchInterval: 15000,
    refetchOnWindowFocus: 'always',
  })
  const [busy, setBusy] = useState(false),
    [kind, setKind] = useState<'list' | 'pin'>('list'),
    [text, setText] = useState(''),
    [draftId, setDraftId] = useState(() => crypto.randomUUID())
  const [edit, setEdit] = useState<RoomItem | null>(null),
    [inviteRole, setInviteRole] = useState<'reader' | 'editor'>('reader'),
    [inviteExpiry, setInviteExpiry] = useState(() => localDate(1)),
    [link, setLink] = useState('')
  async function action(
    path: string,
    method: string,
    body?: unknown,
    after?: () => void,
  ) {
    if (busy) return
    setBusy(true)
    try {
      await api(base + '/' + id + path, {
        method,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      after?.()
      await cache.invalidateQueries({ queryKey: ['room-detail', userId, id] })
      await cache.invalidateQueries({ queryKey: ['shared-rooms', userId] })
    } catch (e) {
      toast.error((e as Error).message)
      await query.refetch()
    } finally {
      setBusy(false)
    }
  }
  if (query.isPending) return <p>Raum wird geladen …</p>
  if (query.isError || !query.data)
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft />
          Alle Räume
        </Button>
        <Failure
          message={query.error?.message ?? 'Raum nicht verfügbar.'}
          onRetry={() => void query.refetch()}
        />
      </div>
    )
  const { room, items, members, invites } = query.data,
    owner = room.role === 'owner',
    active = room.active && Date.parse(room.expiresAt) > Date.now(),
    canEdit = active && room.role !== 'reader'
  async function invite() {
    if (busy) return
    setBusy(true)
    try {
      const result = await api<{ token: string }>(
        base + '/' + id + '/invites',
        {
          method: 'POST',
          body: JSON.stringify({
            role: inviteRole,
            expiresAt: new Date(inviteExpiry).toISOString(),
          }),
        },
      )
      setLink(window.location.origin + '/shared-rooms#invite=' + result.token)
      await query.refetch()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Einladungslink kopiert.')
    } catch {
      toast.error('Bitte den angezeigten Link manuell kopieren.')
    }
  }
  function saveItem(e: FormEvent) {
    e.preventDefault()
    const current = edit
    void action(
      '/items' + (current ? '/' + current.id : ''),
      current ? 'PUT' : 'POST',
      current
        ? { text, done: current.done, version: current.version }
        : { id: draftId, kind, text },
      () => {
        setEdit(null)
        setText('')
        setDraftId(crypto.randomUUID())
      },
    )
  }
  const cancelEdit = () => {
    setEdit(null)
    setText('')
    setDraftId(crypto.randomUUID())
  }
  return (
    <div className="space-y-5">
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft />
        Alle Räume
      </Button>
      <Card className="border-primary/30">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle
              role="heading"
              aria-level={2}
              className="min-w-0 break-words text-xl"
            >
              {room.title}
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              {roleLabel[room.role]} ·{' '}
              {active ? 'Offen' : room.closed ? 'Geschlossen' : 'Abgelaufen'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Ablauf: {date(room.expiresAt)} (Berlin)
          </p>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap break-words">
            {room.description || 'Keine Beschreibung'}
          </p>
          {!active && (
            <p className="mt-4 text-sm text-muted-foreground">
              Nur noch für dich als Raumleitung sichtbar. Teilnehmer haben
              keinen Zugriff mehr.
            </p>
          )}
        </CardContent>
      </Card>
      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        {(['list', 'pin'] as const).map((type) => (
          <Card key={type} className="min-w-0">
            <CardHeader>
              <CardTitle role="heading" aria-level={2}>
                {type === 'list' ? 'Gemeinsame Liste' : 'Pinnwand'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items
                .filter((i) => i.kind === type)
                .map((item) => (
                  <div
                    key={item.id}
                    className="space-y-3 rounded-lg border p-3"
                  >
                    <div className="flex items-start gap-3">
                      {type === 'list' && (
                        <input
                          aria-label={'Erledigt: ' + item.text}
                          type="checkbox"
                          className="mt-1"
                          checked={item.done}
                          disabled={!canEdit || busy}
                          onChange={(e) =>
                            void action('/items/' + item.id, 'PUT', {
                              text: item.text,
                              done: e.target.checked,
                              version: item.version,
                            })
                          }
                        />
                      )}
                      <p
                        className={
                          'min-w-0 whitespace-pre-wrap break-words text-sm ' +
                          (item.done
                            ? 'text-muted-foreground line-through'
                            : '')
                        }
                      >
                        {item.text}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            setEdit(item)
                            setText(item.text)
                            setKind(item.kind)
                          }}
                        >
                          Bearbeiten
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                'Diesen geteilten Eintrag löschen?',
                              )
                            )
                              void action('/items/' + item.id, 'DELETE', {
                                version: item.version,
                              })
                          }}
                        >
                          Löschen
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              {!items.some((i) => i.kind === type) && (
                <p className="text-sm text-muted-foreground">
                  Noch keine Einträge.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              {edit ? 'Eintrag bearbeiten' : 'Inhalt hinzufügen'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveItem} className="space-y-3">
              {!edit && (
                <label className="grid gap-2 text-sm">
                  Bereich
                  <select
                    aria-label="Bereich"
                    className={fieldClass}
                    value={kind}
                    onChange={(e) => setKind(e.target.value as 'list' | 'pin')}
                  >
                    <option value="list">Gemeinsame Liste</option>
                    <option value="pin">Pinnwand</option>
                  </select>
                </label>
              )}
              <label className="grid gap-2 text-sm">
                Geteilter Text
                <textarea
                  aria-label="Geteilter Text"
                  className={fieldClass}
                  required
                  maxLength={5000}
                  rows={3}
                  value={text}
                  disabled={busy}
                  onChange={(e) => {
                    setText(e.target.value)
                    if (!edit) setDraftId(crypto.randomUUID())
                  }}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy}>
                  {edit ? 'Änderung speichern' : 'Im Raum speichern'}
                </Button>
                {edit && (
                  <Button
                    type="button"
                    disabled={busy}
                    variant="outline"
                    onClick={cancelEdit}
                  >
                    Abbrechen
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Maximal 200 Einträge pro Raum. Inhalte sind für alle Teilnehmer
                sichtbar.
              </p>
            </form>
          </CardContent>
        </Card>
      )}
      {owner && (
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              Einladungen und Teilnehmer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {active && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm">
                    Berechtigung
                    <select
                      className={fieldClass}
                      aria-label="Berechtigung"
                      value={inviteRole}
                      onChange={(e) =>
                        setInviteRole(e.target.value as 'reader' | 'editor')
                      }
                    >
                      <option value="reader">Lesen</option>
                      <option value="editor">Bearbeiten</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm">
                    Einladung gültig bis
                    <Input
                      aria-label="Einladung gültig bis"
                      type="datetime-local"
                      value={inviteExpiry}
                      onChange={(e) => setInviteExpiry(e.target.value)}
                    />
                  </label>
                </div>
                <Button disabled={busy} onClick={() => void invite()}>
                  Einladungslink erstellen
                </Button>
                <p className="text-xs text-muted-foreground">
                  Einmalig einlösbar, Anmeldung erforderlich. Bis zur Einlösung
                  kann jeder mit dem Link beitreten. Nur an die gewünschte
                  Person weitergeben. Gültigkeit endet spätestens mit dem Raum.
                </p>
              </div>
            )}
            {link && active && (
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm">
                  Nur jetzt verfügbar. Link an die gewünschte Person
                  weitergeben:
                </p>
                <Input
                  aria-label="Neuer Einladungslink"
                  readOnly
                  value={link}
                />
                <Button variant="outline" onClick={() => void copy()}>
                  <Copy />
                  Link kopieren
                </Button>
                <Button variant="ghost" onClick={() => setLink('')}>
                  Ausblenden
                </Button>
              </div>
            )}
            <div className="space-y-3">
              <h3 className="font-medium">Offene Einladungen</h3>
              {invites.map((v) => (
                <div
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  key={v.id}
                >
                  <span className="text-sm">
                    {roleLabel[v.role]} · bis {date(v.expiresAt)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void action('/invites/' + v.id, 'DELETE', undefined, () =>
                        setLink(''),
                      )
                    }
                  >
                    Link widerrufen
                  </Button>
                </div>
              ))}
              {!invites.length && (
                <p className="text-sm text-muted-foreground">
                  Keine offenen Einladungen.
                </p>
              )}
            </div>
            <div className="space-y-3">
              <h3 className="font-medium">Teilnehmer · {members.length}/50</h3>
              <p className="text-xs text-muted-foreground">
                Selbst gewählte Anzeigenamen sind keine geprüfte Identität. Als
                Raumleitung kannst du Rechte ändern und Zugänge entziehen.
              </p>
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
                >
                  <span className="min-w-0 flex-1 break-words text-sm">
                    {m.name}
                  </span>
                  <select
                    aria-label={'Rolle für ' + m.name}
                    className="rounded border bg-background p-2 text-sm"
                    disabled={busy || !active}
                    value={m.role}
                    onChange={(e) =>
                      void action('/members/' + m.id, 'PUT', {
                        role: e.target.value,
                        revoked: false,
                        version: m.version,
                      })
                    }
                  >
                    <option value="reader">Lesen</option>
                    <option value="editor">Bearbeiten</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm('Zugang für ' + m.name + ' entziehen?')
                      )
                        void action('/members/' + m.id, 'PUT', {
                          role: m.role,
                          revoked: true,
                          version: m.version,
                        })
                    }}
                  >
                    Zugang entziehen
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <div className="flex flex-wrap gap-3">
        {owner ? (
          <>
            {active && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      'Raum unwiderruflich schließen? Teilnehmer verlieren den Zugriff. Deine Nachsicht bleibt erhalten.',
                    )
                  )
                    void action(
                      '/close',
                      'POST',
                      { version: room.version },
                      () => setLink(''),
                    )
                }}
              >
                Raum schließen
              </Button>
            )}
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    'Diesen Raum einschließlich aller geteilten Inhalte, Einladungen und Mitgliedschaften endgültig löschen? Private Originale bleiben erhalten.',
                  )
                )
                  void action('', 'DELETE', { version: room.version }, onBack)
              }}
            >
              Raum endgültig löschen
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  'Raum verlassen? Für einen erneuten Beitritt brauchst du eine neue Einladung.',
                )
              )
                void action('/leave', 'POST', undefined, onBack)
            }}
          >
            Raum verlassen
          </Button>
        )}
      </div>
    </div>
  )
}
function Rooms({ userId }: { userId: string }) {
  const location = useLocation()
  useEffect(() => {
    if (new URLSearchParams(location.hash.slice(1)).has('invite')) {
      setToken(captureRoomInvitation())
    }
  }, [location.hash])
  const api = useApiFetch(),
    cache = useQueryClient(),
    [params, setParams] = useSearchParams(),
    [token, setToken] = useState(captureRoomInvitation),
    [creating, setCreating] = useState(params.has('fromProject'))
  const list = useQuery({
    queryKey: ['shared-rooms', userId],
    queryFn: () => api<SharedRoom[]>(base),
    retry: false,
    refetchInterval: 15000,
  })
  const roomId = params.get('room') || '',
    projectId = params.get('fromProject') || ''
  const open = (id: string) => {
    setCreating(false)
    setParams({ room: id })
    void cache.invalidateQueries({ queryKey: ['shared-rooms', userId] })
  }
  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold">
            <UsersRound className="shrink-0 text-primary" />
            Gemeinsame Räume
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ein klar begrenzter Platz für Übergaben, Pläne und Zusammenarbeit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label="Räume aktualisieren"
            onClick={() => {
              void list.refetch()
              void cache.invalidateQueries({
                queryKey: ['room-detail', userId],
              })
            }}
          >
            <RefreshCw className="size-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setParams({})
              setCreating(true)
            }}
          >
            <Plus />
            Neuer Raum
          </Button>
        </div>
      </div>
      {token && (
        <Invitation
          token={token}
          onJoined={(id) => {
            setToken('')
            open(id)
          }}
          onDismiss={() => setToken('')}
        />
      )}
      {roomId ? (
        <RoomView key={roomId} id={roomId} onBack={() => setParams({})} />
      ) : creating ? (
        <CreateRoom
          key={projectId}
          projectId={projectId}
          onDone={open}
          onCancel={() => {
            setCreating(false)
            setParams({})
          }}
        />
      ) : (
        <>
          <div className="flex items-start gap-3 rounded-lg border p-4 text-sm text-muted-foreground">
            <LockKeyhole className="mt-0.5 size-4 shrink-0" />
            <p>
              Nur ausdrücklich geteilte Rauminhalte sind sichtbar. Dein privater
              OMNIDESK-Bereich bleibt privat. Neue Räume teilen zunächst nichts;
              Personen kommen ausschließlich über deine Einladung hinzu.
            </p>
          </div>
          {list.isPending && <p>Räume werden geladen …</p>}
          {list.isError && (
            <Failure
              message={list.error.message}
              onRetry={() => void list.refetch()}
            />
          )}
          {!list.isError && list.data && (
            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              {list.data.map((room) => (
                <button
                  key={room.id}
                  onClick={() => open(room.id)}
                  className="min-w-0 rounded-xl border bg-card p-5 text-left transition hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <UsersRound className="size-4" />
                    {roleLabel[room.role]} ·{' '}
                    {room.active
                      ? 'Offen'
                      : room.closed
                        ? 'Geschlossen'
                        : 'Abgelaufen'}
                  </div>
                  <h2 className="break-words font-semibold">{room.title}</h2>
                  <p className="mt-2 line-clamp-2 break-words text-sm text-muted-foreground">
                    {room.description || 'Keine Beschreibung'}
                  </p>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Bis {date(room.expiresAt)} (Berlin)
                  </p>
                </button>
              ))}
              {!list.data.length && (
                <p className="py-8 text-muted-foreground">
                  Noch keine Räume. Erstelle einen Raum oder öffne einen
                  erhaltenen Einladungslink.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
export default function SharedRoomsPage() {
  const { userId } = useAuth()
  return userId ? <Rooms key={userId} userId={userId} /> : null
}
