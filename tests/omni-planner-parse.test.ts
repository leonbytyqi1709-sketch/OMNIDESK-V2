import assert from 'node:assert/strict'
import test from 'node:test'
import { extractPlannerJson } from '../server/omni-actions-parse'

/**
 * Der produktive KI-Anbieter (Groq, gpt-oss-120b) schreibt gern Fließtext um
 * sein JSON herum. Bis zum 30.10.2026 scheiterte dann die ganze Planung,
 * obwohl ein brauchbarer Vorschlag in der Antwort stand.
 */

const plan = '{"type":"plan","operations":[{"kind":"create_task","title":"Sicherung prüfen"}]}'

test('Antwort des Modells auslesen', async (t) => {
  await t.test('reines JSON', () => {
    assert.equal(extractPlannerJson(plan), plan)
    assert.equal(extractPlannerJson(`\n  ${plan}  \n`), plan)
  })

  await t.test('in einem Code-Zaun', () => {
    assert.equal(extractPlannerJson('```json\n' + plan + '\n```'), plan)
    assert.equal(extractPlannerJson('```\n' + plan + '\n```'), plan)
  })

  await t.test('mit Text davor und danach – der Fall aus der Praxis', () => {
    const antwort = [
      'Aktion vorschlagen:',
      '',
      '```json',
      plan,
      '```',
      '',
      'Bitte bestätige, damit ich die Aufgabe anlegen kann.',
    ].join('\n')
    assert.equal(extractPlannerJson(antwort), plan)
  })

  await t.test('ohne Zaun, nur von Text umgeben', () => {
    assert.equal(extractPlannerJson(`Gerne! ${plan} Passt das so?`), plan)
  })

  await t.test('geschweifte Klammern im Text stören nicht', () => {
    const mitKlammern = '{"type":"clarification","message":"Meintest du {morgen} oder übermorgen?"}'
    assert.equal(extractPlannerJson(`Rückfrage: ${mitKlammern}`), mitKlammern)
  })

  await t.test('verschachtelte Objekte bleiben vollständig', () => {
    const verschachtelt =
      '{"type":"plan","operations":[{"kind":"update_task","changes":{"status":"done"}}]}'
    assert.equal(extractPlannerJson(verschachtelt), verschachtelt)
  })

  await t.test('ohne JSON kommt nichts zurück', () => {
    assert.equal(extractPlannerJson('Das kann ich leider nicht.'), null)
    assert.equal(extractPlannerJson(''), null)
    // Eine abgeschnittene Antwort ist kein gültiges Objekt.
    assert.equal(extractPlannerJson('{"type":"plan","operations":['), null)
  })
})
