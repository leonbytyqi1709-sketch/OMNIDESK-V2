import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface DashboardState {
  /** Gespeicherte Reihenfolge aller Widget-IDs */
  widgetOrder: string[]
  /** Manuell ausgeblendete Widgets */
  hiddenWidgets: string[]
  /** Sichtbarkeit eines einzelnen Widgets umschalten */
  toggleWidget: (id: string) => void
  /** Sichtbarkeit gezielt setzen */
  setWidgetVisible: (id: string, visible: boolean) => void
  /** Widget in der Reihenfolge um einen Schritt verschieben (-1 = nach oben/vorne, +1 = nach unten/hinten) */
  moveWidget: (id: string, direction: -1 | 1) => void
  /** Gesamte Reihenfolge neu setzen (z. B. nach Drag & Drop) */
  reorderWidgets: (newOrder: string[]) => void
  /** Anordnung und Sichtbarkeit auf den Ausgangszustand zurücksetzen */
  resetToDefault: () => void
}

export const DEFAULT_WIDGET_ORDER: string[] = [
  'greeting',
  'quick-stats',
  'cloud-storage',
  'uptime',
  'pomodoro',
  'tasks',
  'appointments',
  'timezones',
  'notes',
  'links',
  'projects',
  'shared-rooms',
  'mission-control',
]

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      widgetOrder: DEFAULT_WIDGET_ORDER,
      hiddenWidgets: [],

      toggleWidget: (id: string) => {
        const { hiddenWidgets } = get()
        set({
          hiddenWidgets: hiddenWidgets.includes(id)
            ? hiddenWidgets.filter((w) => w !== id)
            : [...hiddenWidgets, id],
        })
      },

      setWidgetVisible: (id: string, visible: boolean) => {
        const { hiddenWidgets } = get()
        if (visible) {
          set({ hiddenWidgets: hiddenWidgets.filter((w) => w !== id) })
        } else if (!hiddenWidgets.includes(id)) {
          set({ hiddenWidgets: [...hiddenWidgets, id] })
        }
      },

      moveWidget: (id: string, direction: -1 | 1) => {
        const { widgetOrder } = get()
        const currentOrder = [
          ...widgetOrder,
          ...DEFAULT_WIDGET_ORDER.filter((w) => !widgetOrder.includes(w)),
        ]
        const index = currentOrder.indexOf(id)
        if (index === -1) return

        const targetIndex = index + direction
        if (targetIndex < 0 || targetIndex >= currentOrder.length) return

        const newOrder = [...currentOrder]
        const [moved] = newOrder.splice(index, 1)
        newOrder.splice(targetIndex, 0, moved)

        set({ widgetOrder: newOrder })
      },

      reorderWidgets: (newOrder: string[]) => {
        set({ widgetOrder: newOrder })
      },

      resetToDefault: () => {
        set({
          widgetOrder: DEFAULT_WIDGET_ORDER,
          hiddenWidgets: [],
        })
      },
    }),
    {
      name: 'omnidesk:dashboard-widgets',
    },
  ),
)
