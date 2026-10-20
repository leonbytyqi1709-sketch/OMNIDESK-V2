import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Link } from 'react-router'
import {
  Radar,
  RefreshCw,
  Plus,
  Bookmark,
  ExternalLink,
  Brain,
  Sparkles,
  Trash2,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useProjects } from '@/modules/projects/api'
import { useRadar } from './api'
import type { RadarCategory, RadarTopic } from '@/types/radar'
const categoryNames: Record<RadarCategory, string> = {
  news: 'Neuigkeit',
  security: 'Sicherheitsmeldung',
  release: 'Release',
  status: 'Statusmeldung',
}
const presets = [
  {
    name: 'React Releases',
    url: 'https://github.com/facebook/react/releases.atom',
    category: 'release',
  },
  {
    name: 'Next.js Releases',
    url: 'https://github.com/vercel/next.js/releases.atom',
    category: 'release',
  },
  { name: 'GitHub Blog', url: 'https://github.blog/feed/', category: 'news' },
  {
    name: 'OpenAI News',
    url: 'https://openai.com/news/rss.xml',
    category: 'news',
  },
] as const
export default function RadarPage() {
  const { userId } = useAuth()
  return userId ? <RadarWorkspace key={userId} /> : null
}
function RadarWorkspace() {
  const { userId } = useAuth()
  const [view, setView] = useState('all')
  const { data, action } = useRadar(view === 'saved'),
    projects = useProjects(),
    overview = data.data
  const [search, setSearch] = useState(''),
    [topicFilter, setTopicFilter] = useState('all'),
    [matchesOnly, setMatchesOnly] = useState(false),
    [auto, setAuto] = useState(
      () => localStorage.getItem(`omnidesk:radar-auto:${userId}`) !== 'off',
    )
  const [editor, setEditor] = useState<{
      id?: string
      version?: number
      name: string
      keywords: string
      projectId: string
      enabled: boolean
    } | null>(null),
    [source, setSource] = useState({
      topicId: '',
      name: '',
      url: '',
      category: 'news' as RadarCategory,
    }),
    [showSource, setShowSource] = useState(false)
  const attempted = useRef(new Set<string>())
  const due = overview?.sources.filter((s) => s.due) ?? []
  const lastSchedulerAt = overview?.sources
    .map((s) => s.lastSchedulerAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)
  const { mutate: mutateRadar, isPending: radarBusy } = action
  useEffect(() => {
    if (!auto || radarBusy || !overview) return
    const next = overview.sources
      .filter(
        (s) => s.due && !attempted.current.has(s.id + ':' + s.lastAttempt),
      )
      .slice(0, 3)
    if (!next.length) return
    next.forEach((s) => attempted.current.add(s.id + ':' + s.lastAttempt))
    mutateRadar({
      path: '/refresh',
      body: { sourceIds: next.map((s) => s.id) },
    })
  }, [overview, auto, radarBusy, mutateRadar])
  const startEdit = (topic: RadarTopic) =>
    setEditor({
      id: topic.id,
      version: topic.version,
      name: topic.name,
      enabled: topic.enabled,
      keywords: topic.keywords.join(', '),
      projectId: topic.projectId ?? '',
    })
  const filtered =
    overview?.items.filter(
      (i) =>
        (topicFilter === 'all' || i.topicId === topicFilter) &&
        (view !== 'saved' || i.saved) &&
        (view !== 'unread' || !i.read) &&
        (!matchesOnly || i.matches.length > 0) &&
        `${i.title} ${i.excerpt}`
          .toLocaleLowerCase('de')
          .includes(search.toLocaleLowerCase('de')),
    ) ?? []
  // Same canonical article from several chosen feeds is presented once, while its source records remain visible.
  const groups = new Map<string, typeof filtered>()
  for (const item of filtered)
    groups.set(item.url, [...(groups.get(item.url) ?? []), item])
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold">
            <Radar className="size-7 text-primary" />
            Dein Internet-Radar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gewählte Quellen, neue Meldungen und nachvollziehbare Relevanz.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={!due.length || action.isPending}
          onClick={() =>
            action.mutate({
              path: '/refresh',
              body: { sourceIds: due.slice(0, 3).map((s) => s.id) },
            })
          }
        >
          <RefreshCw
            className={`mr-2 size-4 ${action.isPending ? 'animate-spin' : ''}`}
          />
          Quellen prüfen
        </Button>
      </header>
      <div className="flex flex-wrap gap-3 text-xs">
        <Badge variant="outline">{overview?.topics.length ?? 0} Themen</Badge>
        <Badge variant="outline">{overview?.sources.length ?? 0} Quellen</Badge>
        <Badge variant="outline">
          {overview?.items.filter((i) => !i.read).length ?? 0} ungelesene
          Einträge im Ausschnitt
        </Badge>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => {
              setAuto(e.target.checked)
              localStorage.setItem(
                `omnidesk:radar-auto:${userId}`,
                e.target.checked ? 'on' : 'off',
              )
            }}
          />
          Fällige Quellen beim Öffnen automatisch abrufen
        </label>
      </div>
      {data.error && (
        <p role="alert" className="text-sm text-destructive">
          {data.error.message}
        </p>
      )}
      {action.error && (
        <p role="alert" className="text-sm text-destructive">
          {action.error.message}
        </p>
      )}
      {data.isLoading && (
        <p className="text-sm text-muted-foreground">Radar wird geladen…</p>
      )}
      {!!overview?.sources.some((source) => source.error) && (
        <div role="alert" className="space-y-2 rounded-xl border border-amber-400/40 bg-amber-400/5 p-4 text-sm">
          <p className="font-medium text-amber-400">Nicht alle Quellen konnten geladen werden</p>
          {overview.sources.filter((source) => source.error).map((source) => (
            <p key={source.id} className="break-words">
              <strong>{source.name}:</strong> {source.error}
            </p>
          ))}
          <p className="text-xs text-muted-foreground">
            Details stehen unter „Themen & Quellen einrichten“. Zwischen Abrufen liegen mindestens 15 Minuten. Bereits geladene Meldungen bleiben erhalten.
          </p>
        </div>
      )}
      <details
        className="rounded-xl border border-border bg-card p-4"
        open={!overview?.sources.length}
      >
        <summary className="cursor-pointer font-semibold">
          Themen &amp; Quellen einrichten
        </summary>
        <div className="mt-4 space-y-5">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() =>
                setEditor({
                  name: '',
                  keywords: '',
                  projectId: '',
                  enabled: true,
                })
              }
            >
              <Plus className="mr-1.5 size-4" />
              Thema hinzufügen
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!overview?.topics.length}
              onClick={() => {
                setSource({ ...source, topicId: overview?.topics[0]?.id ?? '' })
                setShowSource(true)
              }}
            >
              Quelle hinzufügen
            </Button>
          </div>
          {editor && (
            <form
              className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                const { keywords, projectId, id, version, ...fields } = editor
                action.mutate(
                  {
                    path: id ? `/topics/${id}` : '/topics',
                    method: id ? 'PUT' : 'POST',
                    body: {
                      ...fields,
                      keywords: keywords
                        .split(',')
                        .map((v) => v.trim())
                        .filter(Boolean),
                      projectId: projectId || null,
                      ...(id ? { version } : {}),
                    },
                  },
                  { onSuccess: () => setEditor(null) },
                )
              }}
            >
              <label className="space-y-1 text-xs">
                Themenname
                <Input
                  required
                  maxLength={120}
                  value={editor.name}
                  onChange={(e) =>
                    setEditor({ ...editor, name: e.target.value })
                  }
                />
              </label>
              <label className="space-y-1 text-xs">
                Suchbegriffe, mit Komma getrennt
                <Input
                  required
                  value={editor.keywords}
                  onChange={(e) =>
                    setEditor({ ...editor, keywords: e.target.value })
                  }
                  placeholder="React, Next.js, Vercel"
                />
              </label>
              <label className="space-y-1 text-xs">
                Projektzuordnung
                <select
                  className="w-full rounded-md border border-border bg-background p-2"
                  value={editor.projectId}
                  onChange={(e) =>
                    setEditor({ ...editor, projectId: e.target.value })
                  }
                >
                  <option value="">Persönliches Thema</option>
                  {editor.projectId &&
                    !projects.data?.some((p) => p.id === editor.projectId) && (
                      <option value={editor.projectId}>
                        Bisheriges Projekt nicht verfügbar
                      </option>
                    )}
                  {projects.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={editor.enabled}
                  onChange={(e) =>
                    setEditor({ ...editor, enabled: e.target.checked })
                  }
                />
                Thema aktiv überwachen
              </label>
              <div className="flex gap-2">
                <Button size="sm" disabled={action.isPending}>
                  Thema speichern
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditor(null)}
                >
                  Verwerfen
                </Button>
              </div>
            </form>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {overview?.topics.map((t) => (
              <section
                key={t.id}
                className="min-w-0 space-y-2 rounded-lg border border-border p-3"
              >
                <p className="break-words text-sm font-semibold">
                  {t.name} {!t.enabled && '· pausiert'}
                </p>
                <p className="break-words text-xs text-muted-foreground">
                  {t.keywords.join(' · ')}
                </p>
                {t.projectMissing ? (
                  <p className="text-xs text-amber-400">
                    Projekt entfernt; Abruf pausiert bis zur Neuzuordnung.
                  </p>
                ) : t.projectId ? (
                  <Link
                    to={`/projects?project=${t.projectId}`}
                    className="text-xs underline"
                  >
                    {t.projectName}
                  </Link>
                ) : (
                  <p className="text-xs text-muted-foreground">Persönlich</p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startEdit(t)}
                  >
                    <Pencil className="mr-1 size-3" />
                    Bearbeiten
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={action.isPending}
                    onClick={() => {
                      if (
                        confirm(
                          'Thema, seine Quellen und Radar-Funde löschen? Bereits ins Gedächtnis übernommene Kopien bleiben erhalten.',
                        )
                      )
                        action.mutate({
                          path: `/topics/${t.id}`,
                          method: 'DELETE',
                          body: { version: t.version },
                        })
                    }}
                  >
                    <Trash2 className="mr-1 size-3" />
                    Entfernen
                  </Button>
                </div>
              </section>
            ))}
          </div>
          {showSource && (
            <form
              className="space-y-3 rounded-lg border border-border p-4"
              onSubmit={(e) => {
                e.preventDefault()
                action.mutate(
                  { path: '/sources', body: source },
                  { onSuccess: () => setShowSource(false) },
                )
              }}
            >
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                  <Button
                    key={p.name}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSource({ ...source, ...p })}
                  >
                    {p.name}
                  </Button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs">
                  Thema
                  <select
                    className="w-full rounded-md border border-border bg-background p-2"
                    required
                    value={source.topicId}
                    onChange={(e) =>
                      setSource({ ...source, topicId: e.target.value })
                    }
                  >
                    {overview?.topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs">
                  Name
                  <Input
                    required
                    value={source.name}
                    maxLength={120}
                    onChange={(e) =>
                      setSource({ ...source, name: e.target.value })
                    }
                  />
                </label>
                <label className="space-y-1 text-xs sm:col-span-2">
                  Öffentliche RSS-/Atom-Feed-Adresse
                  <Input
                    type="url"
                    required
                    maxLength={2048}
                    value={source.url}
                    onChange={(e) =>
                      setSource({ ...source, url: e.target.value })
                    }
                    placeholder="https://github.com/owner/repo/releases.atom"
                  />
                </label>
                <label className="space-y-1 text-xs">
                  Quellenkategorie
                  <select
                    className="w-full rounded-md border border-border bg-background p-2"
                    value={source.category}
                    onChange={(e) =>
                      setSource({
                        ...source,
                        category: e.target.value as RadarCategory,
                      })
                    }
                  >
                    {Object.entries(categoryNames).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Feed-Adresse verwenden, keine normale HTML-Seite und keine
                privaten Feed-URLs mit Zugangstokens. Die Kategorie beschreibt
                die Quelle, keine nachgewiesene Sicherheitsbetroffenheit.
              </p>
              <div className="flex gap-2">
                <Button size="sm" disabled={action.isPending}>
                  Quelle speichern
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowSource(false)}
                >
                  Verwerfen
                </Button>
              </div>
            </form>
          )}
          <ul className="space-y-3">
            {overview?.sources.map((s) => (
              <li
                key={s.id}
                className="min-w-0 space-y-2 rounded-lg border border-border p-3"
              >
                <p className="break-words text-sm font-medium">
                  {s.name} · {categoryNames[s.category]}{' '}
                  {!s.enabled && '· pausiert'}
                </p>
                <p className="break-all text-xs text-muted-foreground">
                  {s.url}
                </p>
                <p className="text-xs text-muted-foreground">
                  Letzter erfolgreicher Abruf:{' '}
                  {s.lastSuccess
                    ? new Date(s.lastSuccess).toLocaleString('de-DE')
                    : 'Noch keiner'}{' '}
                  · Mindestabstand 15 Minuten
                </p>
                {s.error && (
                  <p className="text-xs text-amber-400">
                    {s.error} Frühere Funde bleiben erhalten.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({
                        path: `/sources/${s.id}`,
                        method: 'PUT',
                        body: { version: s.version, enabled: !s.enabled },
                      })
                    }
                  >
                    {s.enabled ? 'Pausieren' : 'Aktivieren'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={action.isPending}
                    onClick={() => {
                      if (
                        confirm(
                          'Quelle und ihre Radar-Funde entfernen? Gedächtniskopien bleiben erhalten.',
                        )
                      )
                        action.mutate({
                          path: `/sources/${s.id}`,
                          method: 'DELETE',
                          body: { version: s.version },
                        })
                    }}
                  >
                    Entfernen
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </details>
      <div className="flex flex-wrap gap-3">
        <Input
          aria-label="Radar durchsuchen"
          className="min-w-0 flex-1 basis-60"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Titel und Feed-Auszüge durchsuchen…"
        />
        <select
          aria-label="Themenfilter"
          className="max-w-full rounded-md border border-border bg-background p-2 text-sm"
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value)}
        >
          <option value="all">Alle Themen</option>
          {overview?.topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Lesefilter"
          className="rounded-md border border-border bg-background p-2 text-sm"
          value={view}
          onChange={(e) => setView(e.target.value)}
        >
          <option value="all">Alle Meldungen</option>
          <option value="unread">Ungelesen</option>
          <option value="saved">Merkliste</option>
        </select>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={matchesOnly}
            onChange={(e) => setMatchesOnly(e.target.checked)}
          />
          Nur Suchbegriff-Treffer
        </label>
      </div>
      {overview?.limited && (
        <p className="text-xs text-amber-400">
          Gezeigt wird ein Ausschnitt der 400 zuletzt gefundenen Einträge. Suche
          und Zähler beziehen sich auf diesen Ausschnitt.
        </p>
      )}
      {overview && !groups.size && (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {!overview.sources.length
            ? 'Dein Radar braucht eine Nachrichtenquelle: Lege oben ein Thema an und füge anschließend eine RSS-/Atom-Quelle hinzu. Ein Thema allein startet noch keine Internetsuche.'
            : action.isPending
              ? 'Die Quellen werden gerade geprüft. Neue Meldungen erscheinen nach Abschluss des Abrufs.'
              : overview.sources.some((source) => source.error)
                ? 'Beim Quellenabruf gab es Fehler. Die betroffenen Quellen und ihre Fehlermeldungen stehen oben.'
                : search || topicFilter !== 'all' || view !== 'all' || matchesOnly
                  ? 'Keine Meldungen für diese Filter. Wähle „Alle Themen“ und „Alle Meldungen“, leere die Suche und deaktiviere gegebenenfalls „Nur Suchbegriff-Treffer“.'
                  : !overview.sources.some((source) => source.enabled && overview.topics.some((topic) => topic.id === source.topicId && topic.enabled && !topic.projectMissing))
                    ? 'Es gibt keine aktive Quelle mit aktivem Thema. Prüfe die Pausen und Projektzuordnungen unter „Themen & Quellen einrichten“.'
                    : !overview.sources.some((source) => source.lastAttempt)
                      ? 'Die Quellen wurden noch nicht abgerufen. Aktiviere den automatischen Abruf oder klicke auf „Quellen prüfen“.'
                      : 'Der bisherige Abruf hat keine verwendbaren Meldungen geliefert. Prüfe, ob die Quelle einen RSS-/Atom-Feed mit Artikellinks enthält. Ein neuer Abruf ist frühestens nach 15 Minuten möglich.'}
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {[...groups].map(([url, items]) => {
          const item = items[0],
            sourceInfo = overview?.sources.find((s) => s.id === item.sourceId),
            topic = overview?.topics.find((t) => t.id === item.topicId)
          return (
            <article
              key={url}
              className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-5"
            >
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {sourceInfo ? categoryNames[sourceInfo.category] : 'Quelle'}
                </Badge>
                {items.some((i) => i.saved) && (
                  <Badge variant="outline">Gemerkt</Badge>
                )}
                <Badge variant="outline">
                  {items.every((i) => i.read) ? 'Gelesen' : 'Ungelesen'}
                </Badge>
              </div>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 break-words text-lg font-semibold hover:underline"
              >
                <span className="min-w-0 flex-1 break-words">{item.title}</span>
                <ExternalLink className="mt-1 size-4 shrink-0" />
              </a>
              <p className="break-words text-sm text-muted-foreground">
                {item.excerpt || 'Kein Textauszug in der Quelle enthalten.'}
              </p>
              <p className="text-xs text-muted-foreground">
                Quelldatum:{' '}
                {item.publishedAt
                  ? new Date(item.publishedAt).toLocaleString('de-DE')
                  : 'Nicht angegeben'}{' '}
                · Gefunden: {new Date(item.foundAt).toLocaleString('de-DE')}
              </p>
              <ul className="space-y-1 text-xs">
                {items.map((record) => {
                  const src = overview?.sources.find(
                      (s) => s.id === record.sourceId,
                    ),
                    t = overview?.topics.find((t) => t.id === record.topicId)
                  return (
                    <li key={record.id} className="break-words">
                      {src?.name} · {t?.name} ·{' '}
                      {record.matches.length
                        ? `Passende Suchbegriffe: ${record.matches.join(', ')}`
                        : 'Kein Suchbegriff im Feed-Auszug gefunden.'}
                    </li>
                  )
                })}
              </ul>
              {item.projectId && !item.projectMissing && (
                <Link
                  className="block text-xs underline"
                  to={`/projects?project=${item.projectId}`}
                >
                  Projekt: {item.projectName}
                </Link>
              )}
              <label className="block space-y-1 text-xs">
                <span>Fund zuordnen</span>
                <select
                  aria-label="Projektzuordnung des Funds"
                  className="max-w-full rounded-md border border-border bg-background p-2"
                  disabled={action.isPending}
                  value={
                    item.projectOverride ? (item.projectId ?? 'none') : 'topic'
                  }
                  onChange={(e) =>
                    action.mutate({
                      path: '/items/state',
                      body: {
                        ids: items.map((i) => i.id),
                        projectOverride: e.target.value !== 'topic',
                        projectId: ['topic', 'none'].includes(e.target.value)
                          ? null
                          : e.target.value,
                      },
                    })
                  }
                >
                  <option value="topic">Zuordnung des Themas verwenden</option>
                  <option value="none">Persönlich · ohne Projekt</option>
                  {item.projectMissing && item.projectId && (
                    <option value={item.projectId}>
                      Bisheriges Projekt nicht verfügbar
                    </option>
                  )}
                  {projects.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              {item.explanation && (
                <section className="rounded-lg border border-primary/25 p-3">
                  <p className="mb-1 text-xs font-medium">
                    Omni · KI-Zusammenfassung des Feed-Auszugs
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {item.explanation.summary}
                  </p>
                </section>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={action.isPending}
                  onClick={() =>
                    action.mutate({
                      path: '/items/state',
                      body: {
                        ids: items.map((i) => i.id),
                        read: !items.every((i) => i.read),
                      },
                    })
                  }
                >
                  {items.every((i) => i.read) ? 'Als ungelesen' : 'Als gelesen'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={action.isPending}
                  onClick={() =>
                    action.mutate({
                      path: '/items/state',
                      body: {
                        ids: items.map((i) => i.id),
                        saved: !items.some((i) => i.saved),
                      },
                    })
                  }
                >
                  <Bookmark className="mr-1 size-3.5" />
                  {items.some((i) => i.saved) ? 'Aus Merkliste' : 'Merken'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={action.isPending || Boolean(item.explanation)}
                  onClick={() =>
                    action.mutate({ path: `/items/${item.id}/explain` })
                  }
                >
                  <Sparkles className="mr-1 size-3.5" />
                  Omni einordnen lassen
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={action.isPending || item.projectMissing}
                  onClick={() =>
                    action.mutate({ path: `/items/${item.id}/memory` })
                  }
                >
                  <Brain className="mr-1 size-3.5" />
                  Ins Gedächtnis · {topic?.name}
                </Button>
              </div>
            </article>
          )
        })}
      </div>
      <details className="rounded-xl border border-border p-4 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium">
          Automatik, Quellen und Grenzen
        </summary>
        <p className="mt-3 leading-relaxed">
          Beim Öffnen werden fällige Quellen in Gruppen von drei geprüft, mit
          mindestens 15 Minuten Abstand je Quelle. Offline-Prüfungen benötigen
          einen separat eingerichteten Scheduler. Der gespeicherte Zeitpunkt
          unten zeigt, ob bereits ein erfolgreicher Hintergrundabruf erfolgt
          ist.{' '}
          <span className="block mt-2">
            Letzter erfolgreicher Hintergrundabruf:{' '}
            {lastSchedulerAt
              ? new Date(lastSchedulerAt).toLocaleString('de-DE')
              : 'Noch keiner gespeichert.'}
          </span>
          <span className="block mt-2 break-all">
            Scheduler-URL: {window.location.origin}/api/cron/radar-refresh
          </span>
          <span className="block mt-1">
            GET · alle 5 Minuten · Header Authorization: Bearer gefolgt vom
            bestehenden CRON_SECRET aus Vercel. Den geheimen Wert nicht im Chat
            teilen.
          </span>
          <a
            href="https://console.cron-job.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Scheduler verwalten
          </a>
          . Die Übersicht zeigt Feed-Auszüge, keine vollständigen
          Webseitenarchive. Gleiche Artikel-URLs werden gruppiert; ähnliche
          Berichte verschiedener URLs werden nicht als identisch behauptet.
          Suchbegriffe sind Texttreffer, keine bestätigte Betroffenheit. Omni
          fasst nur auf Wunsch den externen Auszug zusammen, ohne neue
          Recherche. Gedächtnisübernahme speichert ausdrücklich den Fund mit
          Original-URL und dem Projekt des Themas.
        </p>
      </details>
    </div>
  )
}
