import { useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Cloud, HardDrive, RefreshCw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ConnectedAccountDto } from '../api'
import { useDeleteAccount, useSyncAccount } from '../api'

interface AccountCardProps {
  account: ConnectedAccountDto
}

function formatBytes(bytesStr: string): string {
  const bytes = parseFloat(bytesStr || '0')
  if (isNaN(bytes) || bytes === 0) return '0 GB'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1000) {
    return `${(gb / 1024).toFixed(1)} TB`
  }
  return `${gb.toFixed(1)} GB`
}

function getUsagePercent(usedStr: string, totalStr: string): number {
  const used = parseFloat(usedStr || '0')
  const total = parseFloat(totalStr || '1')
  if (isNaN(used) || isNaN(total) || total <= 0) return 0
  return Math.min(100, Math.round((used / total) * 1000) / 10)
}

export function AccountCard({ account }: AccountCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const syncMutation = useSyncAccount()
  const deleteMutation = useDeleteAccount()

  const percent = getUsagePercent(account.storageUsedBytes, account.storageTotalBytes)
  const isGoogle = account.provider === 'google'
  const isMicrosoft = account.provider === 'microsoft'

  // Farblogik nach Auslastung (Schwellenwert-Alarme)
  const isCritical = percent >= 90
  const isWarning = percent >= 80 && percent < 90

  const handleSync = () => {
    syncMutation.mutate(account.id, { onError: (error) => toast.error(error.message), onSuccess: () => toast.success('Speicherdaten synchronisiert') })
  }

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 4000)
      return
    }
    deleteMutation.mutate(account.id, { onError: (error) => toast.error(error.message) })
  }

  return (
    <Card className="relative flex flex-col justify-between border-border bg-card transition-all hover:border-border/80">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-lg border',
                isGoogle
                  ? 'border-blue-500/20 bg-blue-500/10 text-blue-400'
                  : isMicrosoft ? 'border-sky-500/20 bg-sky-500/10 text-sky-400' : 'border-red-500/20 bg-red-500/10 text-red-400',
              )}
            >
              {isGoogle ? (
                <HardDrive className="size-5" />
              ) : (
                <Cloud className="size-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-foreground">
                {account.label || account.email}
              </h3>
              <p className="truncate text-xs text-muted-foreground">{account.email}</p>
            </div>
          </div>

          <Badge
            variant="outline"
            className={cn(
              'shrink-0 text-xs font-semibold',
              isCritical
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : isWarning
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                  : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
            )}
          >
            {percent}% belegt
          </Badge>
        </div>

        {/* Fortschrittsbalken */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">
              {formatBytes(account.storageUsedBytes)}
            </span>
            <span className="text-muted-foreground">
              von {formatBytes(account.storageTotalBytes)}
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                'h-full transition-all duration-500',
                isCritical
                  ? 'bg-destructive glow-strong'
                  : isWarning
                    ? 'bg-amber-500'
                    : 'bg-gradient-accent glow',
              )}
              style={{ width: `${Math.max(3, percent)}%` }}
            />
          </div>

          {/* Schwellenwert-Warnhinweis */}
          {isCritical ? (
            <div className="flex items-center gap-1.5 rounded border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive font-medium">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span>Kritischer Speicher: Über 90% belegt! Bitte Daten bereinigen.</span>
            </div>
          ) : isWarning ? (
            <div className="flex items-center gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-400 font-medium">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span>Speicherwarnung: Über 80% belegt.</span>
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Aufschlüsselung Details falls vorhanden */}
        <div className="grid grid-cols-2 gap-2 rounded-md bg-secondary/30 p-2 text-xs text-muted-foreground">
          {account.metadata.driveUsage && (
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground/70">
                Drive-Dateien
              </span>
              <span className="font-medium text-foreground">
                {formatBytes(account.metadata.driveUsage as string)}
              </span>
            </div>
          )}

          {account.metadata.trashUsage && (
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground/70">
                Papierkorb
              </span>
              <span className="font-medium text-foreground">
                {formatBytes(account.metadata.trashUsage as string)}
              </span>
            </div>
          )}

          {account.metadata.filesCount && (
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground/70">
                Dateien
              </span>
              <span className="font-medium text-foreground">
                {Number(account.metadata.filesCount).toLocaleString('de-DE')}
              </span>
            </div>
          )}

          <div>
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground/70">
              Anbieter
            </span>
            <span className="font-medium text-foreground">
              {isGoogle ? 'Google Drive' : isMicrosoft ? 'OneDrive' : 'MEGA'}
            </span>
          </div>
        </div>

        {isMicrosoft && account.metadata.quotaScope === 'microsoft-unified' && (
          <p className="text-[11px] text-muted-foreground">Gemeinsame Microsoft-Speicherquote; kann neben OneDrive weitere Microsoft-Dienste enthalten.</p>
        )}
        {account.metadata.lastSyncedAt && (
          <p className="text-[11px] text-muted-foreground">Letzter Abruf: {new Date(String(account.metadata.lastSyncedAt)).toLocaleString('de-DE')}</p>
        )}
        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleSync}
            disabled={syncMutation.isPending}
          >
            <RefreshCw
              className={cn(
                'size-3.5',
                syncMutation.isPending && 'animate-spin text-primary',
              )}
            />
            {syncMutation.isPending ? 'Synchronisiert...' : 'Sync'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-8 gap-1.5 text-xs',
              confirmDelete
                ? 'text-destructive hover:bg-destructive/10'
                : 'text-muted-foreground hover:text-destructive',
            )}
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="size-3.5" />
            {confirmDelete ? 'Wirklich trennen?' : 'Trennen'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
