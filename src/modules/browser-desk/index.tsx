import { useState, type FormEvent } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { ExternalLink, PanelsTopLeft, RefreshCw, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useApiFetch } from '@/hooks/use-api'
import type {
  BrowserDevice,
  BrowserItem,
  BrowserProject,
} from '@/types/browser-desk'
import { browserSourceUrl } from '@/lib/browser-url'
import { useBrowserItems, useBrowserProjects } from './api'
import { BrowserPairing } from './Pairing'
import { PanelSettings } from './PanelSettings'
function Source({ url }: { url: string }) {
  let safe: string
  try {
    safe = browserSourceUrl(url)
  } catch {
    return <span>Quelle nicht verfügbar</span>
  }
  return (
    <a
      href={safe}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full items-start gap-2 break-all text-xs text-primary hover:underline"
    >
      <span>{safe}</span>
      <ExternalLink className="mt-1 size-3 shrink-0" />
    </a>
  )
}
function Editor({
  item,
  projects,
  onClose,
}: {
  item: BrowserItem | null
  projects: BrowserProject[]
  onClose: () => void
}) {
  const api = useApiFetch(),
    cache = useQueryClient(),
    [busy, setBusy] = useState(false),
    [id] = useState(() => item?.id ?? crypto.randomUUID())
  const [values, setValues] = useState({
    title: item?.title ?? '',
    url: item?.url ?? '',
    selection: item?.selection ?? '',
    annotation: item?.annotation ?? '',
    projectId: item?.projectId ?? '',
  })
  async function save(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const input = {
        title: values.title,
        selection: values.selection,
        annotation: values.annotation,
        projectId: values.projectId || null,
      }
      await api(`/api/browser/items${item ? '/' + item.id : ''}`, {
        method: item ? 'PUT' : 'POST',
        body: JSON.stringify(
          item
            ? { ...input, version: item.version }
            : { ...input, id, url: browserSourceUrl(values.url) },
        ),
      })
      onClose()
      await cache.invalidateQueries({ queryKey: ['browser-items'] })
      toast.success('Browser-Anmerkung gespeichert.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }
  const field = (
    key: 'title' | 'url' | 'selection' | 'annotation',
    label: string,
    rows?: number,
  ) => (
    <label className="grid gap-2 text-sm" key={key}>
      {label}
      {rows ? (
        <textarea
          aria-label={label}
          value={values[key]}
          onChange={(e) => setValues({ ...values, [key]: e.target.value })}
          rows={rows}
          maxLength={key === 'selection' ? 10000 : 20000}
          className="w-full min-w-0 rounded-md border border-border bg-background p-3"
        />
      ) : (
        <Input
          aria-label={label}
          type={key === 'url' ? 'url' : 'text'}
          readOnly={Boolean(item && key === 'url')}
          required
          maxLength={key === 'title' ? 300 : 2048}
          value={values[key]}
          onChange={(e) => setValues({ ...values, [key]: e.target.value })}
        />
      )}
    </label>
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {item ? 'Anmerkung bearbeiten' : 'Neue Browser-Anmerkung'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void save(e)} className="space-y-4">
          {field('title', 'Titel')}
          {field('url', 'Quellenadresse (HTTP/HTTPS)')}
          {field('selection', 'Ausgewählter Text', 4)}
          {field('annotation', 'Deine Anmerkung', 4)}
          <label className="grid gap-2 text-sm">
            Projekt
            <select
              aria-label="Projekt"
              value={values.projectId}
              onChange={(e) =>
                setValues({ ...values, projectId: e.target.value })
              }
              className="rounded-md border border-border bg-background p-2"
            >
              <option value="">Persönlich · ohne Projekt</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-muted-foreground">
            Speichert nur diese Angaben. Fragmente und erkannte
            Zugangs-/Trackingparameter werden aus der Quelle entfernt; die Seite
            wird vom Server nicht abgerufen.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} type="submit">
              Speichern
            </Button>
            <Button
              disabled={busy}
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Schließen
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
export default function BrowserDeskPage() {
  const { userId } = useAuth()
  return userId ? <Workspace key={userId} /> : null
}
function Workspace() {
  const [params, setParams] = useSearchParams(),
    projectId = params.get('project'),
    list = useBrowserItems(projectId),
    projects = useBrowserProjects(),
    api = useApiFetch(),
    cache = useQueryClient()
  const [search, setSearch] = useState(''),
    [editing, setEditing] = useState<BrowserItem | null | undefined>(undefined),
    [busy, setBusy] = useState(false)
  const { userId } = useAuth()
  const devices = useQuery({
    queryKey: ['browser-devices', userId],
    queryFn: () => api<BrowserDevice[]>('/api/browser/devices'),
    retry: false,
  })
  async function remove(item: BrowserItem) {
    if (!confirm('Diese Browser-Anmerkung löschen?')) return
    setBusy(true)
    try {
      await api('/api/browser/items/' + item.id, {
        method: 'DELETE',
        body: JSON.stringify({ version: item.version }),
      })
      await cache.invalidateQueries({ queryKey: ['browser-items'] })
      toast.success('Anmerkung gelöscht.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }
  async function revoke(id: string) {
    if (
      !confirm(
        'Diese Erweiterungsverbindung widerrufen? Die gespeicherten Anmerkungen bleiben erhalten.',
      )
    )
      return
    setBusy(true)
    try {
      await api('/api/browser/devices/' + id, { method: 'DELETE' })
      await devices.refetch()
      toast.success('Verbindung widerrufen.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Widerruf fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }
  const items = (list.data?.items ?? []).filter((i) =>
    `${i.title} ${i.url} ${i.selection} ${i.annotation}`
      .toLocaleLowerCase('de-DE')
      .includes(search.toLocaleLowerCase('de-DE')),
  )
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-semibold">
            <PanelsTopLeft className="size-7 text-primary" />
            Browser-Kommandoebene
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Bewusst gespeicherte Quellen, Textpassagen und Anmerkungen –
            persönlich oder im Projekt.
          </p>
        </div>
        <Button onClick={() => setEditing(null)}>Neue Anmerkung</Button>
      </header>
      <BrowserPairing />
      <PanelSettings />
      <Card>
        <CardHeader>
          <CardTitle>OMNIDESK in Google Chrome</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ein Seitenpanel neben deiner Webseite. Text markieren, Kontext
            übernehmen, prüfen und speichern. Keine Aufzeichnung deines
            Browserverlaufs und kein automatisches Lesen aller Webseiten. Chrome
            ab Version 116; aktuelle Edge-Versionen sind kompatibel.
          </p>
          <Button asChild>
            <a href="/downloads/omnidesk-browser.zip" download>
              <Download className="size-4" />
              Chrome-Erweiterung herunterladen
            </a>
          </Button>
          <details className="text-sm">
            <summary className="cursor-pointer text-primary">
              Erweiterung installieren und verbinden
            </summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
              <li>ZIP herunterladen und in einen festen Ordner entpacken.</li>
              <li>
                In Chrome <code>chrome://extensions</code> öffnen und den
                Entwicklermodus einschalten.
              </li>
              <li>
                „Entpackte Erweiterung laden“ wählen und den Ordner mit der
                Datei <code>manifest.json</code> auswählen.
              </li>
              <li>
                OMNIDESK-Symbol anheften, öffnen und „Mit OMNIDESK verbinden“
                wählen. Die Freigabe bestätigst du in dieser angemeldeten App.
              </li>
              <li>
                Auf einer Webseite Text markieren, das OMNIDESK-Symbol anklicken
                oder <kbd>Alt+Umschalt+O</kbd> drücken. Im Panel „Seitenkontext
                übernehmen“ wählen.
              </li>
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              Nach einem Update der App das ZIP erneut herunterladen, in
              denselben Ordner entpacken und auf <code>chrome://extensions</code>{' '}
              bei OMNIDESK „Neu laden“ wählen. Erst danach stehen neue
              Panel-Funktionen zur Verfügung.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Bei Seitenwechseln die neue Seite erneut über Symbol oder Shortcut
              freigeben. Interne Chrome-Seiten, der Web Store und manche
              PDF-/Frame-Inhalte sind gesperrt. Die Erweiterung wird lokal
              installiert; eine Veröffentlichung im Chrome Web Store ist dafür
              nicht nötig.
            </p>
          </details>
        </CardContent>
      </Card>
      {editing !== undefined && (
        <Editor
          key={editing?.id ?? 'new'}
          item={editing}
          projects={projects.data ?? []}
          onClose={() =>
            setEditing((current) => (current === editing ? undefined : current))
          }
        />
      )}
      <div className="flex flex-wrap gap-3">
        <Input
          aria-label="Browser-Anmerkungen durchsuchen"
          placeholder="In den geladenen Anmerkungen suchen…"
          className="max-w-lg"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Browser-Anmerkungen nach Projekt filtern"
          value={projectId ?? ''}
          onChange={(e) => {
            const next = new URLSearchParams(params)
            if (e.target.value) next.set('project', e.target.value)
            else next.delete('project')
            setParams(next)
          }}
          className="min-w-0 max-w-full rounded-md border border-border bg-background p-2 text-sm"
        >
          <option value="">Alle Projekte und persönliche Einträge</option>
          {projects.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          onClick={() => void list.refetch()}
          disabled={list.isFetching}
        >
          <RefreshCw className="size-4" />
          Aktualisieren
        </Button>
      </div>
      {projects.error && (
        <p role="alert" className="text-sm text-destructive">
          Projektliste: {projects.error.message}
        </p>
      )}
      {list.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Anmerkungen werden geladen…
        </p>
      )}
      {list.error && (
        <p role="alert" className="text-sm text-destructive">
          {list.error.message}
        </p>
      )}
      {list.data?.limited && (
        <p className="text-xs text-amber-400">
          Die Anzeige ist auf maximal 100 Einträge und eine begrenzte Datenmenge
          beschränkt. Projektfilter für einen kleineren Ausschnitt verwenden.
        </p>
      )}
      {!list.isPending && !list.error && !items.length && (
        <p className="rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">
          Noch keine passenden Browser-Anmerkungen. Speichere eine Auswahl über
          die Chrome-Erweiterung oder lege hier eine Anmerkung an.
        </p>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {items.map((item) => (
          <Card key={item.id} className="min-w-0">
            <CardHeader>
              <CardTitle className="break-words text-base">
                {item.title}
              </CardTitle>
              <Source url={item.url} />
            </CardHeader>
            <CardContent className="space-y-3">
              {item.selection && (
                <blockquote className="line-clamp-4 whitespace-pre-wrap border-l-2 border-primary/50 pl-3 text-sm text-muted-foreground">
                  {item.selection}
                </blockquote>
              )}
              {item.annotation && (
                <p className="line-clamp-5 whitespace-pre-wrap break-words text-sm">
                  {item.annotation}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {item.projectId ? (
                  <Link
                    className="text-primary hover:underline"
                    to={'/mission-control?project=' + item.projectId}
                  >
                    {item.projectName ?? 'Projekt'} →
                  </Link>
                ) : (
                  'Persönlich'
                )}{' '}
                ·{' '}
                {new Date(item.updatedAt).toLocaleString('de-DE', {
                  timeZone: 'Europe/Berlin',
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setEditing(item)}
                >
                  Bearbeiten
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void remove(item)}
                >
                  Löschen
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Verbundene Erweiterungen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Zugänge gelten jeweils 30 Tage. Widerrufen beendet den Zugriff, ohne
            gespeicherte Anmerkungen zu löschen.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void devices.refetch()}
          >
            Verbindungen aktualisieren
          </Button>
          {devices.error && (
            <p role="alert" className="text-sm text-destructive">
              {devices.error.message}
            </p>
          )}
          {devices.isPending ? (
            <p className="text-sm text-muted-foreground">
              Verbindungen werden geladen…
            </p>
          ) : !devices.data?.length && !devices.error ? (
            <p className="text-sm text-muted-foreground">
              Keine aktive Erweiterungsverbindung.
            </p>
          ) : (
            devices.data?.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div>
                  <p className="text-sm">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Erstellt {new Date(d.createdAt).toLocaleDateString('de-DE')}{' '}
                    · gültig bis{' '}
                    {new Date(d.expiresAt).toLocaleDateString('de-DE')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void revoke(d.id)}
                >
                  Zugang widerrufen
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
