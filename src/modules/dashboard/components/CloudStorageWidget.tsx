import { useState } from 'react'
import { AlertTriangle, Cloud, HardDrive, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { showOneDrive } from '@/lib/cloud-providers'
import { cn } from '@/lib/utils'
import { useCloudOverview, useSyncAccount } from '@/modules/cloud-monitor/api'
import { WidgetCard } from './WidgetCard'

function formatBytes(bytesStr: string): string {
  const bytes = parseFloat(bytesStr || '0')
  if (isNaN(bytes) || bytes === 0) return '0 GB'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1000) {
    return `${(gb / 1024).toFixed(1)} TB`
  }
  return `${gb.toFixed(1)} GB`
}

function getPercent(usedStr: string, totalStr: string): number {
  const used = parseFloat(usedStr || '0')
  const total = parseFloat(totalStr || '1')
  if (isNaN(used) || isNaN(total) || total <= 0) return 0
  return Math.min(100, Math.round((used / total) * 1000) / 10)
}

/** Bento-Widget: Aggregierte Cloud-Speicherauslastung über die angebotenen Anbieter. */
export function CloudStorageWidget() {
  const { data, isLoading } = useCloudOverview()
  const syncMutation = useSyncAccount()
  const [isSyncingAll, setIsSyncingAll] = useState(false)

  const summary = data?.summary
  const accounts = data?.accounts ?? []

  const totalUsed = summary?.totalUsedBytes ?? '0'
  const totalCap = summary?.totalCapacityBytes ?? '0'
  const overallPercent = getPercent(totalUsed, totalCap)

  // Schwellenwert-Prüfung über alle Konten
  const criticalAccounts = accounts.filter(
    (a) => getPercent(a.storageUsedBytes, a.storageTotalBytes) >= 90,
  )
  const warningAccounts = accounts.filter(
    (a) =>
      getPercent(a.storageUsedBytes, a.storageTotalBytes) >= 80 &&
      getPercent(a.storageUsedBytes, a.storageTotalBytes) < 90,
  )

  const handleSyncAll = async () => {
    if (accounts.length === 0 || isSyncingAll) return
    setIsSyncingAll(true)
    try {
      await Promise.all(accounts.map((acc) => syncMutation.mutateAsync(acc.id)))
      toast.success('Alle Cloud-Speicherdaten erfolgreich synchronisiert!')
    } catch {
      toast.error('Fehler bei der Synchronisation einiger Konten.')
    } finally {
      setIsSyncingAll(false)
    }
  }

  return (
    <WidgetCard
      title={`Cloud-Speicher (${accounts.length} Konten)`}
      icon={Cloud}
      to="/cloud-monitor"
    >
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-2 w-full rounded" />
          <Skeleton className="h-10 w-full rounded" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-2">
          <p className="text-xs text-muted-foreground">
            Noch kein Cloud-Konto verbunden.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Füllstand & Prozent */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">
                {formatBytes(totalUsed)} belegt
              </span>
              <span className="text-muted-foreground">
                von {formatBytes(totalCap)} ({overallPercent}%)
              </span>
            </div>

            {/* Balken */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  'h-full transition-all duration-500',
                  criticalAccounts.length > 0
                    ? 'bg-destructive glow-strong'
                    : warningAccounts.length > 0
                      ? 'bg-amber-500'
                      : 'bg-gradient-accent glow',
                )}
                style={{ width: `${Math.max(4, overallPercent)}%` }}
              />
            </div>
          </div>

          {/* Speicher-Schwellenwert-Alarm falls vorhanden */}
          {criticalAccounts.length > 0 ? (
            <div className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span className="truncate">
                {criticalAccounts.length} Konto über 90% voll!
              </span>
            </div>
          ) : warningAccounts.length > 0 ? (
            <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-400">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span className="truncate">
                {warningAccounts.length} Konto über 80% Auslastung.
              </span>
            </div>
          ) : null}

          {/* Provider-Übersicht & Mini-Sync */}
          <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
              <span className="flex items-center gap-1">
                <HardDrive className="size-3 text-blue-400" />
                Drive: {formatBytes(summary?.googleUsedBytes ?? '0')}
              </span>
              {showOneDrive(summary?.microsoftCount ?? 0) && <span className="flex items-center gap-1"><Cloud className="size-3 text-sky-400" />OneDrive: {formatBytes(summary?.microsoftUsedBytes ?? '0')}</span>}
              <span className="flex items-center gap-1">
                <Cloud className="size-3 text-red-400" />
                MEGA: {formatBytes(summary?.megaUsedBytes ?? '0')}
              </span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground hover:text-foreground"
              onClick={handleSyncAll}
              disabled={isSyncingAll}
              title="Alle Konten jetzt live synchronisieren"
            >
              <RefreshCw
                className={cn('size-3', isSyncingAll && 'animate-spin text-primary')}
              />
            </Button>
          </div>
        </div>
      )}
    </WidgetCard>
  )
}
