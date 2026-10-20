import type { BriefingPreferences, BriefingRecommendation, BriefingSnapshot } from '../types/briefing'
export const DEFAULT_BRIEFING_PREFERENCES: BriefingPreferences = { timeZone: 'Europe/Berlin', showOnOpen: true, aiEnabled: true,
  sources: { tasks: true, projects: true, calendar: true, uptime: true, neon: true, security: false } }
export const BRIEFING_SOURCE_LABELS = { tasks: 'Persönliche Aufgaben', projects: 'Projekte & Projektaufgaben', calendar: 'Termine · nächste 7 Tage', uptime: 'Uptime-Monitore', neon: 'Neon-Meldungen', security: 'Kontosicherheit · Selbstauskunft' }
export const BRIEFING_COUNT_LABELS: Record<string, string> = { open: 'Offen', overdue: 'Überfällig', today: 'Heute fällig', active: 'Aktive Projekte', paused: 'Pausierte Projekte', projectTasks: 'Offene Projektaufgaben', pausedTasks: 'Davon in pausierten Projekten', milestones: 'Offene Meilensteine', upcoming: 'Anstehende / laufende Termine', todayAppointments: 'Davon mit Beginn heute', down: 'Aktuelle Störungen', stale: 'Unbekannt / veraltet', ssl: 'Zertifikatswarnungen', alerts: 'Offene Warnungen', projects: 'Zugeordnete Projekte', total: 'Dokumentierte Konten', gaps: 'Mit dokumentierten Lücken', review: 'Prüfung offen / fällig', unknown: 'Mit unbekannten Angaben' }
export const BRIEFING_REASON_LABELS = { overdue: 'Diese Fälligkeit ist bereits überschritten.', today: 'Diese Aufgabe ist heute fällig.', upcoming: 'Dieser Termin steht an oder läuft gerade.', high_priority: 'Du hast diesen offenen Punkt hoch priorisiert.', attention: 'Hier liegt eine Störung, Warnung oder veraltete Messung vor.', review: 'Hier ist eine dokumentierte Prüfung offen.' }
export function briefingDay(date: string | Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(date))
  const get = (type: string) => parts.find((part) => part.type === type)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
export function addBriefingDays(day: string, days: number) {
  const value = new Date(`${day}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10)
}
export function briefingDayStart(day: string, timeZone: string) {
  const guess = Date.parse(`${day}T00:00:00Z`)
  const offset = (stamp: number) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(stamp))
    const get = (type: string) => Number(parts.find((part) => part.type === type)!.value)
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - stamp
  }
  let result = guess - offset(guess); result = guess - offset(result)
  return new Date(result).toISOString()
}
export function defaultBriefingRecommendations(snapshot: BriefingSnapshot): BriefingRecommendation[] {
  const ranks = { attention: 0, overdue: 1, today: 2, upcoming: 3, high_priority: 4, review: 5 }
  return snapshot.sections.flatMap((section) => section.items).filter((item) => item.reasons.length)
    .map((item) => ({ sourceId: item.id, reason: [...item.reasons].sort((a, b) => ranks[a] - ranks[b])[0] }))
    .sort((a, b) => ranks[a.reason] - ranks[b.reason]).slice(0, 3)
}
