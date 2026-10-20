import { useState, type FormEvent } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { useApiFetch } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MissionMonitorOptions } from '@/types/mission-control'
export function MissionConnections({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false),
    api = useApiFetch(),
    { userId } = useAuth()
  const query = useQuery({
    queryKey: ['mission-monitors', userId, projectId],
    queryFn: () =>
      api<MissionMonitorOptions>(
        `/api/mission-control/${encodeURIComponent(projectId)}/monitors`,
      ),
    enabled: open && Boolean(userId),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="text-base">
          Projektverbindungen verwalten
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Ordne vorhandene Uptime-Monitore direkt diesem Projekt zu. Neon wird
          dafür nicht benötigt.
        </p>
        <Button
          variant="outline"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? 'Monitorzuordnung schließen' : 'Uptime-Monitore zuordnen'}
        </Button>
        {open && (
          <div className="space-y-3">
            {query.isPending ? (
              <p role="status" className="text-sm">
                Monitore werden geladen…
              </p>
            ) : query.error ? (
              <div role="alert" className="space-y-2 text-sm text-destructive">
                <p>{query.error.message}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void query.refetch()}
                >
                  Zuordnungen neu laden
                </Button>
              </div>
            ) : (
              query.data && (
                <MonitorEditor
                  key={`${projectId}:${query.data.version}:${query.dataUpdatedAt}`}
                  data={query.data}
                  projectId={projectId}
                  reload={() => void query.refetch()}
                />
              )
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          GitHub-, Deployment- und Neon-Verbindungen verwenden weiterhin die
          bestehenden Integrationen.{' '}
          <Link
            className="text-primary hover:underline"
            to={`/projects?project=${encodeURIComponent(projectId)}`}
          >
            Verbindungen im Projekt öffnen →
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
function MonitorEditor({
  data,
  projectId,
  reload,
}: {
  data: MissionMonitorOptions
  projectId: string
  reload: () => void
}) {
  const [selected, setSelected] = useState(
    data.selectedIds.filter((id) => data.monitors.some((m) => m.id === id)),
  )
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const api = useApiFetch(),
    cache = useQueryClient(),
    { userId } = useAuth()
  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await api(
        `/api/mission-control/${encodeURIComponent(projectId)}/monitors`,
        {
          method: 'PUT',
          body: JSON.stringify({ monitorIds: selected, version: data.version }),
        },
      )
      toast.success('Projekt-Monitorzuordnung gespeichert.')
      await Promise.all([
        cache.invalidateQueries({
          queryKey: ['mission-control', userId, projectId],
        }),
        cache.invalidateQueries({
          queryKey: ['mission-monitors', userId, projectId],
        }),
      ])
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Zuordnung konnte nicht gespeichert werden.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      onSubmit={(e) => void save(e)}
      className="space-y-3 rounded-lg border border-border p-4"
    >
      <p className="text-xs text-muted-foreground">
        {data.origin === 'neon'
          ? 'Bisherige Neon-Zuordnung übernommen. Speichern legt eine unabhängige Projektzuordnung an.'
          : data.origin === 'direct'
            ? 'Direkte Projektzuordnung.'
            : 'Noch keine Monitore zugeordnet.'}{' '}
        Bestehende Monitore und Neon-Einstellungen werden nicht verändert.
      </p>
      <fieldset disabled={busy} className="max-h-64 space-y-3 overflow-auto">
        <legend className="mb-3 text-sm font-medium">
          Eigene Monitore · maximal 30
        </legend>
        {data.monitors.length ? (
          data.monitors.map((m) => (
            <label key={m.id} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(m.id)}
                disabled={!selected.includes(m.id) && selected.length >= 30}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, m.id]
                      : selected.filter((id) => id !== m.id),
                  )
                }
              />
              {m.name}
              {!m.active && (
                <span className="text-xs text-muted-foreground">pausiert</span>
              )}
            </label>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            Noch keine Monitore vorhanden.{' '}
            <Link className="text-primary hover:underline" to="/uptime">
              Im Uptime-Modul anlegen →
            </Link>
          </p>
        )}
      </fieldset>
      {data.selectedIds.some(
        (id) => !data.monitors.some((m) => m.id === id),
      ) && (
        <p className="text-xs text-amber-400">
          Nicht mehr verfügbare Monitore werden beim Speichern aus der Zuordnung
          entfernt.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          Monitorzuordnung speichern
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={reload}
        >
          Zuordnungen neu laden
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Eine leere Auswahl entfernt nur die Projektverbindungen. Monitore werden
        nicht gelöscht.
      </p>
    </form>
  )
}
