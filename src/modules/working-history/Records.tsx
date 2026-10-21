import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useApiFetch } from '@/hooks/use-api'
import type {
  MissionRecord,
  MissionRecordSummary,
} from '@/types/mission-records'
import {
  date,
  sourceHref,
  recordStateLabels,
  recordTextLabels,
} from './presentation'
import { RecordEditor } from './RecordEditor'
function RecordDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const api = useApiFetch(),
    { userId } = useAuth(),
    cache = useQueryClient(),
    [edit, setEdit] = useState(false),
    [busy, setBusy] = useState(false)
  const query = useQuery({
    queryKey: ['mission-record', userId, id],
    queryFn: () => api<MissionRecord>('/api/mission-records/' + id),
    retry: false,
  })
  async function remove() {
    if (
      busy ||
      !query.data ||
      !window.confirm(
        'Diesen dokumentierten Arbeitsstand endgültig löschen? Verknüpfte Originale bleiben erhalten.',
      )
    )
      return
    setBusy(true)
    try {
      await api('/api/mission-records/' + id, {
        method: 'DELETE',
        body: JSON.stringify({ version: query.data.version }),
      })
      await cache.invalidateQueries({ queryKey: ['mission-records', userId] })
      onBack()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function resumed() {
    if (busy || !query.data) return
    setBusy(true)
    const r = query.data
    try {
      await api('/api/mission-records/' + id, {
        method: 'PUT',
        body: JSON.stringify({
          version: r.version,
          data: {
            title: r.title,
            projectId: r.projectId,
            state: 'active',
            context: r.context,
            decisions: r.decisions,
            questions: r.questions,
            nextSteps: r.nextSteps,
            outcome: r.outcome,
            sources: r.sources
              .filter((s) => s.available)
              .map(({ kind, id }) => ({ kind, id })),
          },
        }),
      })
      await query.refetch()
      await cache.invalidateQueries({ queryKey: ['mission-records', userId] })
      toast.success(
        'Vorhaben wieder aufgenommen. Dein dokumentierter Stand bleibt erhalten.',
      )
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (query.isPending) return <p>Arbeitsstand wird geladen …</p>
  if (query.isError || !query.data)
    return (
      <div role="alert" className="space-y-3">
        <p>{query.error?.message ?? 'Arbeitsstand nicht verfügbar.'}</p>
        <Button variant="outline" onClick={onBack}>
          Zurück
        </Button>
      </div>
    )
  const record = query.data
  if (edit)
    return (
      <RecordEditor
        record={record}
        projectId=""
        onSaved={() => {
          setEdit(false)
          void query.refetch()
          void cache.invalidateQueries({
            queryKey: ['mission-records', userId],
          })
        }}
        onCancel={() => setEdit(false)}
      />
    )
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="min-w-0 break-words text-xl font-semibold">
          {record.title}
        </h2>
        <span className="text-sm text-muted-foreground">
          {recordStateLabels[record.state]}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Gespeichert: {date(record.updatedAt)} (Berlin)
        {record.archivedAt
          ? ' · Archivabschluss: ' + date(record.archivedAt)
          : ''}
      </p>
      {record.projectId && (
        <Button variant="outline" asChild>
          <a href={'/mission-control?project=' + record.projectId}>
            Projekt in Mission Control öffnen
            {record.projectName ? ' · ' + record.projectName : ''}
          </a>
        </Button>
      )}
      {Object.entries(recordTextLabels).map(([key, label]) => (
        <section key={key} className="space-y-2">
          <h3 className="text-sm font-medium">{label}</h3>
          <p className="whitespace-pre-wrap break-words rounded-lg bg-secondary/30 p-3 text-sm">
            {record[key as keyof typeof recordTextLabels] ||
              'Nicht dokumentiert'}
          </p>
        </section>
      ))}
      <section className="space-y-2">
        <h3 className="text-sm font-medium">Verknüpfte Originalquellen</h3>
        {record.sources.map((s) =>
          s.available ? (
            <a
              className="block break-words text-sm text-primary underline"
              key={s.kind + s.id}
              href={sourceHref(s.kind, s.id, s.projectId)}
              target="_blank"
              rel="noreferrer"
            >
              {s.title}
            </a>
          ) : (
            <p key={s.kind + s.id} className="text-sm text-muted-foreground">
              Quelle entfernt oder nicht mehr zugänglich.
            </p>
          ),
        )}
        {!record.sources.length && (
          <p className="text-sm text-muted-foreground">
            Keine Quellen verknüpft.
          </p>
        )}
      </section>
      <div className="flex flex-wrap gap-2">
        {record.state !== 'active' && (
          <Button disabled={busy} onClick={() => void resumed()}>
            Vorhaben wieder aufnehmen
          </Button>
        )}
        <Button variant="outline" disabled={busy} onClick={() => setEdit(true)}>
          Arbeitsstand bearbeiten
        </Button>
        <Button variant="outline" disabled={busy} onClick={onBack}>
          Zur Übersicht
        </Button>
        <Button
          variant="destructive"
          disabled={busy}
          onClick={() => void remove()}
        >
          Arbeitsstand löschen
        </Button>
      </div>
    </div>
  )
}
export function Records() {
  const api = useApiFetch(),
    { userId } = useAuth(),
    cache = useQueryClient(),
    [params, setParams] = useSearchParams(),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState(''),
    [state, setState] = useState('')
  const id = params.get('record'),
    creating = params.has('new'),
    projectId = params.get('project') || ''
  const list = useQuery({
    queryKey: ['mission-records', userId, state, filter],
    queryFn: () =>
      api<{ records: MissionRecordSummary[]; limited: boolean }>(
        '/api/mission-records?' +
          new URLSearchParams({ ...(state ? { state } : {}), search: filter }),
      ),
    enabled: !id && !creating,
    retry: false,
  })
  const back = () => setParams({ view: 'missions' })
  if (id) return <RecordDetail key={id} id={id} onBack={back} />
  if (creating)
    return (
      <RecordEditor
        record={null}
        projectId={projectId}
        onSaved={(id) => {
          setParams({ view: 'missions', record: id })
          void cache.invalidateQueries({
            queryKey: ['mission-records', userId],
          })
        }}
        onCancel={back}
      />
    )
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Arbeitsstände und Missionsarchiv
        </h2>
        <Button onClick={() => setParams({ view: 'missions', new: '1' })}>
          Arbeitsstand festhalten
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Halte fest, wo du stehst und wie es weitergeht. Abgeschlossene Vorhaben
        findest du mit ihren Entscheidungen und Ergebnissen im Archiv.
      </p>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setFilter(search)
        }}
      >
        <Input
          aria-label="Arbeitsstände und Archiv durchsuchen"
          className="min-w-0 flex-1 basis-48"
          maxLength={200}
          placeholder="Titel, Entscheidungen, Ergebnisse oder nächste Schritte …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Archivstatus"
          className="rounded border bg-background p-2 text-sm"
          value={state}
          onChange={(e) => setState(e.target.value)}
        >
          <option value="">Alle Vorhaben</option>
          {Object.entries(recordStateLabels).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <Button variant="outline">Suchen</Button>
      </form>
      {list.isPending && <p>Arbeitsstände werden geladen …</p>}
      {list.isError && (
        <div role="alert" className="space-y-3">
          <p>{list.error.message}</p>
          <Button variant="outline" onClick={() => void list.refetch()}>
            Neu laden
          </Button>
        </div>
      )}
      {list.data && !list.isError && (
        <div className="grid min-w-0 gap-3 md:grid-cols-2">
          {list.data.records.map((r) => (
            <button
              key={r.id}
              className="min-w-0 space-y-2 rounded-xl border bg-card p-4 text-left hover:border-primary"
              onClick={() => setParams({ view: 'missions', record: r.id })}
            >
              <span className="block text-xs text-muted-foreground">
                {recordStateLabels[r.state]}
              </span>
              <span className="block break-words font-semibold">{r.title}</span>
              <span className="block break-words text-xs text-muted-foreground">
                {r.projectName || 'Ohne Projekt'} · {date(r.updatedAt)} (Berlin)
              </span>
            </button>
          ))}
          {!list.data.records.length && (
            <p className="py-6 text-muted-foreground">
              Noch keine passenden Arbeitsstände. Halte einen Stand bewusst
              fest, um später hier weiterzumachen.
            </p>
          )}
          {list.data.limited && (
            <p className="text-sm text-muted-foreground">
              Die neuesten 100 Treffer. Mit Suche und Status eingrenzen.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
