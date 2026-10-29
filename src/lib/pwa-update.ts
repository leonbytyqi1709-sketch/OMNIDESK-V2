import { toast } from 'sonner'
import { registerSW } from 'virtual:pwa-register'

/**
 * Aktualisierung der installierten App.
 *
 * OMNIDESK ist eine PWA: Ein Service Worker legt die Oberfläche in einen
 * eigenen Zwischenspeicher. Bis zum 29.10.2026 registrierte sich dieser
 * Worker nur und prüfte nie auf Neuerungen – nach einem Deployment lief im
 * offenen Tab weiter der alte Code, selbst nach „Neu laden“. Erst ein zweiter
 * Aufruf brachte die neue Fassung.
 *
 * Jetzt wird regelmäßig nachgesehen, und eine neue Fassung meldet sich mit
 * einem Hinweis. Neu geladen wird erst auf Klick: ein Neuladen mitten im
 * Tippen wäre schlimmer als eine Minute alter Code.
 */
export function watchForAppUpdates() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  const refresh = registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const look = () => void registration.update().catch(() => {})
      // Alle 30 Minuten und immer dann, wenn der Tab wieder nach vorn kommt.
      setInterval(look, 30 * 60 * 1000)
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) look()
      })
    },
    onNeedRefresh() {
      toast('Neue Fassung von OMNIDESK verfügbar', {
        description: 'Neu laden, um sie zu benutzen.',
        duration: Infinity,
        action: { label: 'Neu laden', onClick: () => void refresh(true) },
      })
    },
  })
}
