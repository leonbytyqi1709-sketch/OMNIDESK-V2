/**
 * Vorschau von Anhängen – reiner Oberflächenteil.
 *
 * Bewusst getrennt von `attachments.ts`: Diese Datei wird nur im Browser
 * gebraucht, und der Serverbau soll sie nicht mitschleppen.
 */

/** Arten, die sich im Fenster zeigen lassen. */
export type PreviewKind = 'image' | 'pdf' | 'text'

/** Textarten, die als Klartext lesbar sind. */
const TEXT_TYPES = [
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/tab-separated-values',
  'application/json',
]

/**
 * Welche Vorschau zu einem Anhang passt – `null` heißt: nur herunterladen.
 *
 * Bewusst ausgenommen bleibt alles, was ein Browser selbst ausführen würde:
 * HTML, SVG und XML werden beim Hochladen ohnehin zu
 * `application/octet-stream` und fallen damit hier heraus.
 */
export function previewKind(mime: string): PreviewKind | null {
  const type = mime.toLowerCase().split(';')[0].trim()
  if (type.startsWith('image/') && !type.includes('svg')) return 'image'
  if (type === 'application/pdf') return 'pdf'
  if (TEXT_TYPES.includes(type)) return 'text'
  return null
}

/** Größte Datei, die als Klartext in die Vorschau geladen wird. */
export const MAX_TEXT_PREVIEW_BYTES = 256 * 1024
