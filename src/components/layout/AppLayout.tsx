import { Suspense, useEffect, useState } from 'react'
import { Outlet } from 'react-router'
import { useSettingsStore } from '@/stores/settings'
import { useOverdueTaskNotifications } from '@/modules/tasks/api'
import { CommandPalette } from './CommandPalette'
import { FloatingScratchpad } from './FloatingScratchpad'
import { MobileHeader } from './MobileHeader'
import { ModuleLoader } from './ModuleLoader'
import { OmniBriefing } from '@/components/briefing/OmniBriefing'
import { Sidebar } from './Sidebar'

const SIDEBAR_STORAGE_KEY = 'omnidesk:sidebar-collapsed'

export function AppLayout() {
  // Überfällige Aufgaben: Browser-Notification max. 1x pro Tag (in allen Modulen aktiv)
  useOverdueTaskNotifications()

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1',
  )
  const compactMode = useSettingsStore((s) => s.compactMode)

  useEffect(() => {
    document.documentElement.dataset.compact = compactMode ? 'true' : 'false'
  }, [compactMode])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  const toggleSidebar = () => setCollapsed((prev) => !prev)

  return (
    <div className="relative flex min-h-screen flex-col md:flex-row bg-background">
      {/* Subtile ambient-glow Sphären für High-End Tiefenwirkung */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0 select-none">
        <div className="absolute -top-32 right-1/4 h-[550px] w-[550px] rounded-full bg-gradient-to-br from-[#230d8f]/12 via-[#cf0a0a]/6 to-transparent blur-3xl" />
        <div className="absolute top-2/3 -left-32 h-[450px] w-[450px] rounded-full bg-gradient-to-tr from-[#230d8f]/8 via-transparent to-transparent blur-3xl" />
      </div>

      {/* Desktop Sidebar (wird unterhalb von md ausgeblendet) */}
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />

      {/* Mobiler Header mit Hamburger-Menü & Sheet-Drawer */}
      <MobileHeader />

      {/* Hauptinhalt */}
      <main className="relative z-1 min-w-0 flex-1 overflow-x-auto">
        <OmniBriefing />
        <Suspense fallback={<ModuleLoader />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Globale Command-Palette (Strg + K / Cmd + K) */}
      <CommandPalette />

      {/* Floating Scratchpad (Strg + Shift + S) */}
      <FloatingScratchpad />
    </div>
  )
}
