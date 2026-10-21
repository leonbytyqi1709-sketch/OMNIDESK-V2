import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useApiFetch } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
type Runtime = {
  lastError?: { message?: string }
  sendMessage: (
    id: string,
    message: unknown,
    callback: (reply?: { ok?: boolean; error?: string }) => void,
  ) => void
}
export function BrowserPairing() {
  const cache = useQueryClient()
  const [params, setParams] = useSearchParams(),
    api = useApiFetch(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [success, setSuccess] = useState(false)
  const extensionId = params.get('extensionId') ?? '',
    challenge = params.get('challenge') ?? '',
    requested = params.has('extensionId') || params.has('challenge')
  if (!requested && !success) return null
  const valid =
    /^[a-p]{32}$/.test(extensionId) && /^[a-f0-9]{64}$/.test(challenge)
  async function connect() {
    if (!valid || busy) return
    setBusy(true)
    setMessage('')
    try {
      const runtime = (window as unknown as { chrome?: { runtime?: Runtime } })
        .chrome?.runtime
      if (!runtime?.sendMessage)
        throw Error(
          'Die Chrome-Erweiterung ist hier nicht erreichbar. Installiere sie und starte die Verbindung aus ihrem Seitenpanel.',
        )
      const { code } = await api<{ code: string }>('/api/browser/pair', {
        method: 'POST',
        body: JSON.stringify({ challenge }),
      })
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(
          () =>
            reject(
              Error(
                'Erweiterung antwortet nicht. Verbindung erneut aus dem Seitenpanel starten.',
              ),
            ),
          30000,
        )
        runtime.sendMessage(
          extensionId,
          { type: 'OMNIDESK_PAIR', code, challenge },
          (reply) => {
            window.clearTimeout(timer)
            if (runtime.lastError || !reply?.ok)
              reject(
                Error(
                  reply?.error ??
                    'Erweiterung nicht erreichbar. Bitte aus dem Seitenpanel neu verbinden.',
                ),
              )
            else resolve()
          },
        )
      })
      void cache.invalidateQueries({ queryKey: ['browser-devices'] })
      setSuccess(true)
      setMessage(
        'Erweiterung verbunden. Wechsle zu deiner Webseite und öffne das OMNIDESK-Seitenpanel.',
      )
      setParams({}, { replace: true })
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Verbindung fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader>
        <CardTitle>Chrome-Erweiterung verbinden</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Du erlaubst dieser Erweiterung, deine Browser-Notizen zu lesen,
          anzulegen, zu bearbeiten und zu löschen sowie deine Projektnamen für
          die Zuordnung zu laden. Andere OMNIDESK-Module werden damit nicht
          freigegeben. Der Zugang gilt 30 Tage und lässt sich unten jederzeit
          widerrufen.
        </p>
        {!success && (
          <Button disabled={!valid || busy} onClick={() => void connect()}>
            {busy ? 'Verbindet…' : 'Erweiterung ausdrücklich freigeben'}
          </Button>
        )}
        {!valid && requested && (
          <p role="alert" className="text-sm text-destructive">
            Ungültige Anfrage. Verbindung aus dem Erweiterungs-Panel erneut
            starten.
          </p>
        )}
        {message && (
          <p
            role={success ? 'status' : 'alert'}
            className={`text-sm ${success ? 'text-emerald-400' : 'text-destructive'}`}
          >
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
