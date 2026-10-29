import { toast } from 'sonner'
import { create } from 'zustand'
import { FOCUS_MAX_SECONDS, FOCUS_MIN_SECONDS, type FocusSessionInput, type FocusTarget } from '@/lib/focus'
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
  /** Woran gerade gearbeitet wird; bleibt über Modulwechsel und Reload erhalten. */
  target: FocusTarget | null
  /**
   * Fertige Fokusblöcke, die noch nicht auf dem Server liegen. Der Timer darf
   * nichts senden – er kennt kein Anmeldetoken; das übernimmt der Recorder in
   * der Oberfläche und räumt die Einträge danach weg.
   */
  pending: FocusSessionInput[]
  setTarget: (target: FocusTarget | null) => void
  dropPending: (id: string) => void
  start: () => void
  pause: () => void
  reset: () => void
  /** Aktuelle Phase überspringen */
  skip: () => void
}

let intervalId: ReturnType<typeof setInterval> | null = null

/**
 * Gemessen wird mit der Wanduhr, nicht mit gezählten Ticks: Ein in den
 * Hintergrund geschobener Tab bekommt seltener Ticks, die Zeit vergeht aber
 * trotzdem. `segmentStart` ist der Beginn des laufenden Abschnitts,
 * `segmentSeconds` die Summe der bereits beendeten Abschnitte dieses Blocks.
 */
let segmentStart: number | null = null
let segmentSeconds = 0

// --- Persistenz: Timer überlebt Reload (inkl. weitergelaufener Zeit) ---
const STORAGE_KEY = 'omnidesk:pomodoro'
/** Mehr als das deutet auf eine dauerhaft fehlschlagende Übertragung hin. */
const MAX_PENDING = 50

interface Persisted {
  mode: PomodoroMode
  remaining: number
  running: boolean
  completedCycles: number
  savedAt: number
  target?: FocusTarget | null
  pending?: FocusSessionInput[]
  segmentStart?: number | null
  segmentSeconds?: number
}

type Loaded = Pick<
  PomodoroState,
  'mode' | 'remaining' | 'running' | 'completedCycles' | 'target' | 'pending'
>

const FRESH: Loaded = {
  mode: 'work',
  remaining: WORK_SECONDS,
  running: false,
  completedCycles: 0,
  target: null,
  pending: [],
}

function newSession(seconds: number, target: FocusTarget | null): FocusSessionInput {
  const rounded = Math.min(FOCUS_MAX_SECONDS, Math.round(seconds))
  return {
    id: crypto.randomUUID(),
    startedAt: new Date(Date.now() - rounded * 1000).toISOString(),
    seconds: rounded,
    target: target ? { kind: target.kind, id: target.id } : null,
  }
}

function loadPersisted(): Loaded {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) throw new Error('empty')
    const stored = JSON.parse(raw) as Persisted
    const pending = Array.isArray(stored.pending) ? stored.pending.slice(-MAX_PENDING) : []
    let remaining = stored.remaining
    segmentSeconds = Math.max(0, stored.segmentSeconds ?? 0)
    segmentStart = null

    if (stored.running) {
      // Zeit seit dem Speichern abziehen (Wanduhr statt Tick-Annahme)
      const away = Math.floor((Date.now() - stored.savedAt) / 1000)
      remaining = Math.max(0, remaining - away)
      if (stored.mode === 'work') {
        // Der Abschnitt lief beim Speichern weiter; angerechnet wird die Zeit
        // bis zum Speichern plus die Abwesenheit, höchstens bis zum Phasenende.
        const beforeSave = stored.segmentStart
          ? Math.max(0, (stored.savedAt - stored.segmentStart) / 1000)
          : 0
        segmentSeconds += beforeSave + Math.min(Math.max(0, away), stored.remaining)
        if (remaining > 0) segmentStart = Date.now()
        else if (segmentSeconds >= FOCUS_MIN_SECONDS) {
          // Die Phase ist in der Zwischenzeit abgelaufen: Block festhalten.
          pending.push(newSession(segmentSeconds, stored.target ?? null))
          segmentSeconds = 0
        }
      }
    } else if (stored.mode === 'work' && stored.segmentStart) {
      segmentSeconds += Math.max(0, (stored.savedAt - stored.segmentStart) / 1000)
    }

    return {
      mode: stored.mode === 'break' ? 'break' : 'work',
      remaining,
      running: stored.running && remaining > 0,
      completedCycles: stored.completedCycles ?? 0,
      target: stored.target ?? null,
      pending,
    }
  } catch {
    segmentStart = null
    segmentSeconds = 0
    return { ...FRESH, pending: [] }
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
      target: state.target,
      pending: state.pending,
      segmentStart,
      segmentSeconds,
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
  /** Laufenden Abschnitt beenden und seine Dauer gutschreiben. */
  const closeSegment = () => {
    if (segmentStart === null) return
    segmentSeconds += Math.max(0, (Date.now() - segmentStart) / 1000)
    segmentStart = null
  }

  /** Fokusblock abschließen; zu kurze Blöcke werden verworfen. */
  const flushSegment = () => {
    closeSegment()
    if (segmentSeconds >= FOCUS_MIN_SECONDS) {
      const session = newSession(segmentSeconds, get().target)
      set({ pending: [...get().pending, session].slice(-MAX_PENDING) })
    }
    segmentSeconds = 0
  }

  const advancePhase = (finishedNaturally: boolean) => {
    const { mode, completedCycles } = get()
    if (mode === 'work') flushSegment()
    const nextMode: PomodoroMode = mode === 'work' ? 'break' : 'work'
    set({
      mode: nextMode,
      remaining: nextMode === 'work' ? WORK_SECONDS : BREAK_SECONDS,
      completedCycles:
        mode === 'work' && finishedNaturally ? completedCycles + 1 : completedCycles,
    })
    if (nextMode === 'work' && get().running) segmentStart = Date.now()
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
    target: initial.target,
    pending: initial.pending,

    setTarget: (target) => {
      // Der Wechsel des Ziels beendet den laufenden Block, sonst landete
      // gearbeitete Zeit am falschen Eintrag.
      if (get().mode === 'work') flushSegment()
      set({ target })
      if (get().mode === 'work' && get().running) segmentStart = Date.now()
      persist(get())
    },

    dropPending: (id) => {
      set({ pending: get().pending.filter((entry) => entry.id !== id) })
      persist(get())
    },

    start: () => {
      if (get().running) return
      set({ running: true })
      if (get().mode === 'work') segmentStart = Date.now()
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
      // Pause unterbricht nur; der Block bleibt offen und läuft nach dem
      // Fortsetzen weiter.
      closeSegment()
      set({ running: false })
      persist(get())
    },

    reset: () => {
      stopTicker()
      if (get().mode === 'work') flushSegment()
      set({ mode: 'work', remaining: WORK_SECONDS, running: false })
      persist(get())
    },

    skip: () => {
      advancePhase(false)
    },
  }
})
