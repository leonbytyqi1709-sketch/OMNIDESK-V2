import { z } from 'zod'
import type { NeonSettings, NeonSnapshot, SqlCheck } from '../src/types/neon-monitoring'
const threshold = z.number().finite().positive().max(1e9).nullable()
export const neonSettingsSchema = z.object({
  enabled: z.boolean(), intervalMinutes: z.union([z.literal(5), z.literal(15), z.literal(60)]),
  retentionDays: z.union([z.literal(7), z.literal(30), z.literal(90)]),
  storageLimitGiB: threshold, computeLimitHours: threshold, transferLimitGiB: threshold,
  failureThreshold: z.number().int().min(1).max(10),
  sqlEnabled: z.boolean(), sqlIntervalMinutes: z.union([z.literal(15), z.literal(60), z.literal(240)]),
  sqlLatencyLimitMs: threshold, monitorIds: z.array(z.uuid()).max(3),
}).strict().refine((value) => !value.sqlEnabled || value.sqlIntervalMinutes >= value.intervalMinutes, 'SQL-Intervall muss mindestens dem Neon-Prüfintervall entsprechen')
  .refine((value) => new Set(value.monitorIds).size === value.monitorIds.length, 'Doppelte Monitorzuordnung')
export const defaultNeonSettings: NeonSettings = {
  enabled: true, intervalMinutes: 15, retentionDays: 30, storageLimitGiB: null, computeLimitHours: null,
  transferLimitGiB: null, failureThreshold: 2, sqlEnabled: false, sqlIntervalMinutes: 60,
  sqlLatencyLimitMs: null, monitorIds: [],
}
export interface AlertCondition { code: string; active: boolean | null; severity: 'warning' | 'critical'; message: string }
export function evaluateNeonAlerts(settings: NeonSettings, snapshot: NeonSnapshot | null, failures: number, sql: SqlCheck | null): AlertCondition[] {
  const over = (value: number | null | undefined, limit: number | null, divisor = 1): boolean | null =>
    limit === null ? false : value == null ? null : value / divisor >= limit
  const conditions: AlertCondition[] = [
    { code: 'api_failures', active: failures >= settings.failureThreshold, severity: 'critical', message: `Neon-Daten sind seit mindestens ${settings.failureThreshold} Prüfungen unvollständig oder nicht abrufbar.` },
    { code: 'storage', active: over(snapshot?.consumption?.projectStorageBytes, settings.storageLimitGiB, 1024 ** 3), severity: 'warning', message: 'Der konfigurierte Projektspeicher-Grenzwert wurde erreicht.' },
    { code: 'compute', active: over(snapshot?.consumption?.computeCuSeconds, settings.computeLimitHours, 3600), severity: 'warning', message: 'Der konfigurierte Compute-Verbrauch wurde erreicht (CU-h im Neon-Verbrauchszeitraum).' },
    { code: 'transfer', active: over(snapshot?.consumption?.transferBytes, settings.transferLimitGiB, 1024 ** 3), severity: 'warning', message: 'Der konfigurierte Datenübertragungs-Grenzwert wurde erreicht.' },
    { code: 'compute_disabled', active: snapshot?.endpoints == null ? null : snapshot.endpoints.some((endpoint) => endpoint.disabled), severity: 'warning', message: 'Ein zugeordneter Compute-Endpunkt ist deaktiviert.' },
    { code: 'sql_failure', active: !settings.sqlEnabled ? false : sql == null ? null : sql.status !== 'up', severity: 'critical', message: 'Der SQL-Funktionstest ist fehlgeschlagen oder nicht ausführbar.' },
    { code: 'sql_latency', active: !settings.sqlEnabled ? false : sql?.status !== 'up' ? null : over(sql.latencyMs, settings.sqlLatencyLimitMs), severity: 'warning', message: 'Die Laufzeit des SQL-Funktionstests überschreitet den eingestellten Grenzwert.' },
  ]
  return conditions
}
export function freshness(lastSuccessAt: string | null, intervalMinutes: number, now = Date.now()) {
  if (!lastSuccessAt) return 'unknown' as const
  return now - new Date(lastSuccessAt).getTime() > intervalMinutes * 2 * 60_000 ? 'stale' as const : 'fresh' as const
}
export function schedulerInterval() {
  const value = Number(process.env.NEON_SCHEDULER_INTERVAL_MINUTES ?? 1440)
  return Number.isInteger(value) && value >= 5 && value <= 1440 ? value : 1440
}
