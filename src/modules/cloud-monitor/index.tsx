import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AlertTriangle, Cloud, HardDrive, Plus, Server, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCloudOverview } from './api'
import { AccountCard } from './components/AccountCard'
import { AddAccountDialog } from './components/AddAccountDialog'

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

export default function CloudMonitorPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data, isLoading, error } = useCloudOverview()
  const [providerFilter, setProviderFilter] = useState<'all' | 'google' | 'mega' | 'microsoft'>('all')
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  // Benachrichtigung bei OAuth Rückkehr
  useEffect(() => {
    const connected = searchParams.get('connected')
    const err = searchParams.get('error')
    const email = searchParams.get('email')

    if (connected === 'google' || connected === 'microsoft') {
      toast.success(`${connected === 'microsoft' ? 'Microsoft' : 'Google'}-Konto ${email ? `(${email})` : ''} erfolgreich verknüpft!`)
      searchParams.delete('connected')
      if (email) searchParams.delete('email')
      setSearchParams(searchParams, { replace: true })
    } else if (err) {
      toast.error(err)
      searchParams.delete('error')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const summary = data?.summary
  const accounts = data?.accounts ?? []

  const filteredAccounts = accounts.filter((acc) => {
    if (providerFilter === 'all') return true
    return acc.provider === providerFilter
  })

  const totalPercent = summary
    ? getUsagePercent(summary.totalUsedBytes, summary.totalCapacityBytes)
    : 0

  const googlePercent = summary
    ? getUsagePercent(summary.googleUsedBytes, summary.googleCapacityBytes)
    : 0

  const megaPercent = summary
    ? getUsagePercent(summary.megaUsedBytes, summary.megaCapacityBytes)
    : 0

  // Schwellenwert-Prüfung für Alarme
  const criticalAccounts = accounts.filter(
    (a) => getUsagePercent(a.storageUsedBytes, a.storageTotalBytes) >= 90,
  )
  const warningAccounts = accounts.filter((a) => {
    const p = getUsagePercent(a.storageUsedBytes, a.storageTotalBytes)
    return p >= 80 && p < 90
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header mit Titel und Hinzufügen-Aktion */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Cloud-Monitoring
            </h1>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              Multi-Cloud
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Live-Überwachung von Speicherkapazitäten über Google Drive, OneDrive und MEGA.
          </p>
        </div>

        <Button
          onClick={() => setAddDialogOpen(true)}
          className="bg-gradient-accent glow text-white gap-2 shadow-md shrink-0 self-start sm:self-auto"
        >
          <Plus className="size-4" />
          Konto verknüpfen
        </Button>
      </div>

      {/* Speicher-Schwellenwert-Alarme (Storage Alerts) */}
      {criticalAccounts.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive shadow-sm">
          <AlertTriangle className="size-5 shrink-0 animate-pulse" />
          <div className="min-w-0 flex-1">
            <span className="font-semibold">Kritischer Speicheralarm:</span>{' '}
            {criticalAccounts.length === 1
              ? `Das Konto „${criticalAccounts[0].label || criticalAccounts[0].email}“ ist zu über 90% voll.`
              : `${criticalAccounts.length} Konten haben die 90%-Kapazitätsgrenze überschritten.`}{' '}
            Bitte bereinige Daten, um Upload-Blockaden zu verhindern.
          </div>
        </div>
      )}

      {warningAccounts.length > 0 && criticalAccounts.length === 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3.5 text-sm text-amber-400 shadow-sm">
          <AlertTriangle className="size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="font-semibold">Speicher-Warnung:</span>{' '}
            {warningAccounts.length === 1
              ? `Das Konto „${warningAccounts[0].label || warningAccounts[0].email}“ ist zu über 80% ausgelastet.`
              : `${warningAccounts.length} Konten nähern sich der 80%-Kapazitätsgrenze.`}
          </div>
        </div>
      )}

      {/* Aggregierte Statistik-Kacheln */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Gesamtspeicher */}
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Gesamter Speicherplatz
              </CardTitle>
              <Server className="size-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-foreground">
                {formatBytes(summary.totalUsedBytes)}{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  / {formatBytes(summary.totalCapacityBytes)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{summary.accountsCount} Konten verbunden</span>
                <span className="font-semibold text-foreground">{totalPercent}%</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-gradient-accent transition-all duration-300"
                  style={{ width: `${Math.max(2, totalPercent)}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Google Drive Konten */}
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Google Drive
              </CardTitle>
              <HardDrive className="size-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-foreground">
                {formatBytes(summary.googleUsedBytes)}{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  / {formatBytes(summary.googleCapacityBytes)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{summary.googleCount} Accounts konfiguriert</span>
                <span className="font-semibold text-foreground">{googlePercent}%</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${Math.max(2, googlePercent)}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">OneDrive</CardTitle>
              <Cloud className="size-4 text-sky-400" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-foreground">{formatBytes(summary.microsoftUsedBytes)} <span className="text-xs font-normal text-muted-foreground">/ {formatBytes(summary.microsoftCapacityBytes)}</span></div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{summary.microsoftCount} Accounts konfiguriert</span><span>{getUsagePercent(summary.microsoftUsedBytes, summary.microsoftCapacityBytes)}%</span></div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-sky-500" style={{ width: `${getUsagePercent(summary.microsoftUsedBytes, summary.microsoftCapacityBytes)}%` }} /></div>
            </CardContent>
          </Card>

          {/* MEGA Cloud Konten */}
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                MEGA Cloud
              </CardTitle>
              <Cloud className="size-4 text-red-400" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-foreground">
                {formatBytes(summary.megaUsedBytes)}{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  / {formatBytes(summary.megaCapacityBytes)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{summary.megaCount} Accounts konfiguriert</span>
                <span className="font-semibold text-foreground">{megaPercent}%</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-red-500 transition-all duration-300"
                  style={{ width: `${Math.max(2, megaPercent)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Filter Tabs & Konten-Übersicht */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={providerFilter}
            onValueChange={(val) => setProviderFilter(val as 'all' | 'google' | 'mega' | 'microsoft')}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 sm:w-auto">
              <TabsTrigger value="all">
                Alle ({accounts.length})
              </TabsTrigger>
              <TabsTrigger value="google">
                Google Drive ({accounts.filter((a) => a.provider === 'google').length})
              </TabsTrigger>
              <TabsTrigger value="microsoft">
                OneDrive ({accounts.filter((a) => a.provider === 'microsoft').length})
              </TabsTrigger>
              <TabsTrigger value="mega">
                MEGA ({accounts.filter((a) => a.provider === 'mega').length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <span className="text-xs text-muted-foreground">
            {filteredAccounts.length} Konten aktiv
          </span>
        </div>

        {/* Ladeanzeige oder Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-52 rounded-xl" />
            <Skeleton className="h-52 rounded-xl" />
            <Skeleton className="h-52 rounded-xl" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center text-sm text-destructive">
            Fehler beim Laden der Cloud-Daten: {error.message}
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
            <Sparkles className="size-10 text-muted-foreground/50 mb-3" />
            <h3 className="text-base font-semibold text-foreground">
              Keine Konten in dieser Ansicht
            </h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              Verknüpfe neue Konten für Google Drive, OneDrive oder MEGA, um deinen Cloud-Speicherplatz hier in Echtzeit zu überwachen.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-2"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="size-4" />
              Jetzt Konto anlegen
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAccounts.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        )}
      </div>

      <AddAccountDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />
    </div>
  )
}
