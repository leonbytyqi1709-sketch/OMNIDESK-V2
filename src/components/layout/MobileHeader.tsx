import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { UserButton, useUser } from '@clerk/clerk-react'
import { Menu, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCommandPaletteStore } from '@/stores/command-palette'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { moduleRegistry, type ModuleDefinition } from '@/config/modules'
import { useSettingsStore } from '@/stores/settings'
import { cn } from '@/lib/utils'

/** Sidebar-Gruppen in Anzeigereihenfolge; Settings hängt im Footer. */
const groups: Array<{ label: string | null; category: ModuleDefinition['category'] }> = [
  { label: null, category: 'core' },
  { label: 'Produktivität', category: 'productivity' },
  { label: 'IT-Tools', category: 'it-tools' },
  { label: 'Sicherheit', category: 'security' },
  { label: 'Cloud', category: 'cloud' },
]

export function MobileHeader() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const { user } = useUser()
  const disabledModules = useSettingsStore((s) => s.disabledModules)
  const settingsModule = moduleRegistry.find((m) => m.id === 'settings')!
  const openCommandPalette = useCommandPaletteStore((s) => s.open)

  const displayName =
    user?.fullName ??
    user?.username ??
    user?.primaryEmailAddress?.emailAddress ??
    'Unbekannt'

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b bg-card/95 px-4 backdrop-blur-md md:hidden">
      <div className="flex items-center gap-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label="Navigation öffnen"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col p-0 sm:w-80">
            {/* Sheet-Header mit Branding */}
            <SheetHeader className="flex h-14 flex-row items-center border-b px-4">
              <SheetTitle className="text-gradient-accent text-lg font-bold tracking-tight">
                OMNIDESK
              </SheetTitle>
              <SheetDescription className="sr-only">
                Hauptnavigation
              </SheetDescription>
            </SheetHeader>

            {/* Scrollbare Modul-Navigation */}
            <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
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
                    {group.label && (
                      <p className="px-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                        {group.label}
                      </p>
                    )}
                    {modules.map((m) => {
                      const isActive =
                        m.path === '/'
                          ? pathname === '/'
                          : pathname.startsWith(m.path)

                      return (
                        <NavLink
                          key={m.id}
                          to={m.path}
                          onClick={() => setOpen(false)}
                          className={cn(
                            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-gradient-accent glow text-white'
                              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                          )}
                        >
                          <m.icon className="size-4 shrink-0" />
                          <span className="truncate">{m.title}</span>
                        </NavLink>
                      )
                    })}
                  </div>
                )
              })}
            </nav>

            {/* Footer mit Profil & Einstellungen */}
            <div className="border-t p-3">
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5">
                  <UserButton
                    appearance={{
                      elements: { avatarBox: 'size-7' },
                    }}
                  />
                  <span className="truncate text-xs text-muted-foreground">
                    {displayName}
                  </span>
                </div>
                <Separator orientation="vertical" className="h-6" />
                <NavLink
                  to={settingsModule.path}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                    pathname.startsWith(settingsModule.path) &&
                      'bg-gradient-accent glow text-white',
                  )}
                  aria-label="Einstellungen"
                >
                  <settingsModule.icon className="size-4" />
                </NavLink>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <span className="text-gradient-accent font-bold tracking-tight text-base">
          OMNIDESK
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="size-9 text-muted-foreground hover:text-foreground"
          onClick={openCommandPalette}
          aria-label="Command-Palette öffnen"
        >
          <Search className="size-4" />
        </Button>
        <UserButton
          appearance={{
            elements: { avatarBox: 'size-7' },
          }}
        />
      </div>
    </header>
  )
}
