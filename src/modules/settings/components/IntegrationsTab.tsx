import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { CheckCircle2, Cloud, ExternalLink, HardDrive, Info, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AddAccountDialog } from '@/modules/cloud-monitor/components/AddAccountDialog'
import { useCloudOverview, useDeleteAccount, useGoogleAuthUrl, useSyncAccount } from '@/modules/cloud-monitor/api'
import { cn } from '@/lib/utils'

function formatBytes(bytesStr: string): string {
  const bytes = parseFloat(bytesStr || '0')
  if (isNaN(bytes) || bytes === 0) return '0 GB'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1000) {
    return `${(gb / 1024).toFixed(1)} TB`
  }
  return `${gb.toFixed(1)} GB`
}

export function IntegrationsTab() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data, isLoading } = useCloudOverview()
  const deleteMutation = useDeleteAccount()
  const syncMutation = useSyncAccount()
  const googleAuthMutation = useGoogleAuthUrl()
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)

  // Benachrichtigung bei OAuth Rückkehr
  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    const email = searchParams.get('email')

    if (connected === 'google') {
      toast.success(`Google-Konto ${email ? `(${email})` : ''} erfolgreich verknüpft!`)
      searchParams.delete('connected')
      if (email) searchParams.delete('email')
      setSearchParams(searchParams, { replace: true })
    } else if (error) {
      toast.error(error)
      searchParams.delete('error')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const accounts = data?.accounts ?? []
  const googleAccounts = accounts.filter((a) => a.provider === 'google')
  const megaAccounts = accounts.filter((a) => a.provider === 'mega')

  const handleGoogleConnect = async () => {
    try {
      const { url } = await googleAuthMutation.mutateAsync('/settings')
      window.location.href = url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Google OAuth URL konnte nicht geladen werden.')
    }
  }

  const handleSync = async (id: string) => {
    setSyncingId(id)
    try {
      await syncMutation.mutateAsync(id)
      toast.success('Speicherdaten erfolgreich synchronisiert!')
    } catch {
      toast.error('Synchronisation fehlgeschlagen.')
    } finally {
      setSyncingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Hinweis zur Einrichtung */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="size-4 text-primary" />
            OAuth2 & Cloud-Schnittstellen (Phase 4)
          </CardTitle>
          <CardDescription>
            Verwalte deine Live-Verbindungen für Google Drive und MEGA Cloud.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3 text-xs text-muted-foreground">
            <p className="max-w-xl">
              Verknüpfe echte Konten per sicherem Google OAuth2 oder Live-MEGA-Sitzung. Die Daten fließen automatisch in das Cloud-Monitoring ein. (Tipp bei Fehler 403: Im Google-Testmodus müssen weitere Konten in der Cloud Console als Testnutzer eingetragen sein).
            </p>
            <Button
              size="sm"
              className="bg-gradient-accent glow text-white gap-1.5"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="size-4" />
              Konto manuell / MEGA
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Google Integration */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <HardDrive className="size-4 text-blue-400" />
                Google Drive
              </CardTitle>
              <CardDescription className="pt-1">
                Verbindung zu Google Drive zum Abrufen der Speicherkapazität.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs"
              >
                {googleAccounts.length} Konten aktiv
              </Badge>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-500 text-white gap-1.5 text-xs h-8"
                onClick={handleGoogleConnect}
                disabled={googleAuthMutation.isPending}
              >
                <ExternalLink className="size-3.5" />
                {googleAuthMutation.isPending ? 'Verbinde...' : 'Mit Google verbinden'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Konten werden geladen...</p>
          ) : googleAccounts.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Noch kein Google-Konto verknüpft. Klicke auf &quot;Mit Google verbinden&quot; für den Live-OAuth-Login.
            </p>
          ) : (
            <div className="space-y-2">
              {googleAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between rounded-md border border-border/50 bg-secondary/20 p-2.5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-400" />
                    <div>
                      <span className="font-semibold text-foreground">
                        {acc.label || acc.email}
                      </span>
                      <span className="ml-2 text-muted-foreground">({acc.email})</span>
                      {Boolean(acc.metadata?.liveConnected) && (
                        <span className="ml-2 text-[10px] text-blue-400 font-medium">● Live OAuth</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-mono">
                      {formatBytes(acc.storageUsedBytes)} / {formatBytes(acc.storageTotalBytes)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      onClick={() => handleSync(acc.id)}
                      disabled={syncingId === acc.id}
                      title="Speicherplatz jetzt synchronisieren"
                    >
                      <RefreshCw
                        className={cn(
                          'size-3.5',
                          syncingId === acc.id && 'animate-spin text-primary',
                        )}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(acc.id)}
                      disabled={deleteMutation.isPending}
                      aria-label="Konto entfernen"
                      title="Konto trennen"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MEGA Integration */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Cloud className="size-4 text-red-400" />
                MEGA Cloud
              </CardTitle>
              <CardDescription className="pt-1">
                Live-Speichermonitoring für MEGA-Cloud-Konten.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs"
              >
                {megaAccounts.length} Konten aktiv
              </Badge>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8 gap-1.5"
                onClick={() => setAddDialogOpen(true)}
              >
                <Plus className="size-3.5" />
                MEGA-Konto hinzufügen
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Konten werden geladen...</p>
          ) : megaAccounts.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Noch kein MEGA-Konto verknüpft.
            </p>
          ) : (
            <div className="space-y-2">
              {megaAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between rounded-md border border-border/50 bg-secondary/20 p-2.5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-400" />
                    <div>
                      <span className="font-semibold text-foreground">
                        {acc.label || acc.email}
                      </span>
                      <span className="ml-2 text-muted-foreground">({acc.email})</span>
                      {Boolean(acc.metadata?.liveConnected) && (
                        <span className="ml-2 text-[10px] text-red-400 font-medium">● Live Sync</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-mono">
                      {formatBytes(acc.storageUsedBytes)} / {formatBytes(acc.storageTotalBytes)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      onClick={() => handleSync(acc.id)}
                      disabled={syncingId === acc.id}
                      title="Speicherplatz jetzt synchronisieren"
                    >
                      <RefreshCw
                        className={cn(
                          'size-3.5',
                          syncingId === acc.id && 'animate-spin text-primary',
                        )}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(acc.id)}
                      disabled={deleteMutation.isPending}
                      aria-label="Konto entfernen"
                      title="Konto trennen"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddAccountDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </div>
  )
}
