import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useApiFetch } from '@/hooks/use-api'
import type {
  HistoryComparison,
  HistoryDetail,
  HistoryField,
  HistoryKind,
} from '@/types/working-history'
import {
  date,
  fieldLabels,
  fieldsByKind,
  fieldText,
  operationLabel,
  sourceHref,
} from './presentation'
export function Inspector({
  kind,
  id,
  enabled,
}: {
  kind: HistoryKind
  id: string
  enabled: boolean
}) {
  const api = useApiFetch(),
    { userId } = useAuth(),
    cache = useQueryClient()
  const [version, setVersion] = useState(''),
    [fields, setFields] = useState<HistoryField[]>([]),
    [busy, setBusy] = useState(false)
  const detail = useQuery({
    queryKey: ['working-history', userId, kind, id],
    queryFn: () =>
      api<HistoryDetail>('/api/working-history/' + kind + '/' + id),
    retry: false,
  })
  const comparison = useQuery({
    queryKey: ['working-comparison', userId, kind, id, version],
    queryFn: () =>
      api<HistoryComparison>(
        '/api/working-history/' + kind + '/' + id + '/versions/' + version,
      ),
    enabled: !!version,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  async function restore() {
    if (
      !comparison.data ||
      !fields.length ||
      busy ||
      !window.confirm(
        'Diese Felder aus der gewählten Version übernehmen: ' +
          fields.map((f) => fieldLabels[f]).join(', ') +
          '? Der aktuelle Stand bleibt im Verlauf, soweit die Aufbewahrung es zulässt.',
      )
    )
      return
    setBusy(true)
    try {
      await api('/api/working-history/' + kind + '/' + id + '/restore', {
        method: 'POST',
        body: JSON.stringify({
          versionId: version,
          expectedFingerprint: comparison.data.current.fingerprint,
          fields,
        }),
      })
      setVersion('')
      setFields([])
      await Promise.all(
        ['working-history', 'notes', 'tasks', 'projects'].map((key) =>
          cache.invalidateQueries({ queryKey: [key] }),
        ),
      )
      toast.success('Ausgewählte Felder wiederhergestellt.')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (detail.isPending) return <p>Verlauf wird geladen …</p>
  if (detail.isError || !detail.data)
    return (
      <div role="alert" className="space-y-3 rounded-lg border p-4">
        <p>{detail.error?.message ?? 'Quelle nicht verfügbar.'}</p>
        <Button variant="outline" onClick={() => void detail.refetch()}>
          Neu laden
        </Button>
      </div>
    )
  const current = detail.data.current
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="break-words">
            {String(current.snapshot.title)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" asChild>
            <a
              href={sourceHref(kind, id, current.projectId)}
              target="_blank"
              rel="noreferrer"
            >
              Original in neuem Tab öffnen
            </a>
          </Button>
          <p className="text-sm text-muted-foreground">
            Wähle einen gespeicherten Stand. Danach kannst du einzelne
            abweichende Felder mit dem aktuellen Stand vergleichen.
          </p>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {detail.data.versions.map((v) => (
              <button
                key={v.id}
                disabled={busy}
                onClick={() => {
                  setVersion(v.id)
                  setFields([])
                }}
                className={
                  'w-full rounded-lg border p-3 text-left text-sm ' +
                  (version === v.id
                    ? 'border-primary bg-primary/10'
                    : 'hover:bg-secondary/40')
                }
              >
                <span className="font-medium">
                  Stand {v.revision} · {operationLabel[v.operation]}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {date(v.capturedAt)} (Berlin) ·{' '}
                  {v.source === 'omni'
                    ? 'Bestätigte Omni-Aktion'
                    : v.source === 'restore'
                      ? 'Gezielte Wiederherstellung'
                      : 'Änderung am Original'}
                </span>
              </button>
            ))}
          </div>
          {!detail.data.versions.length && (
            <p className="text-sm text-muted-foreground">
              Noch keine gespeicherten Versionen. Mit der nächsten inhaltlichen
              Änderung beginnt der Verlauf. Ältere, nicht erfasste Stände sind
              nicht verfügbar.
            </p>
          )}
        </CardContent>
      </Card>
      {version && (
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              Version vergleichen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {comparison.isPending && <p>Vergleich wird geladen …</p>}
            {comparison.isError && (
              <p role="alert">{comparison.error.message}</p>
            )}
            {comparison.data && !comparison.isError && (
              <>
                <p className="text-sm text-muted-foreground">
                  Vergleich mit Stand {comparison.data.version.revision} vom{' '}
                  {date(comparison.data.version.capturedAt)} (Berlin). Es wird
                  nichts automatisch ausgewählt.
                </p>
                {fieldsByKind[kind].map((field) => {
                  const before = comparison.data!.snapshot[field],
                    now = comparison.data!.current.snapshot[field],
                    different = JSON.stringify(before) !== JSON.stringify(now)
                  return (
                    <section
                      key={field}
                      className="min-w-0 space-y-3 rounded-lg border p-3"
                    >
                      <label className="flex items-start gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          aria-label={fieldLabels[field] + ' wiederherstellen'}
                          disabled={!different || busy || !enabled}
                          checked={fields.includes(field)}
                          onChange={(e) =>
                            setFields((old) =>
                              e.target.checked
                                ? [...old, field]
                                : old.filter((f) => f !== field),
                            )
                          }
                        />
                        {fieldLabels[field]}
                        {!different && (
                          <span className="font-normal text-muted-foreground">
                            · unverändert
                          </span>
                        )}
                      </label>
                      <div className="grid min-w-0 gap-3 md:grid-cols-2">
                        <div className="min-w-0">
                          <p className="mb-1 text-xs text-muted-foreground">
                            Gespeicherter Stand
                          </p>
                          <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-md bg-secondary/30 p-3 font-sans text-sm">
                            {fieldText(field, before)}
                          </pre>
                        </div>
                        <div className="min-w-0">
                          <p className="mb-1 text-xs text-muted-foreground">
                            Aktueller Stand beim Laden
                          </p>
                          <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-md bg-secondary/30 p-3 font-sans text-sm">
                            {fieldText(field, now)}
                          </pre>
                        </div>
                      </div>
                    </section>
                  )
                })}
                {!enabled && (
                  <p className="text-sm text-muted-foreground">
                    Die Aufzeichnung ist pausiert. Zum Wiederherstellen zuerst
                    aktivieren, damit auch dieser Schritt nachvollziehbar
                    bleibt.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={!fields.length || busy || !enabled}
                    onClick={() => void restore()}
                  >
                    Ausgewählte Felder wiederherstellen
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setFields([])
                      void comparison.refetch()
                    }}
                  >
                    Vergleich neu laden
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
