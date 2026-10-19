import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type { UptimeMonitorDto } from './api'
import { useRefreshAllMonitors, useUptimeMonitors } from './api'
import { MonitorCard } from './components/MonitorCard'
import { MonitorDetailDialog } from './components/MonitorDetailDialog'
import { MonitorFormDialog } from './components/MonitorFormDialog'

export default function UptimePage() {
  const { data: monitors = [], isLoading } = useUptimeMonitors()
  const refreshAllMutation = useRefreshAllMonitors()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'up' | 'down' | 'inactive'>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingMonitor, setEditingMonitor] = useState<UptimeMonitorDto | null>(null)
  const [historyMonitor, setHistoryMonitor] = useState<UptimeMonitorDto | null>(null)

  // Statistiken
  const stats = useMemo(() => {
    const total = monitors.length
    const activeMonitors = monitors.filter((m) => m.active)
    const online = activeMonitors.filter((m) => m.lastCheck?.status === 'up').length
    const offline = activeMonitors.filter((m) => m.lastCheck?.status === 'down').length
    const inactive = total - activeMonitors.length

    // Durchschnittliche Antwortzeit (nur von erreichbaren aktiven)
    const activeWithResponse = activeMonitors.filter(
      (m) => m.lastCheck?.status === 'up' && typeof m.lastCheck?.responseTimeMs === 'number',
    )
    const avgResponseTime =
      activeWithResponse.length > 0
        ? Math.round(
            activeWithResponse.reduce(
              (acc, m) => acc + (m.lastCheck?.responseTimeMs || 0),
              0,
            ) / activeWithResponse.length,
          )
        : null

    // 30 Tage Gesamtdurchschnitt
    const avgUptime30d =
      activeMonitors.length > 0
        ? (
            activeMonitors.reduce((acc, m) => acc + m.uptime30d, 0) /
            activeMonitors.length
          ).toFixed(1)
        : '100'

    // Monitore mit auslaufendem SSL (< 14 Tage)
    const criticalSsl = activeMonitors.filter(
      (m) =>
        m.lastCheck?.sslDaysLeft !== null &&
        m.lastCheck?.sslDaysLeft !== undefined &&
        m.lastCheck.sslDaysLeft < 14,
    ).length

    return {
      total,
      online,
      offline,
      inactive,
      avgResponseTime,
      avgUptime30d,
      criticalSsl,
    }
  }, [monitors])

  // Gefilterte Liste
  const filteredMonitors = useMemo(() => {
    return monitors.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.url.toLowerCase().includes(search.toLowerCase())

      if (!matchesSearch) return false

      if (filter === 'up') return m.active && m.lastCheck?.status === 'up'
      if (filter === 'down') return m.active && m.lastCheck?.status === 'down'
      if (filter === 'inactive') return !m.active
      return true
    })
  }, [monitors, search, filter])

  const handleRefreshAll = async () => {
    try {
      await refreshAllMutation.mutateAsync()
      toast.success('Alle Monitore werden aktualisiert')
    } catch {
      toast.error('Aktualisierung fehlgeschlagen')
    }
  }

  const handleOpenNew = () => {
    setEditingMonitor(null)
    setFormOpen(true)
  }

  const handleEdit = (m: UptimeMonitorDto) => {
    setEditingMonitor(m)
    setFormOpen(true)
  }

  return (
    <div className="min-w-0 space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400 border border-emerald-500/20">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
                Uptime & Service-Health
              </h1>
              <p className="text-xs text-zinc-400">
                Live-Monitoring von Webseiten, APIs und TCP-Ports mit SSL-Zertifikatsprüfung
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={refreshAllMutation.isPending || monitors.length === 0}
            className="border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800"
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${
                refreshAllMutation.isPending ? 'animate-spin text-emerald-400' : ''
              }`}
            />
            Alle prüfen
          </Button>

          <Button
            size="sm"
            onClick={handleOpenNew}
            className="bg-gradient-accent text-white shadow-sm glow-subtle hover:brightness-110"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Neuer Monitor
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {/* Gesamt / Online */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4">
          <span className="text-xs font-medium text-zinc-400">Dienste Online</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">
              {stats.online}
            </span>
            <span className="text-xs text-zinc-500">/ {stats.total} gesamt</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-zinc-500">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            {stats.total > 0
              ? `${Math.round((stats.online / stats.total) * 100)}% verfügbar`
              : 'Keine Monitore'}
          </div>
        </div>

        {/* Störungen */}
        <div
          className={`rounded-xl border p-4 ${
            stats.offline > 0
              ? 'border-rose-900/60 bg-rose-950/20'
              : 'border-zinc-800/80 bg-zinc-900/60'
          }`}
        >
          <span className="text-xs font-medium text-zinc-400">Störungen</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold ${
                stats.offline > 0 ? 'text-rose-400' : 'text-zinc-200'
              }`}
            >
              {stats.offline}
            </span>
            {stats.inactive > 0 && (
              <span className="text-xs text-zinc-500">({stats.inactive} pausiert)</span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-zinc-500">
            {stats.offline > 0 ? (
              <>
                <XCircle className="h-3 w-3 text-rose-400" />
                <span className="text-rose-400 font-medium">Handlungsbedarf</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                <span>Alles betriebsbereit</span>
              </>
            )}
          </div>
        </div>

        {/* Ø Antwortzeit */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4">
          <span className="text-xs font-medium text-zinc-400">Ø Latenz</span>
          <div className="mt-1 flex items-baseline gap-1 font-mono">
            <span className="text-2xl font-bold text-zinc-100">
              {stats.avgResponseTime !== null ? stats.avgResponseTime : '-'}
            </span>
            <span className="text-xs text-zinc-500">ms</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-zinc-500">
            <Activity className="h-3 w-3 text-zinc-400" />
            <span>über aktive Dienste</span>
          </div>
        </div>

        {/* 30 Tage Uptime */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4">
          <span className="text-xs font-medium text-zinc-400">30-Tage-Schnitt</span>
          <div className="mt-1 flex items-baseline gap-1 font-mono">
            <span className="text-2xl font-bold text-zinc-100">
              {stats.avgUptime30d}
            </span>
            <span className="text-xs text-zinc-500">%</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-zinc-500">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            <span>System-Verfügbarkeit</span>
          </div>
        </div>

        {/* SSL-Warnungen */}
        <div
          className={`col-span-2 sm:col-span-4 lg:col-span-1 rounded-xl border p-4 ${
            stats.criticalSsl > 0
              ? 'border-amber-900/60 bg-amber-950/20'
              : 'border-zinc-800/80 bg-zinc-900/60'
          }`}
        >
          <span className="text-xs font-medium text-zinc-400">SSL-Alarm</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold ${
                stats.criticalSsl > 0 ? 'text-amber-400' : 'text-zinc-200'
              }`}
            >
              {stats.criticalSsl}
            </span>
            <span className="text-xs text-zinc-500">&lt; 14 Tage</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-zinc-500">
            {stats.criticalSsl > 0 ? (
              <>
                <AlertTriangle className="h-3 w-3 text-amber-400" />
                <span className="text-amber-400 font-medium">Zertifikate prüfen</span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-3 w-3 text-emerald-500" />
                <span>Zertifikate gültig</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Monitore durchsuchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-zinc-900/60 border-zinc-800 text-sm"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1 rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-1 text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              filter === 'all'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Alle ({monitors.length})
          </button>
          <button
            onClick={() => setFilter('up')}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              filter === 'up'
                ? 'bg-emerald-500/20 text-emerald-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Online ({stats.online})
          </button>
          <button
            onClick={() => setFilter('down')}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              filter === 'down'
                ? 'bg-rose-500/20 text-rose-400 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Offline ({stats.offline})
          </button>
          <button
            onClick={() => setFilter('inactive')}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              filter === 'inactive'
                ? 'bg-zinc-800 text-zinc-300 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Pausiert ({stats.inactive})
          </button>
        </div>
      </div>

      {/* Grid der Monitore */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl bg-zinc-900/80" />
          ))}
        </div>
      ) : filteredMonitors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800/80 p-12 text-center">
          <Activity className="mx-auto h-10 w-10 text-zinc-600 mb-3" />
          <h3 className="text-base font-medium text-zinc-200">
            {search || filter !== 'all'
              ? 'Keine passenden Monitore gefunden'
              : 'Noch keine Uptime-Monitore angelegt'}
          </h3>
          <p className="mt-1 text-xs text-zinc-500 max-w-md mx-auto">
            {search || filter !== 'all'
              ? 'Passe deine Filterkriterien oder den Suchbegriff an.'
              : 'Füge deine Webseiten, APIs oder internen TCP-Ports (SSH, DBs) hinzu, um sie kontinuierlich zu überwachen.'}
          </p>
          {!search && filter === 'all' && (
            <Button
              onClick={handleOpenNew}
              className="mt-4 bg-gradient-accent text-white"
              size="sm"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Ersten Monitor anlegen
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMonitors.map((monitor) => (
            <MonitorCard
              key={monitor.id}
              monitor={monitor}
              onEdit={handleEdit}
              onViewHistory={(m) => setHistoryMonitor(m)}
            />
          ))}
        </div>
      )}

      {/* Dialoge */}
      <MonitorFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingMonitor={editingMonitor}
      />

      <MonitorDetailDialog
        monitor={historyMonitor}
        open={!!historyMonitor}
        onOpenChange={(open) => !open && setHistoryMonitor(null)}
      />
    </div>
  )
}
