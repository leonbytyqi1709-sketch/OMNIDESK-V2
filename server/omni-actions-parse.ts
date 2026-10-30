/**
 * Die Antwort des Modells lesbar machen.
 *
 * Omni verlangt reines JSON, bekommt aber je nach Anbieter und Modell Text
 * drumherum: eine Anrede, ein Code-Zaun, ein Nachsatz wie „Bitte bestätige“.
 * Bis zum 30.10.2026 wurde nur ein Zaun am Anfang und am Ende entfernt — stand
 * irgendetwas davor, scheiterte die ganze Planung mit „Omni konnte keinen
 * gültigen Vorschlag erstellen“, obwohl ein brauchbarer Vorschlag enthalten
 * war.
 *
 * Diese Funktion holt das JSON-Objekt heraus, egal wie es verpackt ist. Sie
 * entscheidet nichts über den Inhalt; geprüft wird danach wie bisher streng
 * gegen das Schema.
 */

/** Findet das erste vollständige JSON-Objekt und achtet dabei auf Zeichenketten. */
function firstObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0,
    inString = false,
    escaped = false
  for (let at = start; at < text.length; at += 1) {
    const character = text[at]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') inString = true
    else if (character === '{') depth += 1
    else if (character === '}') {
      depth -= 1
      if (depth === 0) return text.slice(start, at + 1)
    }
  }
  return null
}

/**
 * Gibt den JSON-Text aus einer Modellantwort zurück oder `null`, wenn keiner
 * zu finden ist. Ein Code-Zaun mit `json` wird bevorzugt, weil Modelle dort
 * ihre eigentliche Antwort ablegen und davor gern erläutern.
 */
export function extractPlannerJson(content: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(content)
  if (fenced) {
    const inner = firstObject(fenced[1])
    if (inner) return inner
  }
  return firstObject(content)
}
