import { useAuth } from '@clerk/clerk-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Check, Loader2, RefreshCw, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useOmniActions } from '../api/actions'
import type { OmniActionPlan } from '@/types/omni-actions'
const kinds: Record<string, string> = {
  create_task: 'Persönliche Aufgabe anlegen',
  update_task: 'Persönliche Aufgabe ändern',
  create_project_task: 'Projektaufgabe anlegen',
  update_project_task: 'Projektaufgabe ändern',
  create_appointment: 'Termin anlegen',
  append_project_note: 'Projektnotiz ergänzen',
  update_appointment: 'Termin ändern',
  create_note: 'Notiz anlegen',
  append_note: 'Notiz ergänzen',
  create_contact: 'Kontakt anlegen',
  link_objects: 'Verknüpfung anlegen',
}
const statuses: Record<OmniActionPlan['status'], string> = {
  pending: 'Bestätigung ausstehend',
  executed: 'Ausgeführt',
  cancelled: 'Abgebrochen',
  expired: 'Abgelaufen',
}
export function OmniActions() {
  const { userId } = useAuth()
  return userId ? <OmniActionsForUser key={userId} /> : null
}

function OmniActionsForUser() {
  const [open, setOpen] = useState(false),
    [prompt, setPrompt] = useState(''),
    [timeZone, setTimeZone] = useState('Europe/Berlin'),
    [selected, setSelected] = useState<string | null>(null),
    [now, setNow] = useState(Date.now())
  const { history, plan, act } = useOmniActions(open)
  const attempted = useRef<{
    prompt: string
    timeZone: string
    requestId: string
  } | null>(null)
  useEffect(() => {
    if (!open) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [open])
  const active =
    history.data?.find((p) => p.id === selected) ??
    (plan.data?.type === 'plan' && plan.data.plan.id === selected
      ? plan.data.plan
      : undefined)
  const expired =
    active?.status === 'pending' && Date.parse(active.expiresAt) <= now
  const pending = active?.status === 'pending' && !expired
  const busy = plan.isPending || act.isPending
  const close = () => {
    if (!busy) setOpen(false)
  }
  const submit = () => {
    if (!prompt.trim() || busy) return
    const input = { prompt: prompt.trim(), timeZone }
    if (
      attempted.current?.prompt !== input.prompt ||
      attempted.current.timeZone !== timeZone ||
      !plan.isError
    )
      attempted.current = { ...input, requestId: crypto.randomUUID() }
    setSelected(null)
    act.reset()
    plan.mutate(attempted.current!, {
      onSuccess: (response) => {
        if (response.type === 'plan') setSelected(response.plan.id)
      },
    })
  }
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => setOpen(true)}
      >
        <WandSparkles className="mr-1.5 size-4" />
        Aktionen
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (value) setOpen(true)
          else close()
        }}
      >
        <DialogContent
          className="w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto sm:max-w-3xl"
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault()
          }}
          onPointerDownOutside={(e) => {
            if (busy) e.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <WandSparkles className="size-5 text-primary" />
              Omni-Aktionen
            </DialogTitle>
            <DialogDescription>
              Beschreibe deinen Auftrag. Omni zeigt die Änderungen; erst dein
              Klick auf „Jetzt ausführen“ setzt den Vorschlag um.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <label className="block space-y-2 text-sm">
              <span>Was soll Omni erledigen?</span>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={4000}
                rows={3}
                disabled={busy}
                placeholder={
                  'Zum Beispiel: Erstelle die persönliche Aufgabe „Backup prüfen“ für morgen mit hoher Priorität.'
                }
              />
            </label>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="space-y-1 text-xs">
                <span className="block text-muted-foreground">
                  Zeitzone für Datumsangaben
                </span>
                <select
                  className="rounded-md border border-border bg-background p-2"
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  disabled={busy}
                >
                  {[
                    'Europe/Berlin',
                    'Europe/London',
                    'America/New_York',
                    'UTC',
                  ].map((zone) => (
                    <option key={zone}>{zone}</option>
                  ))}
                </select>
              </label>
              <Button type="submit" disabled={!prompt.trim() || busy}>
                {plan.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <WandSparkles className="mr-2 size-4" />
                )}
                Vorschlag erstellen
              </Button>
            </div>
          </form>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">
              Was Omni dafür verwendet
            </summary>
            <p className="mt-2 leading-relaxed">
              Dein Auftrag sowie Titel, Status, Priorität und Fälligkeiten
              deiner letzten 200 persönlichen Aufgaben, 100 Projekte und 200
              Projektaufgaben werden an deinen bestehenden KI-Anbieter gesendet.
              Beschreibungen bestehender Einträge, Vault-Inhalte und
              Zugangsdaten werden nicht übermittelt. Gib keine Passwörter in den
              Auftrag ein. Projektaufgaben unterstützen bisher kein
              Fälligkeitsdatum; dafür fragt Omni nach einer Alternative.
              Projektnotizen werden an die Projektbeschreibung angehängt.
              Termine bleiben intern, ohne Einladungsversand.
            </p>
          </details>
          {plan.error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
            >
              {plan.error.message}
            </p>
          )}
          {plan.data?.type === 'clarification' && (
            <div
              role="status"
              className="rounded-xl border border-primary/30 bg-secondary/20 p-4"
            >
              <p className="text-sm font-semibold">Omni fragt nach</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                {plan.data.message}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Ergänze oben deinen vollständigen Auftrag und erstelle den
                Vorschlag erneut. Es wurde nichts ausgeführt.
              </p>
            </div>
          )}
          {active && (
            <section className="space-y-4 rounded-xl border border-primary/25 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  {active.status === 'executed'
                    ? 'Ergebnis'
                    : 'Dein Änderungsvorschlag'}
                </h3>
                <Badge variant="outline">
                  {statuses[expired ? 'expired' : active.status]}
                </Badge>
              </div>
              <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                Auftrag: {active.prompt}
              </p>
              {active.previews.map((preview, index) => (
                <div
                  key={index}
                  className="min-w-0 space-y-3 rounded-lg border border-border p-3"
                >
                  <p className="text-xs text-primary">
                    {index + 1}. {kinds[preview.kind] ?? preview.kind}
                  </p>
                  <p className="break-words text-sm font-semibold">
                    {preview.target}
                  </p>
                  {preview.changes.map((change, i) => (
                    <div key={i} className="min-w-0 text-xs">
                      <p className="mb-1 text-muted-foreground">
                        {change.label}
                      </p>
                      {change.before !== null && (
                        <p className="whitespace-pre-wrap break-words text-muted-foreground">
                          Bisher: {change.before}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">
                        Neu: {change.after || '(leer)'}
                      </p>
                    </div>
                  ))}
                  {preview.warning && (
                    <p className="text-xs text-amber-400">{preview.warning}</p>
                  )}
                  {preview.href && (
                    <Link
                      to={preview.href}
                      onClick={close}
                      className="text-xs underline underline-offset-4"
                    >
                      Bestehenden Eintrag öffnen
                    </Link>
                  )}
                </div>
              ))}
              {pending && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Gültig bis{' '}
                    {new Date(active.expiresAt).toLocaleString('de-DE', {
                      timeZone: active.timeZone,
                    })}{' '}
                    ({active.timeZone}). Alle {active.previews.length} Schritte
                    werden gemeinsam bestätigt. Prüfe besonders Ziel, Datum und
                    Uhrzeit.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={busy || history.isFetching}
                      onClick={() =>
                        act.mutate({ id: active.id, action: 'confirm' })
                      }
                    >
                      {act.isPending ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 size-4" />
                      )}
                      Jetzt ausführen
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        act.mutate({ id: active.id, action: 'cancel' })
                      }
                    >
                      Abbrechen
                    </Button>
                  </div>
                </>
              )}
              {expired && (
                <p className="text-xs text-amber-400">
                  Die Vorschau ist abgelaufen. Übernimm den Auftrag oben und
                  plane ihn erneut.
                </p>
              )}
              {active.status === 'executed' && (
                <div role="status" className="space-y-2">
                  <p className="text-sm text-emerald-400">
                    Erfolgreich ausgeführt.
                  </p>
                  {active.results.map((result, i) => (
                    <Link
                      key={i}
                      to={result.href}
                      onClick={close}
                      className="block break-words text-sm underline underline-offset-4"
                    >
                      {result.title} öffnen
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}
          {act.error && (
            <p role="alert" className="text-sm text-destructive">
              {act.error.message}
            </p>
          )}
          <section className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Letzte Vorschläge</h3>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy || history.isFetching}
                onClick={() => void history.refetch()}
              >
                <RefreshCw
                  className={`mr-1.5 size-3.5 ${history.isFetching ? 'animate-spin' : ''}`}
                />
                Verlauf laden
              </Button>
            </div>
            {history.error && (
              <p role="alert" className="text-xs text-destructive">
                {history.error.message}
              </p>
            )}
            {history.isLoading && (
              <p className="text-xs text-muted-foreground">
                Verlauf wird geladen…
              </p>
            )}
            {history.data?.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Noch keine Vorschläge gespeichert.
              </p>
            )}
            <ul className="max-h-60 space-y-2 overflow-auto">
              {history.data?.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={busy}
                    className="w-full rounded-lg border border-border p-3 text-left hover:bg-secondary/40 disabled:opacity-50"
                    onClick={() => {
                      setSelected(item.id)
                      act.reset()
                      plan.reset()
                      setPrompt(item.prompt)
                      setTimeZone(item.timeZone)
                    }}
                  >
                    <span className="line-clamp-2 break-words text-sm">
                      {item.prompt}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {
                        statuses[
                          item.status === 'pending' &&
                          Date.parse(item.expiresAt) <= now
                            ? 'expired'
                            : item.status
                        ]
                      }{' '}
                      ·{' '}
                      {new Date(item.createdAt).toLocaleString('de-DE', {
                        timeZone: item.timeZone,
                      })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </DialogContent>
      </Dialog>
    </>
  )
}
