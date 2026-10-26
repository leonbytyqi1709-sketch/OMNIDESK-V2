import { useMemo, useState } from 'react'
import {
  Check,
  Copy,
  Download,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Sliders,
  Sparkles,
  Star,
  Terminal,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { CommandFormDialog } from './components/CommandFormDialog'
import {
  CommandParamDialog,
  extractPlaceholders,
} from './components/CommandParamDialog'
import { STARTER_COMMANDS } from './starter-library'
import {
  useCommands,
  useCreateCommandsBulk,
  useDeleteCommand,
  type CommandDto,
} from './api'

function getCategoryIcon(cat: string) {
  if (cat.includes('Kubernetes') || cat.includes('Cloud-Native')) return '☸️'
  if (cat.includes('Sicherheit') || cat.includes('SSL') || cat.includes('Auditing')) return '🛡️'
  if (cat.includes('Datenbanken') || cat.includes('Caches')) return '🐘'
  if (cat.includes('Active Directory') || cat.includes('Windows Server')) return '🏢'
  if (cat.includes('Linux') || cat.includes('Ubuntu')) return '🐧'
  if (cat.includes('Windows') || cat.includes('PowerShell')) return '🪟'
  if (cat.includes('Git')) return '🌿'
  if (cat.includes('Docker') || cat.includes('Container')) return '🐳'
  if (cat.includes('Netzwerk') || cat.includes('Cisco') || cat.includes('Troubleshooting')) return '🌐'
  return '⚡'
}

function getPromptSymbol(cat: string): string {
  if (
    cat.includes('Windows') ||
    cat.includes('PowerShell') ||
    cat.includes('Active Directory')
  ) {
    return '>'
  }
  return '$'
}

function renderCommandParts(command: string) {
  const parts = command.split(/({{\s*[^}]+\s*}})/g)
  return parts.map((part, idx) => {
    if (part.startsWith('{{') && part.endsWith('}}')) {
      const paramName = part.slice(2, -2).trim()
      return (
        <span
          key={idx}
          className="inline-flex items-center rounded border border-primary/40 bg-primary/20 px-1 py-0.2 text-[11px] font-semibold text-primary shadow-xs transition-colors hover:bg-primary/30"
          title={`Parameter: ${paramName}`}
        >
          {part}
        </span>
      )
    }
    return <span key={idx}>{part}</span>
  })
}

interface CommandRowProps {
  cmd: CommandDto
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  onEdit: (cmd: CommandDto) => void
  onDelete: (cmd: CommandDto) => void
  onParamClick: (cmd: CommandDto) => void
}

