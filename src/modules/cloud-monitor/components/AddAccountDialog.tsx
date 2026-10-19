import { useState } from 'react'
import { Cloud, ExternalLink, HardDrive, Lock, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useConnectAccount, useGoogleAuthUrl, useMicrosoftAuthUrl } from '../api'

interface AddAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddAccountDialog({ open, onOpenChange }: AddAccountDialogProps) {
  const [provider, setProvider] = useState<'google' | 'mega' | 'microsoft'>('google')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [label, setLabel] = useState('')
  const [capacityGb, setCapacityGb] = useState('15')
  const [error, setError] = useState<string | null>(null)
  const [isOAuthRedirecting, setIsOAuthRedirecting] = useState(false)

  const connectMutation = useConnectAccount()
  const googleAuthMutation = useGoogleAuthUrl()
  const microsoftAuthMutation = useMicrosoftAuthUrl()

  const handleGoogleOAuth = async () => {
    setError(null)
    setIsOAuthRedirecting(true)
    try {
      const { url } = await googleAuthMutation.mutateAsync(window.location.pathname)
      window.location.href = url
    } catch (err) {
      setIsOAuthRedirecting(false)
      setError(err instanceof Error ? err.message : 'Google OAuth URL konnte nicht geladen werden.')
    }
  }

  const handleMicrosoftOAuth = async () => {
    setError(null)
    setIsOAuthRedirecting(true)
    try {
      const { url } = await microsoftAuthMutation.mutateAsync(window.location.pathname)
      window.location.href = url
    } catch (err) {
      setIsOAuthRedirecting(false)
      setError(err instanceof Error ? err.message : 'Microsoft-Anmeldung konnte nicht gestartet werden.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (provider === 'microsoft') return

    if (!email.trim() || !email.includes('@')) {
      setError('Bitte eine gültige E-Mail-Adresse eingeben.')
      return
    }

    const totalBytes = (parseFloat(capacityGb || (provider === 'google' ? '15' : '20')) * 1024 * 1024 * 1024).toString()

    try {
      await connectMutation.mutateAsync({
        provider,
        email: email.trim(),
        password: password.trim() ? password : undefined,
        label: label.trim() || (provider === 'google' ? 'Google Drive' : 'MEGA Cloud'),
        storageTotalBytes: totalBytes,
      })
      setEmail('')
      setPassword('')
      setLabel('')
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Konto konnte nicht hinzugefügt werden.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {provider !== 'mega' ? (
              <HardDrive className="size-5 text-blue-500" />
            ) : (
              <Cloud className="size-5 text-red-500" />
            )}
            Cloud-Konto verknüpfen
          </DialogTitle>
          <DialogDescription>
            Füge ein Google Drive-, OneDrive- oder MEGA-Konto für das Speicherkapazitäts-Monitoring hinzu.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="provider">Anbieter</Label>
            <Select
              value={provider}
              onValueChange={(val) => {
                const nextProvider = val as 'google' | 'mega' | 'microsoft'
                setProvider(nextProvider)
                setCapacityGb(nextProvider === 'google' ? '15' : '20')
                setPassword('')
                setError(null)
                setIsOAuthRedirecting(false)
              }}
            >
              <SelectTrigger id="provider">
                <SelectValue placeholder="Anbieter wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google">Google Drive (OAuth2)</SelectItem>
                <SelectItem value="microsoft">Microsoft OneDrive (privat / geschäftlich)</SelectItem>
                <SelectItem value="mega">MEGA Cloud (20 GB Live & Demo)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Google OAuth Schnellverbindung */}
          {provider === 'google' && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3.5 text-xs space-y-2.5">
              <div className="flex items-center justify-between font-semibold text-foreground">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="size-4 text-blue-400" />
                  Offizielles Google OAuth2 Login
                </span>
                <span className="text-[10px] text-blue-400 font-normal">Empfohlen</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Verknüpfe dein Google-Konto sicher über den offiziellen Google-Zustimmungsbildschirm. Die Speicherauslastung wird über Google Drive abgerufen.
              </p>
              <Button
                type="button"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white gap-2 text-xs h-9 shadow-sm"
                onClick={handleGoogleOAuth}
                disabled={isOAuthRedirecting}
              >
                <ExternalLink className="size-3.5" />
                {isOAuthRedirecting ? 'Weiterleitung zu Google...' : 'Mit Google verbinden'}
              </Button>
              <div className="rounded border border-blue-500/20 bg-blue-500/5 p-2 text-[11px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-blue-400">Tipp bei Fehler 403 (Testphase):</span> Trage das gewünschte Google-Konto in deiner Google Cloud Console unter &bdquo;OAuth-Zustimmungsbildschirm &rarr; Testnutzer&ldquo; ein, oder nutze unten die manuelle Erfassung.
              </div>
            </div>
          )}

          {provider === 'google' && (
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-card px-2 text-muted-foreground">Oder manuell erfassen</span>
              </div>
            </div>
          )}

          {provider === 'microsoft' && (
            <div className="space-y-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3.5 text-xs">
              <p className="font-semibold">Microsoft OneDrive verbinden</p>
              <p className="text-muted-foreground">Für private Microsoft-Konten sowie Geschäfts- und Schulkonten. Die Anmeldung erfolgt bei Microsoft. OMNIDESK erhält lesenden Zugriff auf Profil und Speicherwerte, keinen Schreibzugriff auf Dateien.</p>
              <Button type="button" className="w-full gap-2" onClick={handleMicrosoftOAuth} disabled={isOAuthRedirecting}>
                <ExternalLink className="size-4" />
                {isOAuthRedirecting ? 'Weiterleitung zu Microsoft…' : 'Mit Microsoft verbinden'}
              </Button>
              <p className="text-muted-foreground">Bei Organisationskonten kann eine Administratorfreigabe erforderlich sein. Persönliche Konten können die gemeinsame Microsoft-Speicherquote melden.</p>
            </div>
          )}

          {provider !== 'microsoft' && <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="account-email">Account-E-Mail</Label>
              <Input
                id="account-email"
                type="email"
                placeholder={provider === 'google' ? 'dein.name@gmail.com' : 'dein.name@mega.nz'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {provider === 'mega' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="account-password">MEGA-Passwort (optional für Live-Sync)</Label>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Lock className="size-3" /> Nur für Sitzungsschlüssel
                  </span>
                </div>
                <Input
                  id="account-password"
                  type="password"
                  placeholder="MEGA Account-Passwort"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Wird live zur Authentifizierung bei MEGA genutzt. Es wird kein Klartext-Passwort dauerhaft gespeichert.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="account-label">Bezeichnung / Label (optional)</Label>
              <Input
                id="account-label"
                placeholder={provider === 'google' ? 'z. B. Google Drive #3 (Backups)' : 'z. B. MEGA Offsite'}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="account-capacity">Gesamtspeicherplatz (GB)</Label>
              <Input
                id="account-capacity"
                type="number"
                min="1"
                max="100000"
                value={capacityGb}
                onChange={(e) => setCapacityGb(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={connectMutation.isPending}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                className="bg-gradient-accent glow text-white"
                disabled={connectMutation.isPending}
              >
                {connectMutation.isPending ? 'Wird verknüpft...' : 'Konto hinzufügen'}
              </Button>
            </DialogFooter>
          </form>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
