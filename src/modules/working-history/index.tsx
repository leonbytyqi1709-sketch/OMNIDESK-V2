import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { History, ArrowLeft, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useApiFetch } from '@/hooks/use-api'
import type {
  HistoryEntry,
  HistoryKind,
  HistorySettings,
} from '@/types/working-history'
import { Records } from './Records'
import { Inspector } from './Inspector'
import { Preferences } from './Preferences'
import { date, kindLabels, operationLabel } from './presentation'
function WorkingHistory({ userId }: { userId: string }) {
  const api = useApiFetch(),
    cache = useQueryClient(),
    [params, setParams] = useSearchParams(),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState(''),
    [historyEpoch, setHistoryEpoch] = useState(0)
  const kind = params.get('kind') as HistoryKind | null,
    id = params.get('object'),
    missions = params.get('view') === 'missions',
    valid = !!kind && Object.hasOwn(kindLabels, kind)
  const settings = useQuery({
    queryKey: ['history-settings', userId],
    queryFn: () => api<HistorySettings>('/api/working-history/settings'),
    retry: false,
  })
  const timeline = useQuery({
    queryKey: ['working-history', userId, 'timeline', kind, filter],
    queryFn: () =>
      api<{ entries: HistoryEntry[]; limited: boolean }>(
        '/api/working-history?' +
          new URLSearchParams({
            ...(valid ? { kind: kind! } : {}),
            search: filter,
          }),
      ),
    retry: false,
    enabled: !id && !missions,
    refetchOnWindowFocus: true,
  })
  const refresh = () => {
    setHistoryEpoch((value) => value + 1)
    void cache.invalidateQueries({ queryKey: ['history-settings', userId] })
    void cache.resetQueries({ queryKey: ['working-history', userId] })
    void cache.removeQueries({ queryKey: ['working-comparison', userId] })
  }
  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold">
          <History className="shrink-0 text-primary" />
          Arbeitsgedächtnis
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Änderungen nachvollziehen, Stände vergleichen und ausgewählte Felder
          wiederherstellen.
        </p>
      </div>
      <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Hier beginnt die gemeinsame Zeitleiste deiner Notizen, persönlichen
        Aufgaben und Projektaufgaben. Frühere, nicht aufgezeichnete Änderungen
        sind nicht verfügbar. Unter Arbeitsstände und Missionsarchiv hältst du
        Entscheidungen, offene Fragen, nächste Schritte und Ergebnisse bewusst
        fest.
      </p>
      <div
        className="flex flex-wrap gap-2"
        aria-label="Ansicht im Arbeitsgedächtnis"
      >
        <Button
          variant={missions ? 'outline' : 'default'}
          onClick={() => setParams({})}
        >
          Änderungsverlauf
        </Button>
        <Button
          variant={missions ? 'default' : 'outline'}
          onClick={() => setParams({ view: 'missions' })}
        >
          Arbeitsstände und Missionsarchiv
        </Button>
      </div>
      {!missions && settings.isError && (
        <p role="alert">{settings.error.message}</p>
      )}
      {!missions && settings.data && !settings.isError && (
        <Preferences
          key={JSON.stringify(settings.data)}
          settings={settings.data}
          onSaved={refresh}
        />
      )}
      {missions ? (
        <Records />
      ) : id && valid ? (
        <>
          <Button variant="outline" onClick={() => setParams({})}>
            <ArrowLeft />
            Zur Zeitleiste
          </Button>
          <Inspector
            key={kind + id + historyEpoch}
            kind={kind!}
            id={id}
            enabled={settings.data?.enabled === true && !settings.isError}
          />
        </>
      ) : (
        <>
          <form
            className="flex flex-wrap gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              setFilter(search)
            }}
          >
            <Input
              aria-label="Verlauf nach Titel suchen"
              className="min-w-0 flex-1 basis-52"
              maxLength={200}
              placeholder="Nach früherem oder aktuellem Titel suchen …"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Bereich im Verlauf"
              className="min-w-0 rounded-md border bg-background p-2 text-sm"
              value={valid ? kind! : ''}
              onChange={(e) =>
                setParams(e.target.value ? { kind: e.target.value } : {})
              }
            >
              <option value="">Alle Bereiche</option>
              {Object.entries(kindLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <Button variant="outline">
              <Search className="size-4" />
              Suchen
            </Button>
          </form>
          {timeline.isPending && <p>Zeitleiste wird geladen …</p>}
          {timeline.isError && (
            <div role="alert" className="space-y-3">
              <p>{timeline.error.message}</p>
              <Button variant="outline" onClick={() => void timeline.refetch()}>
                Neu laden
              </Button>
            </div>
          )}
          {!timeline.isError && timeline.data && (
            <div className="space-y-3">
              {timeline.data.entries.map((entry) => (
                <button
                  key={entry.id}
                  className="w-full min-w-0 space-y-2 rounded-xl border bg-card p-4 text-left hover:border-primary"
                  onClick={() =>
                    setParams({ kind: entry.kind, object: entry.objectId })
                  }
                >
                  <span className="block text-xs text-muted-foreground">
                    {kindLabels[entry.kind]} · {operationLabel[entry.operation]}
                  </span>
                  <span className="block break-words font-medium">
                    {entry.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {date(entry.capturedAt)} (Berlin) · Stand {entry.revision}
                    {entry.source === 'omni' ? ' · Bestätigte Omni-Aktion' : ''}
                  </span>
                </button>
              ))}
              {timeline.data.limited && (
                <p className="text-sm text-muted-foreground">
                  Die neuesten 100 Treffer. Mit Suche und Bereich eingrenzen;
                  über das Original bleibt der Verlauf eines Eintrags direkt
                  erreichbar.
                </p>
              )}
              {!timeline.data.entries.length && (
                <p className="py-8 text-muted-foreground">
                  Noch keine passenden Änderungen. Bearbeite eine Notiz oder
                  Aufgabe, um mit der Aufzeichnung zu beginnen.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
export default function WorkingHistoryPage() {
  const { userId } = useAuth()
  return userId ? <WorkingHistory key={userId} userId={userId} /> : null
}
