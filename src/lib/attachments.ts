/**
 * Dateianhänge an Notizen, Aufgaben, Projektaufgaben, Terminen, Kontakten und
 * Projekten.
 *
 * Die Dateien liegen in der eigenen Datenbank, nicht bei einem Speicherdienst.
 * Das spart eine zusätzliche Einrichtung und funktioniert sofort, setzt aber
 * enge Grenzen — siehe unten. Reicht der Platz irgendwann nicht mehr, ist der
 * Umstieg auf einen Objektspeicher die nächste Stufe; die Oberfläche bliebe
 * dabei unverändert.
 */

export const ATTACHMENT_KINDS = [
  'note',
  'task',
  'projectTask',
  'appointment',
  'contact',
  'project',
] as const

export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number]

export const ATTACHMENT_LABEL: Record<AttachmentKind, string> = {
  note: 'Notiz',
  task: 'Aufgabe',
  projectTask: 'Projektaufgabe',
  appointment: 'Termin',
  contact: 'Kontakt',
  project: 'Projekt',
}

/**
 * Drei Megabyte je Datei. Die Grenze kommt nicht von uns: Vercel nimmt auf dem
 * Hobby-Tarif höchstens rund 4,5 MB je Anfrage an, und die Datei wird für die
 * Übertragung in Base64 umgerechnet (ein Drittel mehr).
 */
export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024

/** Platz insgesamt. Die Datenbank ist nicht für Dateiberge gedacht. */
export const MAX_ATTACHMENT_TOTAL_BYTES = 50 * 1024 * 1024

/** Mehr als das an einem einzelnen Objekt ist keine Ablage mehr. */
export const MAX_ATTACHMENTS_PER_OBJECT = 20

export interface AttachmentDto {
  id: string
  name: string
  mime: string
  size: number
  createdAt: string
}

export interface AttachmentQuota {
  used: number
  limit: number
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

/**
 * Dateiname für die Ablage: ohne Pfadanteile, ohne Steuerzeichen, gekürzt.
 * Ein Name wie `../../etc/passwd` darf gar nicht erst entstehen.
 */
export function safeFileName(raw: string) {
  // Zeichenweise statt per Ausdruck: Steuerzeichen in einem regulären Ausdruck
  // sind schwer zu lesen und lösen zu Recht Warnungen aus.
  const cleaned = [...raw]
    .map((character) => (character === '/' || character === '\\' ? '_' : character))
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0
      return code >= 0x20 && code !== 0x7f
    })
    .join('')
    .replace(/^\.+/, '')
    .trim()
  return (cleaned || 'datei').slice(0, 200)
}

/** Für Content-Disposition: nur ASCII, der Rest wird ersetzt. */
export const asciiFileName = (name: string) =>
  name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
