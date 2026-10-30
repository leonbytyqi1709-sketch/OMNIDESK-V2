import { toast } from 'sonner'
import { registerSW } from 'virtual:pwa-register'

/**
 * Hält die installierte App auf dem ausgelieferten Stand.
 *
 * OMNIDESK ist eine PWA: Ein Service Worker legt die Oberfläche in einen
 * eigenen Zwischenspeicher. Zweimal hat das dazu geführt, dass im Browser
 * tagelang alte Fassungen liefen, obwohl die neue längst ausgeliefert war —
 * zuletzt sogar in einer Sackgasse, aus der sich die App nicht selbst
 * befreien konnte.
 *
 * Deshalb verlässt sie sich nicht mehr auf den Worker allein. Jeder Start
 * vergleicht die eingebaute Baustand-Kennung mit `/version.json` vom Server.
 * Stimmen sie nicht überein, läuft eine veraltete Fassung: Zwischenspeicher
 * und Worker werden entfernt und die Seite einmal neu geladen. Das greift
 * auch dann, wenn der Worker selbst klemmt.
 */

/** Verhindert eine Schleife, falls die Erneuerung den Unterschied nicht behebt. */
const HEAL_FLAG = 'omnidesk:build-healed'

async function serverBuild(): Promise<string | null> {
  try {
    // Mit Zeitstempel und ohne Zwischenspeicher, damit weder Browser noch
    // Netz eine alte Antwort liefern.
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    })
    if (!response.ok) return null
    const data = (await response.json()) as { build?: unknown }
    return typeof data.build === 'string' ? data.build : null
  } catch {
    // Offline oder kein Netz: Dann bleibt eben, was da ist.
    return null
  }
}

/** Entfernt Zwischenspeicher und Worker und lädt die Seite neu. */
async function renew() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }
    if ('caches' in window) {
      const names = await caches.keys()
      await Promise.all(names.map((name) => caches.delete(name)))
    }
  } catch {
    // Auch ohne vollständiges Aufräumen ist das Neuladen besser als nichts.
  }
  window.location.reload()
}

/**
 * Prüft den Baustand. Beim Start wird eine veraltete Fassung sofort und
 * stillschweigend erneuert; später im Betrieb erscheint nur ein Hinweis,
 * damit niemandem mitten im Tippen die Seite wegläuft.
 */
async function checkBuild(atStart: boolean) {
  const current = await serverBuild()
  if (!current || current === __APP_BUILD__) return

  if (atStart) {
    if (sessionStorage.getItem(HEAL_FLAG)) {
      // Schon einmal erneuert und immer noch verschieden: nicht weiter
      // neu laden, sondern den Weg über den Hinweis gehen.
      console.warn('[OMNIDESK] Baustand weicht weiterhin ab:', __APP_BUILD__, '≠', current)
    } else {
      sessionStorage.setItem(HEAL_FLAG, '1')
      await renew()
      return
    }
  }

  toast('Neue Fassung von OMNIDESK verfügbar', {
    id: 'omnidesk-update',
    description: 'Neu laden, um sie zu benutzen.',
    duration: Infinity,
    action: { label: 'Neu laden', onClick: () => void renew() },
  })
}

export function watchForAppUpdates() {
  if (typeof window === 'undefined') return

  void checkBuild(true)

  if ('serviceWorker' in navigator)
    registerSW({
      immediate: true,
      onRegisteredSW(_url, registration) {
        if (!registration) return
        setInterval(() => void registration.update().catch(() => {}), 30 * 60 * 1000)
      },
    })

  // Beim Zurückwechseln in den Tab erneut nachsehen – dann aber nur mit
  // Hinweis statt mit Neuladen.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void checkBuild(false)
  })
}