function CommandRow({
  cmd,
  isFavorite,
  onToggleFavorite,
  onEdit,
  onDelete,
  onParamClick,
}: CommandRowProps) {
  const [copied, setCopied] = useState(false)
  const placeholders = extractPlaceholders(cmd.command)
  const hasPlaceholders = placeholders.length > 0

  const handleAction = async () => {
    if (hasPlaceholders) {
      onParamClick(cmd)
      return
    }
    await navigator.clipboard.writeText(cmd.command)
    setCopied(true)
    toast.success('Befehl in die Zwischenablage kopiert!')
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/20">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium text-foreground">{cmd.title}</p>
          {hasPlaceholders && (
            <Badge
              variant="outline"
              className="cursor-pointer border-primary/40 bg-primary/10 text-[10px] text-primary gap-1 py-0 px-1.5 hover:bg-primary/20 transition-colors"
              onClick={() => onParamClick(cmd)}
              title="Parameter vor dem Kopieren ausfüllen"
            >
              <Sliders className="size-2.5" />
              {placeholders.length} {placeholders.length === 1 ? 'Parameter' : 'Parameter'}
            </Badge>
          )}
        </div>

        {/* Terminal Monospace Box (Klickbar für Direktausführung) */}
        <div
          onClick={handleAction}
          className="group/code mt-1.5 flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-black/40 px-3 py-2 font-mono text-xs text-foreground/90 transition-all hover:border-primary/50 hover:bg-black/60 shadow-xs"
          title={hasPlaceholders ? 'Klicken, um Parameter anzupassen' : 'Klicken zum Kopieren'}
        >
          <span className="select-none font-bold text-muted-foreground/60">
            {getPromptSymbol(cmd.category)}
          </span>
          <div className="min-w-0 flex-1 truncate font-mono text-[12.5px] leading-relaxed">
            {renderCommandParts(cmd.command)}
          </div>
          <span className="text-[10px] text-muted-foreground opacity-0 group-hover/code:opacity-100 transition-opacity select-none shrink-0 font-sans flex items-center gap-1 font-medium">
            {hasPlaceholders ? 'Parameter' : 'Kopieren'}
          </span>
        </div>
      </div>

      {/* Aktionen auf der rechten Seite */}
      <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onToggleFavorite(cmd.id)}
          className={cn(
            'size-8 text-muted-foreground transition-colors hover:text-amber-400',
            isFavorite && 'text-amber-400 fill-amber-400',
          )}
          title={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
          aria-label="Favorit umschalten"
        >
          <Star className={cn('size-4', isFavorite && 'fill-amber-400')} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleAction}
          className={cn('size-8 text-muted-foreground hover:text-foreground', copied && 'text-green-400')}
          title={hasPlaceholders ? 'Parameter anpassen & kopieren' : 'Befehl kopieren'}
          aria-label="Befehl kopieren"
        >
          {copied ? (
            <Check className="size-4" />
          ) : hasPlaceholders ? (
            <Sliders className="size-4 text-primary" />
          ) : (
            <Copy className="size-4" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              aria-label="Befehl-Aktionen"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {hasPlaceholders && (
              <DropdownMenuItem onClick={() => onParamClick(cmd)}>
                <Sliders className="size-4 text-primary" /> Parameter ausfüllen
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onEdit(cmd)}>
              <Pencil className="size-4" /> Bearbeiten
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(cmd)}>
              <Trash2 className="size-4" /> Löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export default function CommandsPage() {
  const { data: commands, isLoading, error } = useCommands()
  const createBulk = useCreateCommandsBulk()
  const deleteCommand = useDeleteCommand()

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editCommand, setEditCommand] = useState<CommandDto | null>(null)
  const [paramCommand, setParamCommand] = useState<CommandDto | null>(null)
  const [paramDialogOpen, setParamDialogOpen] = useState(false)

  // Persistierte Favoritenliste im LocalStorage
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('omnidesk:favorite-commands') ?? '[]')
    } catch {
      return []
    }
  })

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((favId) => favId !== id) : [...prev, id]
      localStorage.setItem('omnidesk:favorite-commands', JSON.stringify(next))
      return next
    })
  }

  const categories = useMemo(
    () => [...new Set((commands ?? []).map((c) => c.category))].sort(),
    [commands],
  )

  const favoriteCount = (commands ?? []).filter((c) => favorites.includes(c.id)).length

  /** Filterung nach Suche, Kategorie und Favoriten. */
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = (commands ?? []).filter((c) => {
      if (onlyFavorites && !favorites.includes(c.id)) return false
      if (activeCategory !== null && c.category !== activeCategory) return false
      if (q === '') return true
      return (
        c.title.toLowerCase().includes(q) ||
        c.command.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
      )
    })

    const map = new Map<string, CommandDto[]>()
    for (const cmd of filtered) {
      map.set(cmd.category, [...(map.get(cmd.category) ?? []), cmd])
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'de'))
  }, [commands, search, activeCategory, onlyFavorites, favorites])

  const openCreate = () => {
    setEditCommand(null)
    setDialogOpen(true)
  }

  const openEdit = (cmd: CommandDto) => {
    setEditCommand(cmd)
    setDialogOpen(true)
  }

  const openParams = (cmd: CommandDto) => {
    setParamCommand(cmd)
    setParamDialogOpen(true)
  }

  const handleDelete = async (cmd: CommandDto) => {
    try {
      await deleteCommand.mutateAsync(cmd.id)
      toast.success('Befehl gelöscht')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen')
    }
  }

  const importStarter = async () => {
    try {
      const rows = await createBulk.mutateAsync(STARTER_COMMANDS)
      toast.success(`${rows.length} Befehle erfolgreich in deine Bibliothek importiert!`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import fehlgeschlagen')
    }
  }

  const exportMarkdown = () => {
    if (!commands || commands.length === 0) {
      toast.error('Keine Befehle zum Exportieren vorhanden.')
      return
    }
    let md = `# OMNIDESK IT-Befehls-Cheatsheet\nExportiert am: ${new Date().toLocaleDateString('de-DE')}\n\n`
    for (const [cat, items] of grouped) {
      md += `## ${cat}\n\n`
      for (const item of items) {
        md += `### ${item.title}\n\`\`\`bash\n${item.command}\n\`\`\`\n\n`
      }
    }
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `omnidesk-cheatsheet-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Befehls-Cheatsheet erfolgreich als Markdown exportiert!')
  }

  const isEmpty = !isLoading && !error && (commands ?? []).length === 0

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header mit Aktionen */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Befehlsbibliothek
            </h1>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              {(commands ?? []).length} Befehle
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Interaktives IT-Referenz-Sheet für Linux, Windows, Kubernetes, Docker, Datenbanken und Netzwerke.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={exportMarkdown}
            disabled={isEmpty}
            className="gap-1.5 text-xs h-9"
            title="Alle angezeigten Befehle als formatierte Markdown-Datei herunterladen"
          >
            <Download className="size-3.5" />
            Export (.md)
          </Button>

          <Button
            variant="outline"
            onClick={importStarter}
            disabled={createBulk.isPending}
            className="gap-2 text-xs h-9 border-primary/30 hover:bg-primary/5"
            title={`Importiert über ${STARTER_COMMANDS.length} geprüfte IT-Befehle`}
          >
            <Sparkles className="size-3.5 text-primary" />
            {createBulk.isPending ? 'Importiere...' : `Starter-Set (${STARTER_COMMANDS.length}+)`}
          </Button>

          <Button onClick={openCreate} className="bg-gradient-accent glow text-white gap-2 h-9 text-xs">
            <Plus className="size-4" /> Neuer Befehl
          </Button>
        </div>
      </div>

      {/* Suche & Kategorie-Filter Tabs */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Befehl, Titel, Parameter (z. B. port, container, ssl) suchen…"
            className="pl-9 h-10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {/* Alle */}
          <Badge
            variant={activeCategory === null && !onlyFavorites ? 'default' : 'outline'}
            className="cursor-pointer text-xs py-1 px-3"
            onClick={() => {
              setActiveCategory(null)
              setOnlyFavorites(false)
            }}
          >
            Alle ({(commands ?? []).length})
          </Badge>

          {/* Favoriten Filter Tab */}
          <Badge
            variant={onlyFavorites ? 'default' : 'outline'}
            className={cn(
              'cursor-pointer text-xs py-1 px-3 gap-1.5 transition-colors',
              onlyFavorites
                ? 'bg-amber-500 hover:bg-amber-600 text-black font-semibold'
                : 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10',
            )}
            onClick={() => {
              setOnlyFavorites(!onlyFavorites)
              if (!onlyFavorites) setActiveCategory(null)
            }}
          >
            <Star className="size-3 fill-current" />
            <span>Favoriten ({favoriteCount})</span>
          </Badge>

          {/* Kategorien */}
          {categories.map((cat) => (
            <Badge
              key={cat}
              variant={activeCategory === cat && !onlyFavorites ? 'default' : 'outline'}
              className="cursor-pointer text-xs py-1 px-3 gap-1.5"
              onClick={() => {
                setOnlyFavorites(false)
                setActiveCategory(activeCategory === cat ? null : cat)
              }}
            >
              <span>{getCategoryIcon(cat)}</span>
              <span>{cat}</span>
            </Badge>
          ))}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Fehler beim Laden der Befehle: {error.message}
        </div>
      )}

      {/* Empty State */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <Terminal className="size-7 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-base font-semibold">Noch keine Befehle vorhanden</h2>
          <p className="mt-1.5 max-w-md text-xs text-muted-foreground leading-relaxed">
            Starte mit unserer Starter-Bibliothek mit über {STARTER_COMMANDS.length} kuratierten Befehlen
            für Linux, Windows, Kubernetes, Docker, Datenbanken und Netzwerke, oder lege manuell eigene an.
          </p>
          <div className="mt-6 flex gap-3">
            <Button
              onClick={importStarter}
              disabled={createBulk.isPending}
              className="bg-gradient-accent glow text-white gap-2"
            >
              <Sparkles className="size-4" />
              {createBulk.isPending ? 'Wird importiert…' : `Starter-Set laden (${STARTER_COMMANDS.length}+ Befehle)`}
            </Button>
            <Button variant="outline" onClick={openCreate}>
              Eigenen Befehl anlegen
            </Button>
          </div>
        </div>
      )}

      {/* Befehlsliste nach Kategorien gruppiert */}
      {!isLoading && !isEmpty && grouped.length === 0 && (
        <p className="text-sm text-muted-foreground italic py-8 text-center">
          {onlyFavorites
            ? 'Noch keine Favoriten markiert. Klicke auf den Stern an einem Befehl, um ihn hier anzupinnen.'
            : 'Keine Befehle gefunden, die deiner Suche entsprechen.'}
        </p>
      )}

      {!isLoading && !isEmpty && grouped.length > 0 && (
        <div className="space-y-6">
          {grouped.map(([category, items]) => (
            <div
              key={category}
              className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-2.5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <span>{getCategoryIcon(category)}</span>
                  <span>{category}</span>
                </h2>
                <Badge variant="secondary" className="text-[10px]">
                  {items.length} {items.length === 1 ? 'Befehl' : 'Befehle'}
                </Badge>
              </div>

              <div className="divide-y divide-border">
                {items.map((cmd) => (
                  <CommandRow
                    key={cmd.id}
                    cmd={cmd}
                    isFavorite={favorites.includes(cmd.id)}
                    onToggleFavorite={toggleFavorite}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onParamClick={openParams}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <CommandFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editCommand={editCommand}
        categories={categories}
      />

      <CommandParamDialog
        command={paramCommand}
        open={paramDialogOpen}
        onOpenChange={setParamDialogOpen}
      />
    </div>
  )
}
