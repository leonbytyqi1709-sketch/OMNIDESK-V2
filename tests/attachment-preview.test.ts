import assert from 'node:assert/strict'
import test from 'node:test'
import { previewKind, safeFileName } from '../src/lib/attachments'

/**
 * Die Vorschau zeigt Dateien im Fenster an. Entscheidend ist, was sie NICHT
 * anzeigt: Inhalte, die ein Browser selbst ausführen würde.
 */
test('Vorschau-Arten', async (t) => {
  await t.test('Bilder, PDF und Klartext bekommen eine Vorschau', () => {
    assert.equal(previewKind('image/png'), 'image')
    assert.equal(previewKind('image/jpeg'), 'image')
    assert.equal(previewKind('IMAGE/WEBP'), 'image')
    assert.equal(previewKind('application/pdf'), 'pdf')
    assert.equal(previewKind('text/plain; charset=utf-8'), 'text')
    assert.equal(previewKind('application/json'), 'text')
    assert.equal(previewKind('text/markdown'), 'text')
  })

  await t.test('ausführbare und unbekannte Arten nicht', () => {
    for (const mime of [
      'image/svg+xml',
      'text/html',
      'application/xml',
      'application/octet-stream',
      'application/zip',
      'video/mp4',
      '',
    ])
      assert.equal(previewKind(mime), null, `Darf keine Vorschau haben: ${mime}`)
  })

  await t.test('der Dateiname bleibt harmlos', () => {
    assert.equal(safeFileName('bild.png'), 'bild.png')
    assert.equal(safeFileName(String.raw`a/b\c.txt`), 'a_b_c.txt')
    assert.equal(safeFileName('   '), 'datei')
  })
})
