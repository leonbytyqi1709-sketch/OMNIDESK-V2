import { NavLink, useLocation } from 'react-router'
import { UserButton, useUser } from '@clerk/clerk-react'
import { PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { moduleRegistry, type ModuleDefinition } from '@/config/modules'
import { useCommandPaletteStore } from '@/stores/command-palette'
import { useSettingsStore } from '@/stores/settings'
import { cn } from '@/lib/utils'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

/** Sidebar-Gruppen in Anzeigereihenfolge; Settings hängt fest im Footer. */
const groups: Array<{ label: string | null; category: ModuleDefinition['category'] }> = [
  { label: null, category: 'core' },
  { label: 'Produktivität', category: 'productivity' },
  { label: 'IT-Tools', category: 'it-tools' },
  { label: 'Sicherheit', category: 'security' },
  { label: 'Cloud', category: 'cloud' },
]

function SidebarLink({
  module,
  collapsed,
}: {
  module: ModuleDefinition
  collapsed: boolean
}) {
  const { pathname } = useLocation()
  // Aktiv-Zustand selbst berechnen und als fertigen String übergeben:
  // eine className-Funktion würde von Radix' TooltipTrigger (asChild)
  // beim Prop-Merging zu einem String koerziert und ginge verloren.
  const isActive =
    module.path === '/' ? pathname === '/' : pathname.startsWith(module.path)

  const link = (
    <NavLink
      to={module.path}
      // Beim Überfahren oder Fokussieren wird der Modul-Code schon geladen,
      // sodass der Wechsel beim Klick ohne Wartezeit erfolgt.
      onMouseEnter={() => module.component.preload()}
      onFocus={() => module.component.preload()}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-gradient-accent glow-strong text-white font-semibold shadow-md shadow-primary/20'
          : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
        collapsed && 'justify-center px-2',
      )}
    >
      <module.icon className={cn('size-4 shrink-0', isActive && 'text-white')} />
      {!collapsed && <span className="truncate">{module.title}</span>}
    </NavLink>
  )

  if (!collapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{module.title}</TooltipContent>
    </Tooltip>
  )
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const settingsModule = moduleRegistry.find((m) => m.id === 'settings')!
  const disabledModules = useSettingsStore((s) => s.disabledModules)
  const { user } = useUser()
  const displayName =
    user?.fullName ??
    user?.username ??
    user?.primaryEmailAddress?.emailAddress ??
    'Unbekannt'

  const openCommandPalette = useCommandPaletteStore((s) => s.open)

  return (
    <TooltipProvider delayDuration={100}>
      <aside
        className={cn(
          'sticky top-0 hidden md:flex h-screen shrink-0 flex-col border-r border-border/60 bg-card/85 backdrop-blur-xl shadow-2xl transition-[width] duration-200 z-20',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {/* Kopf: Logo + Einklapp-Schalter */}
        <div
          className={cn(
            'flex h-14 items-center border-b px-3',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          {!collapsed && (
            <span className="text-gradient-accent px-1 text-lg font-bold tracking-tight">
              OMNIDESK
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            aria-label={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </Button>
        </div>

        {/* Command-Palette Schnellzugriff (Strg + K) */}
        <div className="p-2 border-b border-border/40">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={openCommandPalette}
                  className="flex size-10 w-full items-center justify-center rounded-md border border-border/60 bg-secondary/30 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  aria-label="Command-Palette öffnen (Strg + K)"
                >
                  <Search className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Befehle & Suche (Strg + K)</TooltipContent>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={openCommandPalette}
              className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-secondary/30 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-secondary/60 hover:text-foreground"
            >
              <div className="flex items-center gap-2">
                <Search className="size-3.5 text-primary" />
                <span className="truncate">Befehle & Suche...</span>
              </div>
              <kbd className="rounded border border-border/80 bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                Strg K
              </kbd>
            </button>
          )}
        </div>

        {/* Modul-Navigation (aus der zentralen Registry) */}
        <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
          {groups.map((group) => {
            const modules = moduleRegistry.filter(
              (m) =>
                m.category === group.category &&
                m.id !== 'settings' &&
                !disabledModules.includes(m.id),
            )
            if (modules.length === 0) return null
            return (
              <div key={group.category} className="space-y-1">
                {group.label && !collapsed && (
                  <p className="px-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    {group.label}
                  </p>
                )}
                {modules.map((m) => (
                  <SidebarLink key={m.id} module={m} collapsed={collapsed} />
                ))}
              </div>
            )
          })}
        </nav>

        {/* Fest verankerter Footer: Benutzerprofil + Einstellungen (Spec, Abschnitt 3) */}
        <div className="border-t p-2">
          <div
            className={cn(
              'flex items-center gap-2',
              collapsed && 'flex-col',
            )}
          >
            <div
              className={cn(
                'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5',
                collapsed && 'flex-none px-0',
              )}
            >
              {/* Clerk-Benutzermenü: Profil verwalten, Abmelden */}
              <UserButton
                appearance={{
                  elements: { avatarBox: 'size-7' },
                }}
              />
              {!collapsed && (
                <span className="min-w-0 truncate text-sm text-muted-foreground">
                  {displayName}
                </span>
              )}
            </div>
            {collapsed && <Separator className="my-1" />}
            <div className="shrink-0">
              <SidebarLink module={settingsModule} collapsed={collapsed} />
            </div>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  )
}
