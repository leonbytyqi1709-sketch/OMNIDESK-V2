import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useApiFetch } from '@/hooks/use-api'
import type { HistorySettings } from '@/types/working-history'
export function Preferences({
  settings,
  onSaved,
}: {
  settings: HistorySettings
  onSaved: () => void
}) {
  const api = useApiFetch(),
    [values, setValues] = useState(settings),
    [busy, setBusy] = useState(false)
  async function save() {
    if (
      (values.retentionDays < settings.retentionDays ||
        values.maxVersions < settings.maxVersions) &&
      !window.confirm(
        'Aufbewahrung verkürzen? Ältere Versionen werden endgültig entfernt. Originale bleiben erhalten.',
      )
    )
      return
    setBusy(true)
    try {
      await api('/api/working-history/settings', {
        method: 'PUT',
        body: JSON.stringify(values),
      })
      onSaved()
      toast.success('Aufbewahrung gespeichert.')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function clear() {
    if (
      !window.confirm(
        'Deinen gesamten Notiz- und Aufgabenverlauf endgültig löschen? Originale bleiben erhalten. Solange die Aufzeichnung aktiv ist, werden künftige Änderungen erneut aufgezeichnet.',
      )
    )
      return
    setBusy(true)
    try {
      await api('/api/working-history', {
        method: 'DELETE',
        body: JSON.stringify({ confirm: 'Verlauf löschen' }),
      })
      onSaved()
      toast.success('Gespeicherter Verlauf gelöscht.')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <details className="rounded-lg border bg-card p-4">
      <summary className="cursor-pointer text-sm font-medium">
        Aufzeichnung und Aufbewahrung
      </summary>
      <div className="mt-4 space-y-4 text-sm">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            disabled={busy}
            checked={values.enabled}
            onChange={(e) =>
              setValues({ ...values, enabled: e.target.checked })
            }
          />
          Änderungen an Notizen und Aufgaben aufzeichnen
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2">
            Aufbewahrung
            <select
              aria-label="Aufbewahrung"
              className="rounded border bg-background p-2"
              disabled={busy}
              value={values.retentionDays}
              onChange={(e) =>
                setValues({ ...values, retentionDays: Number(e.target.value) })
              }
            >
              {[7, 30, 90, 365].map((n) => (
                <option key={n} value={n}>
                  {n} Tage
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            Versionen je Eintrag
            <select
              aria-label="Versionen je Eintrag"
              className="rounded border bg-background p-2"
              disabled={busy}
              value={values.maxVersions}
              onChange={(e) =>
                setValues({ ...values, maxVersions: Number(e.target.value) })
              }
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  Höchstens {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Es gilt die zuerst erreichte Grenze. Pausieren beendet neue
          Aufzeichnungen; gespeicherte Stände bleiben bis zum Ablauf oder
          Löschen. Anhänge, Vault-Inhalte und gemeinsame Räume werden nicht
          aufgenommen. Notiztexte bleiben privat und werden hier nicht an eine
          KI gesendet.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void save()}>
            Einstellungen speichern
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => void clear()}
          >
            Gesamten Verlauf löschen
          </Button>
        </div>
      </div>
    </details>
  )
}
