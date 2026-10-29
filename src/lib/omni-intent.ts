/**
 * Erkennt, ob eine Chat-Nachricht ein Auftrag ist.
 *
 * Omni antwortet im Chat und führt über die Aktionen aus — zwei Wege, die
 * niemand von selbst zusammenbringt. Deshalb prüft der Chat jede Nachricht
 * auf einen Auftrag und bietet den Vorschlag gleich dort an.
 *
 * Die Prüfung läuft im Browser und kostet nichts. Sie darf lieber einmal zu
 * wenig erkennen als zu viel: Eine Frage, die versehentlich als Auftrag gilt,
 * verbraucht eine KI-Anfrage und blockiert die nächste Planung 20 Sekunden.
 */

/** Verben, die in OMNIDESK etwas anlegen oder ändern. */
const VERBS = [
  'leg',
  'lege',
  'legst',
  'erstell',
  'erstelle',
  'anlegen',
  'erstellen',
  'notier',
  'notiere',
  'notieren',
  'schreib',
  'schreibe',
  'trag',
  'trage',
  'eintragen',
  'setz',
  'setze',
  'setzen',
  'verschieb',
  'verschiebe',
  'verschieben',
  'ändere',
  'ändern',
  'aktualisier',
  'aktualisiere',
  'ergänze',
  'ergänzen',
  'häng',
  'hänge',
  'anhängen',
  'verknüpf',
  'verknüpfe',
  'verknüpfen',
  'plan',
  'plane',
  'planen',
  'merk',
  'merke',
  'vermerke',
  'füg',
  'füge',
  'hinzufügen',
  'markier',
  'markiere',
  'erledige',
  'abhaken',
]

/** Gegenstände, die Omni anfassen darf. */
const OBJECTS = [
  'aufgabe',
  'aufgaben',
  'projektaufgabe',
  'notiz',
  'notizen',
  'termin',
  'termine',
  'kontakt',
  'kontakte',
  'projekt',
  'projekte',
  'verknüpfung',
  'erinnerung',
  'meeting',
  'besprechung',
]

/** Fragen sind keine Auftäge, auch wenn ein Verb darin vorkommt. */
const QUESTIONS = [
  'wie',
  'was',
  'warum',
  'wieso',
  'weshalb',
  'wann',
  'wo',
  'wer',
  'welche',
  'welcher',
  'welches',
  'kannst du',
  'kann man',
  'erklär',
  'erkläre',
  'zeig',
  'zeige',
  'was ist',
  'wofür',
]

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[.,;:!?()"'„“]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

/**
 * Wahr, wenn die Nachricht nach einem Auftrag an Omni klingt.
 *
 * Verlangt ein Tätigkeitswort **und** einen Gegenstand aus OMNIDESK. „Schreib
 * mir ein Bash-Skript“ enthält zwar ein Verb, aber kein Objekt, das Omni
 * anlegen könnte — das bleibt eine Chat-Antwort.
 */
export function looksLikeOmniOrder(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < 8 || trimmed.length > 4000) return false
  const list = words(trimmed)
  if (list.length < 3) return false

  const start = list.slice(0, 3).join(' ')
  // Eine direkte Anrede („Omni, leg …“) zählt nicht als Frage.
  const addressed = list[0] === 'omni'
  if (!addressed && QUESTIONS.some((q) => start.startsWith(q))) return false
  if (trimmed.endsWith('?') && !addressed) return false

  const hasVerb = list.some((word) => VERBS.includes(word))
  const hasObject = list.some((word) => OBJECTS.includes(word))
  return hasVerb && hasObject
}
