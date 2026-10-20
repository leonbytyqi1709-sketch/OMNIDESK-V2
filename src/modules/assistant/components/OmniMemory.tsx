import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  Archive,
  Brain,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useProjects } from '@/modules/projects/api'
import { useMemoryVersions, useOmniMemories } from '../api/memory'
import type { ChatMessageDto } from '../api'
import type {
  MemoryCategory,
  MemoryInput,
  OmniMemory,
} from '@/types/omni-memory'
export interface MemoryDraft {
  message: ChatMessageDto
  key: string
}
interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: MemoryDraft | null
  selectedId: string | null
  onSelect: (id: string | null) => void
}
const categories: Record<MemoryCategory, string> = {
  preference: 'Persönliche Vorliebe',
  knowledge: 'Wissen',
  decision: 'Entscheidung',
}
const blank: MemoryInput = {
  title: '',
  content: '',
  category: 'knowledge',
  projectId: null,
  pinned: false,
  archived: false,
}
interface Editor {
  id: string
  version: number | null
  input: MemoryInput
  sourceMessageId: string | null
}
function fields(memory: OmniMemory): MemoryInput {
  return {
    title: memory.title,
    content: memory.content,
    category: memory.category,
    projectId: memory.projectId,
    pinned: memory.pinned,
    archived: memory.archived,
  }
}
export function OmniMemory({
  open,
  onOpenChange,
  draft,
  selectedId,
  onSelect,
}: Props) {
  const { list, mutation } = useOmniMemories(open),
    projects = useProjects()
  const [search, setSearch] = useState(''),
    [archive, setArchive] = useState(false),
    [filter, setFilter] = useState('all'),
    [editor, setEditor] = useState<Editor | null>(null),
    [deleting, setDeleting] = useState<OmniMemory | null>(null)
  const [showVersions, setShowVersions] = useState(false),
    versions = useMemoryVersions(selectedId, open && showVersions)
  useEffect(() => {
    if (draft) {
      setEditor({
        id: crypto.randomUUID(),
        version: null,
        input: {
          ...blank,
          title:
            draft.message.content
              .split('\n')
              .find((line) => line.trim())
              ?.replace(/^#+\s*/, '')
              .slice(0, 160) ?? 'Erinnerung',
          content: draft.message.content.slice(0, 4000),
        },
        sourceMessageId: draft.message.id,
      })
      setDeleting(null)
      setShowVersions(false)
    }
  }, [draft])
  const selected = list.data?.find((item) => item.id === selectedId)
  useEffect(() => {
    if (open && selectedId) {
      const item = list.data?.find((item) => item.id === selectedId)
      if (item) {
        setArchive(item.archived)
        setFilter('all')
        setSearch('')
      }
    }
  }, [open, selectedId, list.data])
  const filtered =
    list.data?.filter(
      (item) =>
        item.archived === archive &&
        (filter === 'all' ||
          (filter === 'global'
            ? item.projectId === null
            : item.projectId === filter)) &&
        `${item.title} ${item.content} ${item.projectName ?? ''}`
          .toLocaleLowerCase('de')
          .includes(search.toLocaleLowerCase('de')),
    ) ?? []
  const updateField = <K extends keyof MemoryInput>(
    key: K,
    value: MemoryInput[K],
  ) =>
    setEditor((current) =>
      current
        ? { ...current, input: { ...current.input, [key]: value } }
        : null,
    )
  const edit = (item: OmniMemory) => {
    onSelect(item.id)
    setEditor({
      id: item.id,
      version: item.version,
      input: fields(item),
      sourceMessageId: item.sourceMessageId,
    })
    setShowVersions(false)
    setDeleting(null)
    mutation.reset()
  }
  const close = () => {
    if (!mutation.isPending) onOpenChange(false)
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (value) onOpenChange(true)
        else close()
      }}
    >
      <DialogContent
        className="w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto sm:max-w-4xl"
        onEscapeKeyDown={(event) => {
          if (mutation.isPending) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (mutation.isPending) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="size-5 text-primary" />
            Omnis Gedächtnis
          </DialogTitle>
          <DialogDescription>
            Speichere gezielt Wissen, Vorlieben und Entscheidungen. Nur aktive
            passende Einträge werden im Chat berücksichtigt; Projektwissen nur
            beim ausgewählten Projekt.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={mutation.isPending}
            onClick={() => {
              setEditor({
                id: crypto.randomUUID(),
                version: null,
                input: { ...blank },
                sourceMessageId: null,
              })
              onSelect(null)
              setDeleting(null)
              mutation.reset()
            }}
          >
            <Plus className="mr-1.5 size-4" />
            Neue Erinnerung
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={list.isFetching || mutation.isPending}
            onClick={() => void list.refetch()}
          >
            <RefreshCw className="mr-1.5 size-3.5" />
            Aktualisieren
          </Button>
          <Badge variant="outline">
            {list.data?.filter((item) => !item.archived).length ?? '–'} aktiv ·{' '}
            {list.data?.filter((item) => item.archived).length ?? '–'}{' '}
            archiviert
          </Badge>
        </div>
        {mutation.error && (
          <p role="alert" className="text-sm text-destructive">
            {mutation.error.message}
          </p>
        )}
        {list.error && (
          <p role="alert" className="text-sm text-destructive">
            {list.error.message}
          </p>
        )}
        {projects.error && (
          <p className="text-xs text-amber-400">
            Projekte gerade nicht verfügbar; bitte vor einer Projektzuordnung
            neu laden.
          </p>
        )}
        {editor && (
          <form
            className="space-y-3 rounded-xl border border-primary/30 bg-secondary/15 p-4"
            onSubmit={(event) => {
              event.preventDefault()
              mutation.mutate(
                editor.version === null
                  ? {
                      type: 'create',
                      id: editor.id,
                      input: editor.input,
                      sourceMessageId: editor.sourceMessageId,
                    }
                  : {
                      type: 'update',
                      id: editor.id,
                      input: editor.input,
                      version: editor.version,
                    },
                {
                  onSuccess: () => {
                    setEditor(null)
                    onSelect(null)
                  },
                },
              )
            }}
          >
            <h3 className="text-sm font-semibold">
              {editor.version === null
                ? 'Neue Erinnerung prüfen und speichern'
                : `Erinnerung bearbeiten · Version ${editor.version}`}
            </h3>
            {draft && editor.version === null && editor.sourceMessageId && (
              <p className="text-xs text-muted-foreground">
                Aus einer{' '}
                {draft.message.role === 'assistant'
                  ? 'KI-Antwort (abgeleitet, bitte prüfen)'
                  : 'eigenen Chatnachricht'}
                .{' '}
                {draft.message.content.length > 4000
                  ? 'Nur die ersten 4.000 Zeichen wurden übernommen. '
                  : ''}
                Der Text ist vor dem Speichern frei bearbeitbar.
              </p>
            )}
            <label className="block space-y-1 text-sm">
              <span>Titel</span>
              <Input
                value={editor.input.title}
                onChange={(e) => updateField('title', e.target.value)}
                required
                maxLength={160}
                disabled={mutation.isPending}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Was soll Omni wissen?</span>
              <Textarea
                value={editor.input.content}
                onChange={(e) => updateField('content', e.target.value)}
                required
                maxLength={4000}
                rows={5}
                disabled={mutation.isPending}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="block">Art</span>
                <select
                  className="w-full rounded-md border border-border bg-background p-2"
                  value={editor.input.category}
                  onChange={(e) =>
                    updateField('category', e.target.value as MemoryCategory)
                  }
                  disabled={mutation.isPending}
                >
                  {Object.entries(categories).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="block">Gültig für</span>
                <select
                  className="w-full rounded-md border border-border bg-background p-2"
                  value={editor.input.projectId ?? ''}
                  onChange={(e) =>
                    updateField('projectId', e.target.value || null)
                  }
                  disabled={mutation.isPending}
                >
                  <option value="">Persönlich · ohne Projektbindung</option>
                  {editor.input.projectId &&
                    !projects.data?.some(
                      (p) => p.id === editor.input.projectId,
                    ) && (
                      <option value={editor.input.projectId}>
                        Bisheriges Projekt nicht verfügbar
                      </option>
                    )}
                  {projects.data?.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={editor.input.pinned}
                onChange={(e) => updateField('pinned', e.target.checked)}
                disabled={mutation.isPending}
              />
              Bevorzugt berücksichtigen (innerhalb des Kontextlimits)
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={editor.input.archived}
                onChange={(e) => updateField('archived', e.target.checked)}
                disabled={mutation.isPending}
              />
              Archiviert · nicht mehr für neue Chatantworten verwenden
            </label>
            <p className="text-xs text-muted-foreground">
              Aktive passende Erinnerungen werden an deinen bestehenden
              KI-Anbieter übermittelt. Keine Passwörter, Tokens oder
              Wiederherstellungscodes speichern. Omni übernimmt nichts
              automatisch aus anderen Modulen.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                type="submit"
                disabled={
                  mutation.isPending ||
                  !editor.input.title.trim() ||
                  !editor.input.content.trim()
                }
              >
                {mutation.isPending && (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                )}
                Erinnerung speichern
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => setEditor(null)}
              >
                Entwurf verwerfen
              </Button>
            </div>
          </form>
        )}
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <Input
            aria-label="Gedächtnis durchsuchen"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Titel, Inhalt oder Projekt durchsuchen…"
          />
          <select
            aria-label="Aktiv oder Archiv"
            className="rounded-md border border-border bg-background p-2 text-sm"
            value={archive ? 'archive' : 'active'}
            onChange={(e) => setArchive(e.target.value === 'archive')}
          >
            <option value="active">Aktive Erinnerungen</option>
            <option value="archive">Archiv</option>
          </select>
          <select
            aria-label="Projektfilter"
            className="max-w-full rounded-md border border-border bg-background p-2 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Alle Bereiche</option>
            <option value="global">Ohne Projektbindung</option>
            {projects.data?.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        {list.isLoading && (
          <p className="text-xs text-muted-foreground">
            Gedächtnis wird geladen…
          </p>
        )}
        {!list.isLoading && !list.error && !filtered.length && (
          <p className="text-sm text-muted-foreground">
            Keine Erinnerungen für diese Auswahl.
          </p>
        )}
        <ul className="space-y-3">
          {filtered.map((item) => (
            <li
              key={item.id}
              className={`space-y-3 rounded-xl border p-4 ${selectedId === item.id ? 'border-primary' : 'border-border'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button
                  className="min-w-0 break-words text-left text-sm font-semibold hover:underline"
                  onClick={() => {
                    onSelect(item.id)
                    setShowVersions(false)
                  }}
                >
                  {item.title}
                </button>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">{categories[item.category]}</Badge>
                  {item.pinned && <Badge variant="outline">Bevorzugt</Badge>}
                  <Badge variant="outline">v{item.version}</Badge>
                </div>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                {item.content}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.projectName ??
                  (item.projectMissing
                    ? 'Projekt entfernt / nicht mehr verfügbar'
                    : 'Persönlich')}{' '}
                · aktualisiert{' '}
                {new Date(item.updatedAt).toLocaleString('de-DE')}
              </p>
              {item.sourceSessionId ? (
                <Link
                  className="block text-xs underline underline-offset-4"
                  to={`/assistant?session=${item.sourceSessionId}#chat-message-${item.sourceMessageId}`}
                  onClick={close}
                >
                  Originalquelle im Chat öffnen
                  {item.sourceRole === 'assistant'
                    ? ' · aus KI-Antwort abgeleitet'
                    : ''}
                </Link>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {item.sourceMissing
                    ? 'Ursprüngliche Chatquelle wurde entfernt.'
                    : 'Manuell eingegeben.'}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() => edit(item)}
                >
                  <Pencil className="mr-1.5 size-3.5" />
                  Bearbeiten
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({
                      type: 'update',
                      id: item.id,
                      version: item.version,
                      input: { ...fields(item), archived: !item.archived },
                    })
                  }
                >
                  <Archive className="mr-1.5 size-3.5" />
                  {item.archived ? 'Wieder aktivieren' : 'Archivieren'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    onSelect(item.id)
                    setShowVersions(true)
                  }}
                >
                  Versionen
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={mutation.isPending}
                  onClick={() => {
                    setDeleting(item)
                    onSelect(item.id)
                  }}
                >
                  <Trash2 className="mr-1.5 size-3.5" />
                  Löschen
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {selected && showVersions && (
          <section className="space-y-3 rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold">
              Versionen von „{selected.title}“
            </h3>
            <p className="text-xs text-muted-foreground">
              Die letzten 50 gespeicherten Stände. Übernehmen füllt einen
              Entwurf; erst Speichern legt einen neuen Stand an.
            </p>
            {versions.error && (
              <p role="alert" className="text-xs text-destructive">
                {versions.error.message}
              </p>
            )}
            {versions.isLoading && (
              <p className="text-xs">Versionen werden geladen…</p>
            )}
            {versions.data?.map((version) => (
              <details key={version.version}>
                <summary className="cursor-pointer text-xs">
                  Version {version.version} ·{' '}
                  {new Date(version.createdAt).toLocaleString('de-DE')}
                </summary>
                <div className="mt-2 space-y-2">
                  <p className="break-words text-sm font-semibold">
                    {version.title}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-xs">
                    {version.content}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={mutation.isPending}
                    onClick={() =>
                      setEditor({
                        id: selected.id,
                        version: selected.version,
                        input: {
                          title: version.title,
                          content: version.content,
                          category: version.category,
                          projectId: version.projectId,
                          pinned: version.pinned,
                          archived: version.archived,
                        },
                        sourceMessageId: selected.sourceMessageId,
                      })
                    }
                  >
                    Als Entwurf übernehmen
                  </Button>
                </div>
              </details>
            ))}
          </section>
        )}
        {deleting && (
          <section
            role="alert"
            className="space-y-3 rounded-xl border border-destructive/50 p-4"
          >
            <p className="break-words text-sm">
              „{deleting.title}“ und alle zugehörigen Gedächtnisversionen
              endgültig löschen?
            </p>
            <p className="text-xs text-muted-foreground">
              Bereits gespeicherte Chatnachrichten und Antworten bleiben
              erhalten. Für Antworten ohne bisherigen Gesprächskontext einen
              neuen Chat starten.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate(
                    {
                      type: 'delete',
                      id: deleting.id,
                      version: deleting.version,
                    },
                    {
                      onSuccess: () => {
                        setDeleting(null)
                        setEditor(null)
                        onSelect(null)
                      },
                    },
                  )
                }
              >
                Endgültig löschen
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => setDeleting(null)}
              >
                Behalten
              </Button>
            </div>
          </section>
        )}
        <p className="text-xs text-muted-foreground">
          Archivierte Einträge und ihre Versionen bleiben gespeichert, werden
          aber nicht neu als Gedächtniskontext gesendet. Das ist gezielt
          gespeichertes Wissen, keine automatische Aufgabenhistorie oder
          vollständiges Missionsarchiv.
        </p>
      </DialogContent>
    </Dialog>
  )
}
