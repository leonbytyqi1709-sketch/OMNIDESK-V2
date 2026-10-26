import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useApiFetch } from '@/hooks/use-api'
import {
  BROWSER_PANEL_MODULES,
  MAX_BROWSER_PANEL_ENTRIES,
} from '@/lib/browser-panel'
import { useLinks } from '@/modules/links/api'
import type { BrowserPanelEntry, BrowserPanelView } from '@/types/browser-desk'
import { useBrowserPanel } from './api'

/**
 * Einrichtung des Browser-Seitenpanels.
 *
 * Alles, was die Erweiterung zeigt, wird hier festgelegt. Die Erweiterung
 * selbst kann diese Einstellungen nur lesen: Ihr Gerätezugang erlaubt keinen
 * Schreibzugriff auf die Konfiguration.
 */
export function PanelSettings() {
  const panel = useBrowserPanel()
  const links = useLinks()
  const api = useApiFetch()
  const cache = useQueryClient()

  const [entries, setEntries] = useState<BrowserPanelEntry[]>([])
  const [showCommands, setShowCommands] = useState(true)
  const [commandCategory, setCommandCategory] = useState('')
  const [version, setVersion] = useState(1)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Serverstand übernehmen, solange nichts Eigenes offen ist. Ein offener
  // Entwurf wird nicht durch einen Hintergrundabruf überschrieben.
  useEffect(() => {
    if (!panel.data || dirty) return
    setEntries(panel.data.entries)
    setShowCommands(panel.data.showCommands)
    setCommandCategory(panel.data.commandCategory ?? '')
    setVersion(panel.data.version)
  }, [panel.data, dirty])

  const change = (fn: () => void) => {
    fn()
    setDirty(true)
  }

  const addModule = (path: string) => {
    if (!path) return
    change(() =>
      setEntries((current) => [
        ...current,
        { id: crypto.randomUUID(), kind: 'module', target: path },
      ]),
    )
  }

  const addLink = (id: string) => {
    if (!id) return
    change(() =>
      setEntries((current) => [
        ...current,
        { id: crypto.randomUUID(), kind: 'link', target: id },
      ]),
    )
  }

  const move = (index: number, direction: -1 | 1) => {
    const next = index + direction
    if (next < 0 || next >= entries.length) return
    change(() =>
      setEntries((current) => {
        const copy = [...current]
        ;[copy[index], copy[next]] = [copy[next], copy[index]]
        return copy
      }),
    )
  }

  const remove = (id: string) =>
    change(() =>
      setEntries((current) => current.filter((entry) => entry.id !== id)),
    )

  async function save() {
    if (busy) return
    setBusy(true)
    try {
      const saved = await api<BrowserPanelView>('/api/browser/panel', {
        method: 'PUT',
        body: JSON.stringify({
          entries,
          showCommands,
          commandCategory: commandCategory || null,
          version,
        }),
      })
      setVersion(saved.version)
      setDirty(false)
      await cache.invalidateQueries({ queryKey: ['browser-panel'] })
      toast.success(
        'Panel gespeichert. Im Browser-Panel „Aktualisieren“ wählen.',
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Einstellungen konnten nicht gespeichert werden.',
      )
    } finally {
      setBusy(false)
    }
  }

  /** Beschriftung eines Eintrags für die Liste in der App. */
  const label = (entry: BrowserPanelEntry) => {
    if (entry.kind === 'module')
      return (
        BROWSER_PANEL_MODULES.find((m) => m.path === entry.target)?.title ??
        'Unbekanntes Modul'
      )
    const link = links.data?.find((l) => l.id === entry.target)
    return link ? link.title : 'Entfernter Link'
  }

  const full = entries.length >= MAX_BROWSER_PANEL_ENTRIES

  return (
    <Card>
      <CardHeader>
        <CardTitle>Panel im Browser einrichten</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Lege fest, was das Seitenpanel der Erweiterung anzeigt: eigene
          Schnellzugriffe auf Module und gespeicherte Links sowie deine
          Befehlsbibliothek zum Kopieren. Die Erweiterung liest diese
          Einstellungen nur; ändern kannst du sie ausschließlich hier.
        </p>

        {panel.error && (
          <p role="alert" className="text-sm text-destructive">
            {panel.error.message}
          </p>
        )}

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">
            Schnellzugriffe ({entries.length} von {MAX_BROWSER_PANEL_ENTRIES})
          </h3>

          {!entries.length ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Schnellzugriffe. Das Panel zeigt dann nur den
              Seitenkontext und – falls eingeschaltet – deine Befehle.
            </p>
          ) : (
            <ul className="space-y-2">
              {entries.map((entry, index) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {label(entry)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {entry.kind === 'module' ? 'Modul' : 'Link'}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Nach oben"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Nach unten"
                    disabled={index === entries.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Entfernen"
                    onClick={() => remove(entry.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Plus className="size-4 text-muted-foreground" />
              <span className="sr-only">Modul hinzufügen</span>
              <select
                aria-label="Modul als Schnellzugriff hinzufügen"
                className="min-w-0 rounded-md border border-border bg-background p-2 text-sm"
                value=""
                disabled={full}
                onChange={(event) => addModule(event.target.value)}
              >
                <option value="">Modul hinzufügen…</option>
                {BROWSER_PANEL_MODULES.map((module) => (
                  <option key={module.id} value={module.path}>
                    {module.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <span className="sr-only">Link hinzufügen</span>
              <select
                aria-label="Link als Schnellzugriff hinzufügen"
                className="min-w-0 max-w-64 rounded-md border border-border bg-background p-2 text-sm"
                value=""
                disabled={full || !links.data?.length}
                onChange={(event) => addLink(event.target.value)}
              >
                <option value="">
                  {links.data?.length
                    ? 'Link hinzufügen…'
                    : 'Keine Links vorhanden'}
                </option>
                {links.data?.map((link) => (
                  <option key={link.id} value={link.id}>
                    {link.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {full && (
            <p className="text-xs text-amber-400">
              Mehr als {MAX_BROWSER_PANEL_ENTRIES} Schnellzugriffe sind nicht
              vorgesehen; das Panel bleibt sonst unübersichtlich.
            </p>
          )}
        </section>

        <section className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Befehlsbibliothek</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showCommands}
              onChange={(event) =>
                change(() => setShowCommands(event.target.checked))
              }
            />
            Eigene Befehle im Panel anzeigen
          </label>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            Kategorie
            <select
              aria-label="Kategorie der angezeigten Befehle"
              className="min-w-0 rounded-md border border-border bg-background p-2 text-sm"
              value={commandCategory}
              disabled={!showCommands}
              onChange={(event) =>
                change(() => setCommandCategory(event.target.value))
              }
            >
              <option value="">Alle Kategorien</option>
              {panel.data?.commandCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-muted-foreground">
            Das Panel zeigt Titel, Kategorie und Befehl mit einer Schaltfläche
            zum Kopieren. Befehle werden dort nicht ausgeführt und nicht
            verändert.
          </p>
        </section>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button disabled={busy || panel.isPending} onClick={() => void save()}>
            Panel-Einstellungen speichern
          </Button>
          {dirty && (
            <span className="text-xs text-amber-400">
              Noch nicht gespeichert.
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            Nach dem Speichern im Browser-Panel „Aktualisieren“ wählen.
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
