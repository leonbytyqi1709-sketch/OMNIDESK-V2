import { toast } from 'sonner'
import { create } from 'zustand'
import { requestNotificationPermission, sendBrowserNotification } from '@/lib/notifications'

export const WORK_SECONDS = 25 * 60
export const BREAK_SECONDS = 5 * 60

export type PomodoroMode = 'work' | 'break'

interface PomodoroState {
  mode: PomodoroMode
  remaining: number
  running: boolean
  /** Abgeschlossene Fokus-Blöcke in dieser Sitzung */
  completedCycles: number
  start: () => void
  pause: () => void
  reset: () => void
  /** Aktuelle Phase überspringen */
  skip: () => void
}

let intervalId: ReturnType<typeof setInterval> | null = null

// --- Persistenz: Timer überlebt Reload (inkl. weitergelaufener Zeit) ---
const STORAGE_KEY = 'omnidesk:pomodoro'

interface Persisted {
  mode: PomodoroMode
  remaining: number
  running: boolean
  completedCycles: number
  savedAt: number
}

function loadPersisted(): Pick<PomodoroState, 'mode' | 'remaining' | 'running' | 'completedCycles'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) throw new Error('empty')
    const p = JSON.parse(raw) as Persisted
    let remaining = p.remaining
    if (p.running) {
      // Zeit seit dem Speichern abziehen (Wanduhr statt Tick-Annahme)
      const elapsed = Math.floor((Date.now() - p.savedAt) / 1000)
      remaining = Math.max(0, remaining - elapsed)
    }
    return {
      mode: p.mode === 'break' ? 'break' : 'work',
      remaining,
      running: p.running && remaining > 0,
      completedCycles: p.completedCycles ?? 0,
    }
  } catch {
    return { mode: 'work', remaining: WORK_SECONDS, running: false, completedCycles: 0 }
  }
}

function persist(state: PomodoroState) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      mode: state.mode,
      remaining: state.remaining,
      running: state.running,
      completedCycles: state.completedCycles,
      savedAt: Date.now(),
    } satisfies Persisted),
  )
}

function stopTicker() {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
}

/**
 * Globaler Pomodoro-Store: Der Timer lebt außerhalb der React-Komponenten
 * und läuft daher beim Navigieren zwischen Modulen einfach weiter.
 * Zustand wird in localStorage gesichert und nach einem Reload
 * (inkl. bereits vergangener Zeit) automatisch fortgesetzt.
 */
export const usePomodoroStore = create<PomodoroState>((set, get) => {
  const advancePhase = (finishedNaturally: boolean) => {
    const { mode, completedCycles } = get()
    const nextMode: PomodoroMode = mode === 'work' ? 'break' : 'work'
    set({
      mode: nextMode,
      remaining: nextMode === 'work' ? WORK_SECONDS : BREAK_SECONDS,
      completedCycles:
        mode === 'work' && finishedNaturally ? completedCycles + 1 : completedCycles,
    })
    persist(get())
    if (finishedNaturally) {
      const message =
        nextMode === 'break'
          ? 'Fokus-Block geschafft – 5 Minuten Pause!'
          : 'Pause vorbei – zurück in den Fokus.'
      toast(message)
      // Browser-Notification zusätzlich zum In-App-Toast (auch sichtbar, wenn der Tab im Hintergrund liegt)
      void sendBrowserNotification('OMNIDESK – Pomodoro', {
        body: message,
        tag: 'pomodoro-phase-end',
      })
    }
  }

  const initial = loadPersisted()

  // Nach Reload direkt weiterlaufen lassen, falls der Timer lief
  if (initial.running) {
    setTimeout(() => {
      if (usePomodoroStore.getState().running) get().start()
    }, 0)
  }

  return {
    mode: initial.mode,
    remaining: initial.remaining,
    running: false,
    completedCycles: initial.completedCycles,

    start: () => {
      if (get().running) return
      set({ running: true })
      persist(get())
      // Berechtigung für Browser-Notifications beim Timer-Start anfragen (User-Geste)
      void requestNotificationPermission()
      intervalId = setInterval(() => {
        const { remaining } = get()
        if (remaining <= 1) {
          advancePhase(true)
        } else {
          set({ remaining: remaining - 1 })
          persist(get())
        }
      }, 1000)
    },

    pause: () => {
      stopTicker()
      set({ running: false })
      persist(get())
    },

    reset: () => {
      stopTicker()
      set({ mode: 'work', remaining: WORK_SECONDS, running: false })
      persist(get())
    },

    skip: () => {
      advancePhase(false)
    },
  }
})
