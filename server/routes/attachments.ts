import { Hono } from 'hono'
import { z } from 'zod'
import {
  ATTACHMENT_KINDS,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_OBJECT,
  asciiFileName,
  formatBytes,
  safeFileName,
} from '../../src/lib/attachments'
import {
  attachmentQuota,
  deleteAttachment,
  listAttachments,
  ownsObject,
  purgeOrphanAttachments,
  readAttachment,
  saveAttachment,
} from '../attachment-storage'

const ownerInput = z.object({ kind: z.enum(ATTACHMENT_KINDS), id: z.uuid('Ungültige Kennung') })

/**
 * Inhalte, die ein Browser selbst ausführen oder anzeigen würde, werden als
 * reiner Download ausgeliefert. Eine hochgeladene HTML-Datei soll nicht im
 * Ursprung der Anwendung laufen können.
 */
const RISKY = /^(text\/html|application\/xhtml|image\/svg|application\/xml|text\/xml)/i
const safeMime = (mime: string) =>
  !mime || RISKY.test(mime) ? 'application/octet-stream' : mime.slice(0, 150)

export const attachmentsRoute = new Hono()

attachmentsRoute.get('/quota', async (c) => {
  const userId = c.get('userId')
  await purgeOrphanAttachments(userId)
  return c.json(await attachmentQuota(userId))
})

/** Herunterladen. Steht vor `/:kind/:id`, damit „file“ nicht als Art gelesen wird. */
attachmentsRoute.get('/file/:id', async (c) => {
  const parsed = z.uuid().safeParse(c.req.param('id'))
  if (!parsed.success) return c.json({ error: 'Ungültige Kennung' }, 400)
  const found = await readAttachment(c.get('userId'), parsed.data)
  if (!found) return c.json({ error: 'Anhang nicht gefunden' }, 404)

  const body = Buffer.from(found.data, 'base64')
  return new Response(body, {
    headers: {
      'Content-Type': safeMime(found.mime),
      'Content-Length': String(body.byteLength),
      'Content-Disposition': `attachment; filename="${asciiFileName(found.name)}"; filename*=UTF-8''${encodeURIComponent(found.name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
})

attachmentsRoute.get('/:kind/:id', async (c) => {
  const parsed = ownerInput.safeParse({ kind: c.req.param('kind'), id: c.req.param('id') })
  if (!parsed.success) return c.json({ error: z.prettifyError(parsed.error) }, 400)
  const userId = c.get('userId')
  if (!(await ownsObject(userId, parsed.data.kind, parsed.data.id)))
    return c.json({ error: 'Nicht gefunden' }, 404)
  return c.json(await listAttachments(userId, parsed.data.kind, parsed.data.id))
})

attachmentsRoute.post('/:kind/:id', async (c) => {
  const parsed = ownerInput.safeParse({ kind: c.req.param('kind'), id: c.req.param('id') })
  if (!parsed.success) return c.json({ error: z.prettifyError(parsed.error) }, 400)

  const body = await c.req.parseBody().catch(() => null)
  const file = body?.file
  if (!(file instanceof File)) return c.json({ error: 'Keine Datei empfangen.' }, 400)
  if (file.size === 0) return c.json({ error: 'Die Datei ist leer.' }, 400)
  if (file.size > MAX_ATTACHMENT_BYTES)
    return c.json(
      { error: `Höchstens ${formatBytes(MAX_ATTACHMENT_BYTES)} je Datei.` },
      413,
    )

  const buffer = Buffer.from(await file.arrayBuffer())
  // Die gemeldete Größe wird nicht geglaubt; gezählt wird, was ankommt.
  if (buffer.byteLength > MAX_ATTACHMENT_BYTES)
    return c.json({ error: `Höchstens ${formatBytes(MAX_ATTACHMENT_BYTES)} je Datei.` }, 413)

  const result = await saveAttachment(c.get('userId'), parsed.data.kind, parsed.data.id, {
    name: safeFileName(file.name),
    mime: safeMime(file.type),
    size: buffer.byteLength,
    base64: buffer.toString('base64'),
  })

  if (!result.ok)
    return c.json(
      {
        error:
          result.reason === 'unknown-owner'
            ? 'Das Objekt wurde nicht gefunden.'
            : result.reason === 'too-many'
              ? `Höchstens ${MAX_ATTACHMENTS_PER_OBJECT} Anhänge je Eintrag.`
              : 'Der Speicherplatz für Anhänge ist aufgebraucht. Bitte zuerst etwas löschen.',
      },
      result.reason === 'unknown-owner' ? 404 : 409,
    )
  return c.json(result.attachment, 201)
})

attachmentsRoute.delete('/:id', async (c) => {
  const parsed = z.uuid().safeParse(c.req.param('id'))
  if (!parsed.success) return c.json({ error: 'Ungültige Kennung' }, 400)
  if (!(await deleteAttachment(c.get('userId'), parsed.data)))
    return c.json({ error: 'Anhang nicht gefunden' }, 404)
  return c.json({ ok: true })
})
