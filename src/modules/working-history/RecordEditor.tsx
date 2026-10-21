import { useState, type FormEvent } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useApiFetch } from '@/hooks/use-api'
import type {
  MissionRecord,
  MissionRecordInput,
  MissionReference,
} from '@/types/mission-records'
import type { HistoryKind } from '@/types/working-history'
import { kindLabels, recordTextLabels, recordStateLabels } from './presentation'
const control = 'w-full min-w-0 rounded-md border bg-background p-3 text-sm'
export function RecordEditor({
  record,
  projectId,
  onSaved,
  onCancel,
}: {
  record: MissionRecord | null
  projectId: string
  onSaved: (id: string) => void
  onCancel: () => void
}) {
  const api = useApiFetch(),
    { userId } = useAuth(),
    [id] = useState(() => record?.id ?? crypto.randomUUID()),
    [busy, setBusy] = useState(false)
  const [data, setData] = useState<MissionRecordInput>(() =>
    record
      ? {
          title: record.title,
          projectId: record.projectId,
          state: record.state,
          context: record.context,
          decisions: record.decisions,
          questions: record.questions,
          nextSteps: record.nextSteps,
          outcome: record.outcome,
          sources: record.sources
            .filter((s) => s.available)
            .map(({ kind, id }) => ({ kind, id })),
        }
      : {
          title: '',
          projectId: projectId || null,
          state: 'paused',
          context: '',
          decisions: '',
          questions: '',
          nextSteps: '',
          outcome: '',
          sources: [],
        },
  )
  const [baseVersion] = useState(record?.version)
  const [labels, setLabels] = useState<MissionReference[]>(
      record?.sources.filter((s) => s.available) ?? [],
    ),
    [kind, setKind] = useState<HistoryKind>('note'),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('')
  const projects = useQuery({
    queryKey: ['mission-record-projects', userId],
    queryFn: () =>
      api<{ id: string; name: string }[]>('/api/mission-records/projects'),
  })
  const choices = useQuery({
    queryKey: ['mission-record-choices', userId, kind, filter],
    queryFn: () =>
      api<{ sources: MissionReference[]; limited: boolean }>(
        '/api/mission-records/sources?' +
          new URLSearchParams({ kind, search: filter }),
      ),
    retry: false,
  })
  async function save(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const result = await api<{ id: string }>(
        '/api/mission-records' + (record ? '/' + id : ''),
        {
          method: record ? 'PUT' : 'POST',
          body: JSON.stringify(
            record ? { version: baseVersion, data } : { id, data },
          ),
        },
      )
      onSaved(result.id)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      onSubmit={save}
      className="space-y-5 rounded-xl border bg-card p-4 md:p-6"
    >
      <h2 className="text-lg font-semibold">
        {record ? 'Arbeitsstand bearbeiten' : 'Arbeitsstand festhalten'}
      </h2>
      <label className="grid gap-2 text-sm">
        Titel
        <Input
          aria-label="Titel des Arbeitsstands"
          required
          maxLength={300}
          disabled={busy}
          value={data.title}
          onChange={(e) => setData({ ...data, title: e.target.value })}
        />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-2 text-sm">
          Projekt
          <select
            aria-label="Projekt des Arbeitsstands"
            className={control}
            disabled={busy}
            value={data.projectId ?? ''}
            onChange={(e) =>
              setData({ ...data, projectId: e.target.value || null })
            }
          >
            <option value="">Ohne Projekt</option>
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {projects.isError && (
            <span role="alert">Projektliste konnte nicht geladen werden.</span>
          )}
        </label>
        <label className="grid gap-2 text-sm">
          Stand
          <select
            aria-label="Stand des Vorhabens"
            className={control}
            disabled={busy}
            value={data.state}
            onChange={(e) =>
              setData({
                ...data,
                state: e.target.value as MissionRecordInput['state'],
              })
            }
          >
            {Object.entries(recordStateLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {Object.entries(recordTextLabels).map(([key, label]) => (
        <label key={key} className="grid gap-2 text-sm">
          {label}
          <textarea
            aria-label={label}
            className={control}
            rows={3}
            maxLength={5000}
            required={key === 'outcome' && data.state === 'archived'}
            disabled={busy}
            value={data[key as keyof typeof recordTextLabels]}
            onChange={(e) => setData({ ...data, [key]: e.target.value })}
          />
        </label>
      ))}
      <section className="space-y-3 rounded-lg border p-3">
        <h3 className="font-medium">
          Eigene Originalquellen verknüpfen · {data.sources.length}/30
        </h3>
        <p className="text-xs text-muted-foreground">
          Es werden Verweise gespeichert. Quelltexte werden nicht kopiert.
          Entfernte oder nicht mehr zugängliche Quellen werden später ohne
          Inhalt angezeigt. Gemeinsame Räume und Vault-Inhalte sind
          ausgeschlossen.
        </p>
        <div className="space-y-2">
          {labels.map((s) => (
            <div
              key={s.kind + s.id}
              className="flex items-start justify-between gap-2 text-sm"
            >
              <span className="min-w-0 break-words">{s.title}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setLabels((old) =>
                    old.filter((v) => v.kind !== s.kind || v.id !== s.id),
                  )
                  setData({
                    ...data,
                    sources: data.sources.filter(
                      (v) => v.kind !== s.kind || v.id !== s.id,
                    ),
                  })
                }}
              >
                Entfernen
              </Button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Quellenbereich"
            className={control + ' sm:w-auto'}
            value={kind}
            onChange={(e) => setKind(e.target.value as HistoryKind)}
          >
            {Object.entries(kindLabels).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <Input
            aria-label="Quelle nach Titel suchen"
            className="min-w-0 flex-1 basis-44"
            maxLength={200}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Quelle suchen …"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setFilter(search)}
          >
            Quellen suchen
          </Button>
        </div>
        {choices.isError && (
          <p role="alert" className="text-sm">
            {choices.error.message}
          </p>
        )}
        <div className="max-h-52 space-y-2 overflow-y-auto">
          {choices.data?.sources
            .filter(
              (s) =>
                !data.sources.some((v) => v.kind === s.kind && v.id === s.id),
            )
            .map((s) => (
              <button
                type="button"
                key={s.kind + s.id}
                disabled={busy || data.sources.length >= 30}
                className="block w-full rounded border p-2 text-left text-sm hover:bg-secondary/40 disabled:opacity-50"
                onClick={() => {
                  setLabels((old) => [...old, s])
                  setData({
                    ...data,
                    sources: [...data.sources, { kind: s.kind, id: s.id }],
                  })
                }}
              >
                {s.title}
              </button>
            ))}
        </div>
        {choices.data?.limited && (
          <p className="text-xs text-muted-foreground">
            50 Treffer angezeigt. Mit Suche eingrenzen.
          </p>
        )}
      </section>
      <p className="text-xs text-muted-foreground">
        Dieser Arbeitsstand ist deine eigene Dokumentation. Er setzt beim
        Wiederaufnehmen keine früheren Aufgaben, Webseiten oder
        Infrastrukturzustände zurück. Ein Archivabschluss verändert den
        Projektstatus nicht.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy}>
          {data.state === 'archived'
            ? 'Im Missionsarchiv speichern'
            : 'Arbeitsstand speichern'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onCancel}
        >
          Abbrechen
        </Button>
      </div>
    </form>
  )
}
