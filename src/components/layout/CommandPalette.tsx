import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTheme } from 'next-themes'
import {
  Activity,
  Bot,
  CalendarDays,
  Cloud,
  Contact,
  FolderPlus,
  KeyRound,
  Laptop,
  Link2,
  ListTodo,
  Maximize2,
  Minimize2,
  Moon,
  NotebookPen,
  Pause,
  Play,
  RotateCcw,
  Settings,
  SkipForward,
  Sun,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { moduleRegistry } from '@/config/modules'
import { useCommands, type CommandDto } from '@/modules/commands/api'
import { SEARCH_LABEL, type SearchHit, type SearchKind } from '@/lib/search'
import { useDebounced, useGlobalSearch } from '@/modules/search/api'
import {
  CommandParamDialog,
  extractPlaceholders,
} from '@/modules/commands/components/CommandParamDialog'
import { STARTER_COMMANDS } from '@/modules/commands/starter-library'
import { useCommandPaletteStore } from '@/stores/command-palette'
import { usePomodoroStore } from '@/stores/pomodoro'
import { useSettingsStore } from '@/stores/settings'
import { setQuickAction } from '@/lib/quick-action'

/** Symbol und Farbe je Trefferart der modulweiten Suche. */
const HIT_ICON: Record<SearchKind, typeof NotebookPen> = {
  note: NotebookPen,
  task: ListTodo,
  appointment: CalendarDays,
  contact: Contact,
  project: FolderPlus,
  projectTask: ListTodo,
  link: Link2,
  command: Laptop,
}

const HIT_TINT: Record<SearchKind, string> = {
  note: 'text-amber-400',
  task: 'text-emerald-400',
  appointment: 'text-sky-400',
  contact: 'text-violet-400',
  project: 'text-primary',
  projectTask: 'text-primary',
  link: 'text-blue-400',
  command: 'text-muted-foreground',
}

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

export function CommandPalette() {
  const isOpen = useCommandPaletteStore((s) => s.isOpen)
  const setOpen = useCommandPaletteStore((s) => s.setOpen)
  const toggle = useCommandPaletteStore((s) => s.toggle)

  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { compactMode, setCompactMode, disabledModules } = useSettingsStore()
  const { start: startPomodoro, pause: pausePomodoro, reset: resetPomodoro, skip: skipPomodoro, running: pomodoroRunning } = usePomodoroStore()

  // Befehle und Notizen werden erst beim Öffnen der Palette geladen. Zuvor
  // lief auf jeder Seite der Anwendung ein zusätzlicher Abruf mit, obwohl die
  // Daten nur hier gebraucht werden.
  const { data: userCommands } = useCommands(isOpen)
  const [search, setSearch] = useState('')
  // Gesucht wird auf dem Server über alle Module; früher lag nur die
  // Notizliste im Browser und nur sie war durchsuchbar.
  const debounced = useDebounced(search)
  const { data: hits, isFetching: searching } = useGlobalSearch(debounced, isOpen)
  const [paramCmd, setParamCmd] = useState<CommandDto | null>(null)
  const [paramOpen, setParamOpen] = useState(false)

  // Suchbegriff zurücksetzen, wenn die Palette geschlossen wird
  useEffect(() => {
    if (!isOpen) setSearch('')
  }, [isOpen])

  // Treffer nach Art gruppieren, Reihenfolge wie in SEARCH_LABEL
  const groupedHits = useMemo(() => {
    const groups = new Map<SearchKind, SearchHit[]>()
    for (const hit of hits ?? [])
      (groups.get(hit.kind) ?? groups.set(hit.kind, []).get(hit.kind)!).push(hit)
    return [...groups.entries()]
  }, [hits])

  // Alle Befehle (Nutzer + Starter) zusammenführen
  const allCommands = useMemo<CommandDto[]>(() => {
    const list: CommandDto[] = []
    const seen = new Set<string>()

    for (const cmd of userCommands ?? []) {
      if (!seen.has(cmd.command)) {
        seen.add(cmd.command)
        list.push(cmd)
      }
    }

    for (const cmd of STARTER_COMMANDS) {
      if (!seen.has(cmd.command)) {
        seen.add(cmd.command)
        list.push({
          id: `starter-${cmd.command}`,
          title: cmd.title,
          command: cmd.command,
          category: cmd.category,
        })
      }
    }

    return list
  }, [userCommands])

  // Globaler Tastatur-Listener für Strg + K / Cmd + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggle()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggle])

  const runCommand = (action: () => void) => {
    setOpen(false)
    action()
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`Befehl kopiert: ${label}`),
      () => toast.error('Fehler beim Kopieren'),
    )
  }

  // Filter aktive Module
  const activeModules = moduleRegistry.filter((m) => !disabledModules.includes(m.id))

  return (
    <>
      <CommandDialog open={isOpen} onOpenChange={setOpen}>
        <CommandInput
          value={search}
          onValueChange={setSearch}
          placeholder="Befehl tippen oder Aktion suchen (z. B. 'Notiz', 'Port', 'Dark', 'Pomodoro')..."
        />
      <CommandList>
        <CommandEmpty>Nichts gefunden – weder in den Modulen noch in den Befehlen.</CommandEmpty>

        {/* 1. Modul-Navigation */}
        <CommandGroup heading="Navigation zu Modulen">
          {activeModules.map((m) => (
            <CommandItem
              key={m.id}
              value={`Navigation: ${m.title}`}
              onSelect={() => runCommand(() => navigate(m.path))}
            >
              <m.icon className="size-4 text-primary" />
              <span>{m.title}</span>
              <CommandShortcut>{m.path}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* 2. Schnellaktionen */}
        <CommandGroup heading="Schnellaktionen">
          <CommandItem
            value="Aktion: Omni KI Assistent Chat Frage stellen Bot GPT AI"
            onSelect={() =>
              runCommand(() => {
                navigate('/assistant')
                toast.info('Omni geöffnet')
              })
            }
          >
            <Bot className="size-4 text-purple-400" />
            <span>Omni öffnen</span>
            <CommandShortcut>/assistant</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="Aktion: Uptime Monitor Dienst Server prüfen Status Health"
            onSelect={() =>
              runCommand(() => {
                navigate('/uptime')
                toast.info('Uptime-Monitor geöffnet')
              })
            }
          >
            <Activity className="size-4 text-emerald-400" />
            <span>Uptime & Service-Health öffnen</span>
            <CommandShortcut>/uptime</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="Aktion: Neue Notiz anlegen erstellen"
            onSelect={() =>
              runCommand(() => {
                setQuickAction('create-note')
                navigate('/notes')
              })
            }
          >
            <NotebookPen className="size-4 text-emerald-400" />
            <span>Neue Notiz anlegen</span>
            <CommandShortcut>Notizen</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="Aktion: Neue Aufgabe Task ToDo anlegen"
            onSelect={() =>
              runCommand(() => {
                setQuickAction('create-task')
                navigate('/tasks')
              })
            }
          >
            <ListTodo className="size-4 text-amber-400" />
            <span>Neue Aufgabe erstellen</span>
            <CommandShortcut>Tasks</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="Aktion: Neuer Termin Kalender Booking eintragen"
            onSelect={() =>
              runCommand(() => {
                navigate('/calendar')
                toast.info('Kalender geöffnet')
              })
            }
          >
            <CalendarDays className="size-4 text-purple-400" />
            <span>Neuen Termin eintragen</span>
            <CommandShortcut>Kalender</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="Aktion: Neues Projekt anlegen Infrastruktur"
            onSelect={() =>
              runCommand(() => {
                setQuickAction('create-project')
                navigate('/projects')
              })
            }
          >
            <FolderPlus className="size-4 text-orange-400" />
            <span>Neues Projekt anlegen</span>
            <CommandShortcut>Projekte</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="Aktion: Neuen Bookmark Link Manager anlegen"
            onSelect={() =>
              runCommand(() => {
                navigate('/links')
                toast.info('Link-Manager geöffnet')
              })
            }
          >
            <Link2 className="size-4 text-cyan-400" />
            <span>Neuen Link hinzufügen</span>
            <CommandShortcut>Links</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="Aktion: Neuen Kontakt Adressbuch hinzufügen"
            onSelect={() =>
              runCommand(() => {
                navigate('/contacts')
                toast.info('Kontakte geöffnet')
              })
            }
          >
            <Contact className="size-4 text-indigo-400" />
            <span>Neuen Kontakt anlegen</span>
            <CommandShortcut>Kontakte</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="Aktion: Passwort-Manager Tresor öffnen"
            onSelect={() =>
              runCommand(() => {
                navigate('/passwords')
                toast.info('Passwort-Manager geöffnet')
              })
            }
          >
            <KeyRound className="size-4 text-rose-400" />
            <span>Passwort-Tresor öffnen</span>
            <CommandShortcut>Tresor</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="Aktion: Cloud-Monitoring Speicher prüfen Google Drive MEGA"
            onSelect={() =>
              runCommand(() => {
                navigate('/cloud-monitor')
                toast.info('Cloud-Monitoring geöffnet')
              })
            }
          >
            <Cloud className="size-4 text-sky-400" />
            <span>Cloud-Speicher prüfen</span>
            <CommandShortcut>Cloud</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* 3. Pomodoro-Steuerung */}
        <CommandGroup heading="Pomodoro Fokus-Timer">
          {pomodoroRunning ? (
            <CommandItem
              value="Pomodoro: Timer pausieren stoppen"
              onSelect={() =>
                runCommand(() => {
                  pausePomodoro()
                  toast.info('Pomodoro-Timer pausiert')
                })
              }
            >
              <Pause className="size-4 text-amber-400" />
              <span>Pomodoro pausieren</span>
              <CommandShortcut>Pause</CommandShortcut>
            </CommandItem>
          ) : (
            <CommandItem
              value="Pomodoro: Timer starten beginnen 25 min"
              onSelect={() =>
                runCommand(() => {
                  startPomodoro()
                  toast.success('Pomodoro-Fokus gestartet (25 Min.)')
                })
              }
            >
              <Play className="size-4 text-emerald-400" />
              <span>Pomodoro starten (25 Min. Fokus)</span>
              <CommandShortcut>Start</CommandShortcut>
            </CommandItem>
          )}

          <CommandItem
            value="Pomodoro: Phase überspringen skip"
            onSelect={() =>
              runCommand(() => {
                skipPomodoro()
                toast.info('Phase übersprungen')
              })
            }
          >
            <SkipForward className="size-4 text-muted-foreground" />
            <span>Nächste Phase (Pause/Fokus)</span>
            <CommandShortcut>Skip</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="Pomodoro: Timer zurücksetzen reset"
            onSelect={() =>
              runCommand(() => {
                resetPomodoro()
                toast.info('Pomodoro zurückgesetzt')
              })
            }
          >
            <RotateCcw className="size-4 text-muted-foreground" />
            <span>Timer zurücksetzen</span>
            <CommandShortcut>Reset</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Suche über alle Module – Treffer kommen vom Server */}
        {searching && groupedHits.length === 0 && search.trim().length >= 2 && (
          <>
            <div className="px-3 py-2 text-xs text-muted-foreground">Wird gesucht…</div>
            <CommandSeparator />
          </>
        )}
        {groupedHits.map(([kind, found]) => {
          const Icon = HIT_ICON[kind]
          return (
            <div key={kind}>
              <CommandGroup heading={`${SEARCH_LABEL[kind]} (${found.length})`}>
                {found.map((hit) => (
                  <CommandItem
                    key={`${hit.kind}:${hit.id}`}
                    // Der Server hat bereits gefiltert; der Suchbegriff steht
                    // im Wert, damit die Palette den Treffer nicht erneut
                    // wegfiltert.
                    value={`${SEARCH_LABEL[kind]} ${hit.title} ${hit.detail} ${hit.snippet} ${search}`}
                    onSelect={() => runCommand(() => navigate(hit.path))}
                  >
                    <Icon className={`size-4 shrink-0 ${HIT_TINT[kind]}`} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{hit.title}</span>
                      {(hit.snippet || hit.detail) && (
                        <span className="truncate text-[11px] text-muted-foreground">
                          {hit.snippet || hit.detail}
                        </span>
                      )}
                    </div>
                    <CommandShortcut>Öffnen</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </div>
          )
        })}

        {/* 4. Terminal- & IT-Befehle (Direktkopie & Parameter-Dialog) */}
        <CommandGroup heading={`CLI-Befehle & Cheat-Sheet (${allCommands.length} Befehle)`}>
          {allCommands.map((cmd) => {
            const hasPlaceholders = extractPlaceholders(cmd.command).length > 0
            const icon = getCategoryIcon(cmd.category)

            return (
              <CommandItem
                key={cmd.id}
                value={`CLI ${cmd.category}: ${cmd.title} ${cmd.command}`}
                onSelect={() => {
                  if (hasPlaceholders) {
                    setOpen(false)
                    setParamCmd(cmd)
                    setParamOpen(true)
                  } else {
                    runCommand(() => copyToClipboard(cmd.command, cmd.title))
                  }
                }}
              >
                <span className="text-base select-none shrink-0">{icon}</span>
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate">{cmd.title}</span>
                    {hasPlaceholders && (
                      <span className="text-[10px] text-primary bg-primary/10 border border-primary/30 rounded px-1 py-0 select-none shrink-0 font-sans">
                        Parameter
                      </span>
                    )}
                  </div>
                  <code className="text-[11px] text-muted-foreground font-mono truncate">
                    {cmd.command}
                  </code>
                </div>
                <CommandShortcut>{cmd.category}</CommandShortcut>
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandSeparator />

        {/* 5. Erscheinungsbild & Einstellungen */}
        <CommandGroup heading="Design & Einstellungen">
          <CommandItem
            value="Theme: Dark Mode Dunkles Design"
            onSelect={() =>
              runCommand(() => {
                setTheme('dark')
                toast.success('Dark Mode aktiviert')
              })
            }
          >
            <Moon className="size-4 text-muted-foreground" />
            <span>Dark Mode aktivieren</span>
          </CommandItem>

          <CommandItem
            value="Theme: Light Mode Helles Design"
            onSelect={() =>
              runCommand(() => {
                setTheme('light')
                toast.success('Light Mode aktiviert')
              })
            }
          >
            <Sun className="size-4 text-amber-400" />
            <span>Light Mode aktivieren</span>
          </CommandItem>

          <CommandItem
            value="Theme: System-Design folgen"
            onSelect={() =>
              runCommand(() => {
                setTheme('system')
                toast.success('System-Theme aktiviert')
              })
            }
          >
            <Laptop className="size-4 text-muted-foreground" />
            <span>System-Theme verwenden</span>
          </CommandItem>

          <CommandItem
            value="Ansicht: Kompakt-Modus umschalten dicht padding"
            onSelect={() =>
              runCommand(() => {
                const next = !compactMode
                setCompactMode(next)
                toast.info(next ? 'Kompakt-Modus an' : 'Standard-Abstände an')
              })
            }
          >
            {compactMode ? (
              <Maximize2 className="size-4 text-muted-foreground" />
            ) : (
              <Minimize2 className="size-4 text-muted-foreground" />
            )}
            <span>Kompakt-Modus {compactMode ? 'deaktivieren' : 'aktivieren'}</span>
            <CommandShortcut>{compactMode ? 'Aktiv' : 'Inaktiv'}</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="Einstellungen öffnen Konfiguration Optionen"
            onSelect={() => runCommand(() => navigate('/settings'))}
          >
            <Settings className="size-4 text-muted-foreground" />
            <span>Alle Einstellungen öffnen</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>

      {/* Footer Tastatur-Hilfe */}
      <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[11px] text-muted-foreground bg-secondary/30">
        <div className="flex items-center gap-2">
          <span>Navigation: <kbd className="rounded border bg-background px-1">↑</kbd> <kbd className="rounded border bg-background px-1">↓</kbd></span>
          <span>Auswählen: <kbd className="rounded border bg-background px-1">↵</kbd></span>
          <span>Schließen: <kbd className="rounded border bg-background px-1">Esc</kbd></span>
        </div>
        <span className="font-semibold text-gradient-accent">OMNIDESK</span>
      </div>
      </CommandDialog>
      <CommandParamDialog
        command={paramCmd}
        open={paramOpen}
        onOpenChange={setParamOpen}
      />
    </>
  )
}
