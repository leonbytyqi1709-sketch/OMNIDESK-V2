import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * Zeitrechnung des Fokus-Timers.
 *
 * Gemessen wird mit der Wanduhr, nicht mit gezählten Sekunden-Ticks: Ein Tab
 * im Hintergrund bekommt seltener Ticks, die Zeit vergeht aber trotzdem.
 * Diese Prüfungen laufen ohne Browser, deshalb werden localStorage und die
 * Uhr ersetzt.
 */

function installBrowserStubs() {
  const store = new Map<string, string>()
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorage,
    configurable: true,
    writable: true,
  })

  const realNow = Date.now
  let current = Date.parse('2026-10-29T09:00:00.000Z')
  Date.now = () => current
  return {
    store,
    advance: (seconds: number) => {
      current += seconds * 1000
    },
    restore: () => {
      Date.now = realNow
    },
  }
}

/**
 * Lädt das Timer-Modul neu. Der Timer hält seine Abschnittszeiten im Modul,
 * nicht im React-Baum; ein frischer Import entspricht dem Neuladen der Seite
 * und liest den Zustand aus localStorage zurück.
 */
async function freshStore() {
  const module = await import(`../src/stores/pomodoro.ts?v=${Math.random()}`)
  return module.usePomodoroStore as typeof import('../src/stores/pomodoro').usePomodoroStore
}

/** Frischer Start ohne Altlasten aus dem vorigen Fall. */
async function emptyStore(clock: { store: Map<string, string> }) {
  clock.store.clear()
  return freshStore()
}

test('Fokus-Zeitrechnung', async (t) => {
  const clock = installBrowserStubs()
  try {
    await t.test('ein abgeschlossener Block landet mit seiner Dauer in der Warteschlange', async () => {
      const useStore = await emptyStore(clock)
      const { start, skip } = useStore.getState()
      start()
      clock.advance(90)
      skip()
      const { pending } = useStore.getState()
      assert.equal(pending.length, 1)
      assert.equal(pending[0].seconds, 90)
      assert.equal(pending[0].target, null)
      // Der Startzeitpunkt liegt genau eine Blocklänge zurück.
      assert.equal(Date.parse(pending[0].startedAt), Date.now() - 90_000)
      useStore.getState().reset()
    })

    await t.test('Pausen zählen nicht mit, Fortsetzen schon', async () => {
      const useStore = await emptyStore(clock)
      useStore.getState().setTarget({ kind: 'task', id: 'a'.repeat(8), title: 'Angebot' })
      useStore.getState().start()
      clock.advance(120)
      useStore.getState().pause()
      clock.advance(600) // Pause – darf nicht gezählt werden
      useStore.getState().start()
      clock.advance(60)
      useStore.getState().reset()

      const { pending } = useStore.getState()
      assert.equal(pending.length, 1)
      assert.equal(pending[0].seconds, 180)
      assert.deepEqual(pending[0].target, { kind: 'task', id: 'a'.repeat(8) })
    })

    await t.test('zu kurze Blöcke werden verworfen', async () => {
      const useStore = await emptyStore(clock)
      useStore.getState().start()
      clock.advance(40)
      useStore.getState().reset()
      assert.deepEqual(useStore.getState().pending, [])
    })

    await t.test('ein Zielwechsel schließt den laufenden Block ab', async () => {
      const useStore = await emptyStore(clock)
      useStore.getState().setTarget({ kind: 'project', id: 'p'.repeat(8), title: 'Umzug' })
      useStore.getState().start()
      clock.advance(300)
      useStore.getState().setTarget({ kind: 'task', id: 't'.repeat(8), title: 'Andere Arbeit' })
      clock.advance(120)
      useStore.getState().reset()

      const { pending } = useStore.getState()
      assert.deepEqual(
        pending.map((entry) => [entry.seconds, entry.target?.kind]),
        [
          [300, 'project'],
          [120, 'task'],
        ],
        'Die Zeit vor dem Wechsel gehört zum alten Ziel',
      )
    })

    await t.test('gesendete Blöcke verschwinden aus der Warteschlange', async () => {
      const useStore = await emptyStore(clock)
      useStore.getState().start()
      clock.advance(120)
      useStore.getState().reset()
      const [entry] = useStore.getState().pending
      useStore.getState().dropPending(entry.id)
      assert.deepEqual(useStore.getState().pending, [])
    })

    await t.test('ein Reload verliert die laufende Zeit nicht', async () => {
      const useStore = await emptyStore(clock)
      useStore.getState().setTarget({ kind: 'task', id: 'r'.repeat(8), title: 'Nach dem Reload' })
      useStore.getState().start()
      clock.advance(200)
      // Kein pause(), kein reset(): So sieht es aus, wenn der Tab einfach
      // neu geladen wird. Der Store wird danach frisch aufgebaut.
      clock.advance(100)
      const reloaded = await freshStore()
      assert.notEqual(reloaded, useStore, 'Der Import muss ein frisches Modul liefern')
      // Der alte Timer lebt im Test weiter (im Browser wäre die Seite weg);
      // sein Ticker muss gestoppt werden, sonst endet der Testlauf nie.
      useStore.getState().pause()
      clock.advance(60)
      reloaded.getState().reset()

      const { pending } = reloaded.getState()
      assert.equal(pending.length, 1)
      assert.ok(
        pending[0].seconds >= 350 && pending[0].seconds <= 365,
        `Erwartet rund 360 Sekunden, gezählt wurden ${pending[0].seconds}`,
      )
    })
  } finally {
    clock.restore()
  }
})
