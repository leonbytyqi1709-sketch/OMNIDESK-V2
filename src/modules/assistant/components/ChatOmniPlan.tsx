import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Check, Loader2, WandSparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { OmniActionPlan } from '@/types/omni-actions'
import { useOmniActions } from '../api/actions'
import { OmniPlanPreview } from './OmniPlanPreview'

interface ChatOmniPlanProps {
  /** Die Nachricht, die nach einem Auftrag aussah. */
  prompt: string
  timeZone: string
}

/**
 * Ein Auftrag aus dem Chat: Omni plant ihn sofort und zeigt den Vorschlag
 * hier im Gespräch. Der Klick auf „Ausführen“ bleibt — eine falsche Aufgabe
 * oder ein falsches Datum sollen nicht unbemerkt entstehen.
 */
export function ChatOmniPlan({ prompt, timeZone }: ChatOmniPlanProps) {
  const { plan, act } = useOmniActions(false)
  const [current, setCurrent] = useState<OmniActionPlan | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const requested = useRef(false)
  const { mutate } = plan

  useEffect(() => {
    // Genau einmal planen, auch wenn der Chat neu zeichnet.
    if (requested.current) return
    requested.current = true
    mutate(
      { prompt, timeZone, requestId: crypto.randomUUID() },
      {
        onSuccess: (response) => {
          if (response.type === 'plan') setCurrent(response.plan)
        },
      },
    )
  }, [mutate, prompt, timeZone])

  if (dismissed) return null

  const expired =
    current?.status === 'pending' && Date.parse(current.expiresAt) <= Date.now()
  const pending = current?.status === 'pending' && !expired
  const busy = plan.isPending || act.isPending

  const finish = (action: 'confirm' | 'cancel') => {
    if (!current) return
    act.mutate(
      { id: current.id, action },
      {
        onSuccess: (result) => {
          if (action === 'cancel') setDismissed(true)
          else if (result && 'previews' in result) setCurrent(result)
        },
      },
    )
  }

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-primary/30 bg-secondary/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <WandSparkles className="size-3.5" />
          {plan.isPending
            ? 'Omni prüft, ob er das erledigen kann…'
            : current?.status === 'executed'
              ? 'Ausgeführt'
              : 'Omni kann das erledigen'}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground"
          onClick={() => setDismissed(true)}
          aria-label="Vorschlag ausblenden"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {plan.isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}

      {plan.error && (
        <p role="alert" className="text-xs text-destructive">
          {plan.error.message}
        </p>
      )}

      {plan.data?.type === 'clarification' && (
        <div role="status" className="text-xs">
          <p className="font-semibold">Omni fragt nach</p>
          <p className="mt-1 whitespace-pre-wrap break-words">{plan.data.message}</p>
          <p className="mt-1 text-muted-foreground">
            Schreib den Auftrag vollständig in den Chat. Es wurde nichts ausgeführt.
          </p>
        </div>
      )}

      {current && <OmniPlanPreview plan={current} expired={expired} compact />}

      {pending && (
        <>
          <p className="text-xs text-muted-foreground">
            Alle {current.previews.length} Schritte werden gemeinsam ausgeführt. Prüf
            besonders Ziel, Datum und Uhrzeit.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => finish('confirm')}>
              {act.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Check className="mr-2 size-4" />
              )}
              Ausführen
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => finish('cancel')}>
              Verwerfen
            </Button>
          </div>
        </>
      )}

      {expired && (
        <p className="text-xs text-amber-400">
          Der Vorschlag ist abgelaufen. Schreib den Auftrag noch einmal.
        </p>
      )}

      {act.error && (
        <p role="alert" className="text-xs text-destructive">
          {act.error.message}
        </p>
      )}

      {current?.status === 'executed' && (
        <div role="status" className="space-y-1">
          <p className="text-xs text-emerald-400">Erledigt.</p>
          {current.results.map((result, index) => (
            <Link
              key={index}
              to={result.href}
              className="block break-words text-xs underline underline-offset-4"
            >
              {result.title} öffnen
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
