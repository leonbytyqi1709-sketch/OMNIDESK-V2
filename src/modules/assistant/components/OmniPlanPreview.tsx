import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { OMNI_OPERATION_LABEL, OMNI_PLAN_STATUS } from '@/lib/omni-labels'
import type { OmniActionPlan } from '@/types/omni-actions'

interface OmniPlanPreviewProps {
  plan: OmniActionPlan
  expired: boolean
  /** Wird beim Öffnen eines Links aufgerufen, etwa um den Dialog zu schließen. */
  onNavigate?: () => void
  /** Kompakt für den Chatverlauf: ohne Überschrift und Auftragszeile. */
  compact?: boolean
}

/**
 * Die Änderungen eines Vorschlags, Schritt für Schritt mit Vorher und Nachher.
 * Dieselbe Darstellung im Aktionen-Dialog und im Chat – ein Vorschlag soll
 * überall gleich aussehen.
 */
export function OmniPlanPreview({
  plan,
  expired,
  onNavigate,
  compact = false,
}: OmniPlanPreviewProps) {
  return (
    <>
      {!compact && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              {plan.status === 'executed' ? 'Ergebnis' : 'Dein Änderungsvorschlag'}
            </h3>
            <Badge variant="outline">
              {OMNI_PLAN_STATUS[expired ? 'expired' : plan.status]}
            </Badge>
          </div>
          <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
            Auftrag: {plan.prompt}
          </p>
        </>
      )}
      {plan.previews.map((preview, index) => (
        <div
          key={index}
          className="min-w-0 space-y-3 rounded-lg border border-border p-3"
        >
          <p className="text-xs text-primary">
            {index + 1}. {OMNI_OPERATION_LABEL[preview.kind] ?? preview.kind}
          </p>
          <p className="break-words text-sm font-semibold">{preview.target}</p>
          {preview.changes.map((change, i) => (
            <div key={i} className="min-w-0 text-xs">
              <p className="mb-1 text-muted-foreground">{change.label}</p>
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
              onClick={onNavigate}
              className="text-xs underline underline-offset-4"
            >
              Bestehenden Eintrag öffnen
            </Link>
          )}
        </div>
      ))}
    </>
  )
}
