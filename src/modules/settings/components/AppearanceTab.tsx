import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Check, Monitor, Moon, SlidersHorizontal, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { DashboardCustomizerDialog } from '@/modules/dashboard/components/DashboardCustomizerDialog'
import { useSettingsStore } from '@/stores/settings'

/** Mini-Mockups für die Live-Theme-Vorschau (Klick = sofort anwenden). */
const THEME_PREVIEWS = [
  {
    value: 'dark',
    label: 'Dunkel',
    icon: <Moon className="size-3.5" />,
    frame: 'border-zinc-800 bg-zinc-950',
    sidebar: 'border-r border-zinc-800 bg-zinc-900',
    titleBar: 'bg-zinc-700',
    card: 'border-zinc-800 bg-zinc-900',
  },
  {
    value: 'light',
    label: 'Hell',
    icon: <Sun className="size-3.5" />,
    frame: 'border-zinc-300 bg-zinc-100',
    sidebar: 'border-r border-zinc-200 bg-white',
    titleBar: 'bg-zinc-300',
    card: 'border-zinc-200 bg-white',
  },
  {
    value: 'system',
    label: 'System',
    icon: <Monitor className="size-3.5" />,
    frame: 'border-zinc-400 bg-gradient-to-br from-zinc-950 via-zinc-400 to-zinc-100',
    sidebar: 'border-r border-black/10 bg-zinc-700/80',
    titleBar: 'bg-zinc-500',
    card: 'border-black/10 bg-white/60',
  },
]

export function AppearanceTab() {
  const { theme, setTheme } = useTheme()
  const compactMode = useSettingsStore((s) => s.compactMode)
  const setCompactMode = useSettingsStore((s) => s.setCompactMode)

  // next-themes liefert das Theme erst nach dem Mount (Hydration-Schutz)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            OMNIDESK ist für den Dark Mode gebaut – Light und System stehen
            trotzdem zur Verfügung.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mounted && (
            <>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">
                    <Moon className="size-4" /> Dunkel
                  </SelectItem>
                  <SelectItem value="light">
                    <Sun className="size-4" /> Hell
                  </SelectItem>
                  <SelectItem value="system">
                    <Monitor className="size-4" /> System
                  </SelectItem>
                </SelectContent>
              </Select>

              <div className="mt-4">
                <Label className="text-xs text-muted-foreground">
                  Live-Vorschau – ein Klick wendet das Theme sofort an
                </Label>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  {THEME_PREVIEWS.map((p) => {
                    const active = theme === p.value
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setTheme(p.value)}
                        className={`rounded-lg border p-2 text-left transition-colors hover:border-primary/60 ${
                          active ? 'border-primary ring-1 ring-primary' : 'border-border'
                        }`}
                      >
                        <div className={`flex h-16 overflow-hidden rounded-md border ${p.frame}`}>
                          <div className={`w-5 shrink-0 ${p.sidebar}`} />
                          <div className="flex flex-1 flex-col gap-1 p-1.5">
                            <div className={`h-2 w-3/4 rounded-sm ${p.titleBar}`} />
                            <div className={`flex-1 rounded-sm border ${p.card}`} />
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 pt-2 text-xs font-medium">
                          {p.icon}
                          {p.label}
                          {active && <Check className="size-3.5 shrink-0 text-primary" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kompakt-Modus</CardTitle>
          <CardDescription>
            Reduziert Abstände app-weit für maximale Informationsdichte.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <Label htmlFor="compact-switch" className="text-sm">
            Abstände verringern
          </Label>
          <Switch
            id="compact-switch"
            checked={compactMode}
            onCheckedChange={setCompactMode}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dashboard-Widgets</CardTitle>
          <CardDescription>
            Sichtbarkeit und Anordnung der Widgets auf der Einsatzzentrale anpassen.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Widgets lassen sich direkt auf der Einsatzzentrale per Drag & Drop oder über den Widget-Manager anordnen.
          </p>
          <DashboardCustomizerDialog
            trigger={
              <Button variant="outline" size="sm" className="shrink-0 gap-2">
                <SlidersHorizontal className="size-4" /> Widgets verwalten
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
