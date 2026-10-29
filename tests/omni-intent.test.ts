import assert from 'node:assert/strict'
import test from 'node:test'
import { looksLikeOmniOrder } from '../src/lib/omni-intent'

/**
 * Die Erkennung entscheidet, wann der Chat einen Vorschlag plant. Zu viel
 * erkannt heißt: unnötige KI-Anfragen und eine 20-Sekunden-Sperre für die
 * nächste echte Planung. Zu wenig erkannt heißt: Der Nutzer muss doch wieder
 * den Umweg über den Aktionen-Knopf nehmen.
 */

test('Auftragserkennung im Chat', async (t) => {
  await t.test('erkennt Aufträge', () => {
    for (const text of [
      'Omni, lege eine Aufgabe an, dass ich die Sicherung prüfe bis morgen',
      'Leg bitte eine Aufgabe an: Server neu starten',
      'Erstelle einen Termin für Freitag um 10 Uhr, Besprechung mit dem Team',
      'Notiere in der Notiz Wochenrückblick, dass der Testlauf lief',
      'Verschiebe den Termin Jour fixe auf nächste Woche',
      'Häng an die Notiz Angebot den Satz an: Preise geprüft',
      'Verknüpfe die Notiz mit dem Projekt Rechenzentrum',
      'Setze die Aufgabe Backup prüfen auf erledigt',
    ])
      assert.ok(looksLikeOmniOrder(text), `Nicht erkannt: ${text}`)
  })

  await t.test('lässt Gespräch Gespräch sein', () => {
    for (const text of [
      'Wie lege ich in Linux eine neue Aufgabe im Cron an?',
      'Was ist der Unterschied zwischen einer Aufgabe und einem Projekt?',
      'Kannst du mir erklären, wie man einen Termin in Outlook anlegt?',
      'Zeig mir meine Aufgaben für heute',
      'Schreib mir ein Bash-Skript, das ein Backup anlegt',
      'Danke dir',
      'Welche Aufgabe ist am wichtigsten?',
      'Wann sollte man ein Projekt neu planen?',
    ])
      assert.ok(!looksLikeOmniOrder(text), `Fälschlich erkannt: ${text}`)
  })

  await t.test('die direkte Anrede schlägt die Fragezeichen-Regel', () => {
    // „Omni, …“ ist eine Ansage, auch wenn sie höflich als Frage endet.
    assert.ok(looksLikeOmniOrder('Omni, legst du mir eine Aufgabe dafür an?'))
    assert.ok(!looksLikeOmniOrder('Legst du mir eine Aufgabe dafür an?'))
  })

  await t.test('zu kurz, zu lang und leer zählen nicht', () => {
    assert.ok(!looksLikeOmniOrder(''))
    assert.ok(!looksLikeOmniOrder('   '))
    assert.ok(!looksLikeOmniOrder('leg an'))
    assert.ok(!looksLikeOmniOrder(`Leg eine Aufgabe an ${'x'.repeat(4000)}`))
  })

  await t.test('ein Verb allein genügt nicht', () => {
    assert.ok(!looksLikeOmniOrder('Erstelle mir bitte eine Liste von Linux-Befehlen'))
    assert.ok(looksLikeOmniOrder('Erstelle mir bitte eine Aufgabe für die Linux-Befehle'))
  })
})
