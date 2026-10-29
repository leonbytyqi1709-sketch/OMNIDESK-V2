import { addDays, addMonths, addWeeks } from 'date-fns'

/**
 * Serientermine.
 *
 * Gerechnet wird in Ortszeit (`date-fns` arbeitet auf der lokalen Zeitzone,
 * serverseitig `TZ=Europe/Berlin`): Ein Termin um 9 Uhr bleibt über die
 * Zeitumstellung hinweg um 9 Uhr und wandert nicht auf 8 oder 10 Uhr.
 *
 * Die Termine werden bei der Anlage einzeln erzeugt und liegen als ganz
 * normale Termine in der Datenbank. Kalender, Terminliste, Suche,
 * Verknüpfungen und die Buchungsprüfung sehen deshalb nichts Besonderes —
 * nur die Zugehörigkeit zur Serie steht in einer eigenen Tabelle.
 */

export const RECURRENCE_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const

export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number]

export interface RecurrenceRule {
  frequency: RecurrenceFrequency
  /** Jede n-te Einheit: 2 bei „alle zwei Wochen“. */
  interval: number
  /** Nur bei wöchentlich: Wochentage 0 (So) bis 6 (Sa). Leer = Tag des Starttermins. */
  weekdays: number[]
  /** Ende der Serie: nach n Terminen oder an einem Datum (einschließlich). */
  ends: { type: 'count'; count: number } | { type: 'until'; until: string }
}

/** Mehr Termine legt eine Serie nicht an – schützt vor einem Tippfehler im Intervall. */
export const MAX_OCCURRENCES = 200

/** Weiter als zwei Jahre im Voraus wird nichts erzeugt. */
export const MAX_HORIZON_MONTHS = 24

export const FREQUENCY_LABEL: Record<RecurrenceFrequency, string> = {
  daily: 'Täglich',
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
}

export const WEEKDAY_LABEL = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

/** Lesbare Zusammenfassung, etwa „Alle 2 Wochen · Mo, Do · 10 Termine“. */
export function describeRule(rule: RecurrenceRule): string {
  const unit =
    rule.frequency === 'daily' ? 'Tage' : rule.frequency === 'weekly' ? 'Wochen' : 'Monate'
  const rhythm =
    rule.interval === 1 ? FREQUENCY_LABEL[rule.frequency] : `Alle ${rule.interval} ${unit}`
  const parts = [rhythm]
  if (rule.frequency === 'weekly' && rule.weekdays.length > 0)
    parts.push([...rule.weekdays].sort().map((day) => WEEKDAY_LABEL[day]).join(', '))
  parts.push(
    rule.ends.type === 'count'
      ? `${rule.ends.count} Termine`
      : `bis ${new Date(rule.ends.until).toLocaleDateString('de-DE')}`,
  )
  return parts.join(' · ')
}

function sameClockTime(reference: Date, day: Date) {
  const result = new Date(day)
  result.setHours(
    reference.getHours(),
    reference.getMinutes(),
    reference.getSeconds(),
    reference.getMilliseconds(),
  )
  return result
}

/**
 * Alle Startzeitpunkte einer Serie, beginnend mit dem Starttermin selbst.
 *
 * Monatlich bedeutet „gleicher Tag im Monat“. Monate, die diesen Tag nicht
 * haben, werden übersprungen — der 31. landet also nicht im Februar und auch
 * nicht ersatzweise auf dem 28. Das ist die Variante ohne Überraschungen.
 */
export function occurrences(start: Date, rule: RecurrenceRule): Date[] {
  const interval = Math.max(1, Math.min(52, Math.floor(rule.interval)))
  const limit =
    rule.ends.type === 'count'
      ? Math.max(1, Math.min(MAX_OCCURRENCES, Math.floor(rule.ends.count)))
      : MAX_OCCURRENCES
  const horizon = addMonths(start, MAX_HORIZON_MONTHS)
  const until =
    rule.ends.type === 'until'
      ? new Date(Math.min(new Date(`${rule.ends.until}T23:59:59.999`).getTime(), horizon.getTime()))
      : horizon

  const result: Date[] = []
  const push = (date: Date) => {
    if (date.getTime() < start.getTime() || date.getTime() > until.getTime()) return
    result.push(date)
  }

  if (rule.frequency === 'weekly') {
    const days = rule.weekdays.length > 0 ? [...new Set(rule.weekdays)].sort() : [start.getDay()]
    // Beginn der Woche des Starttermins (Sonntag), damit alle gewählten Tage
    // einer Woche dieselbe Woche treffen.
    const weekStart = addDays(start, -start.getDay())
    for (let week = 0; result.length < limit; week += 1) {
      const base = addWeeks(weekStart, week * interval)
      if (base.getTime() > until.getTime() + 7 * 86_400_000) break
      for (const day of days) {
        if (result.length >= limit) break
        push(sameClockTime(start, addDays(base, day)))
      }
      if (week > 520) break
    }
  } else {
    for (let step = 0; result.length < limit; step += 1) {
      const date =
        rule.frequency === 'daily'
          ? addDays(start, step * interval)
          : addMonths(start, step * interval)
      if (date.getTime() > until.getTime()) break
      // addMonths schiebt den 31. auf das Monatsende; solche Monate überspringen.
      if (rule.frequency === 'monthly' && date.getDate() !== start.getDate()) continue
      push(sameClockTime(start, date))
      if (step > MAX_OCCURRENCES * 12) break
    }
  }

  return result.sort((one, other) => one.getTime() - other.getTime()).slice(0, limit)
}
