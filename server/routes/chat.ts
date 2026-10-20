import { and, asc, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../src/db/client'
import { chatMessages, chatSessions } from '../../src/db/schema/index'

export const chatRoute = new Hono()

/**
 * API-Key-Failover:
 * - `AI_API_KEYS` = kommagetrennte Liste von Fallback-Keys (Reihenfolge = Priorität)
 * - `OPENAI_API_KEY` wird als erster Key interpretiert (Abwärtskompatibilität)
 * Bei 401/403/429/5xx oder Netzwerkfehler wird der nächste Key probiert.
 * Der zuletzt funktionierende Index wird prozessweit gemerkt (sticky).
 */
let preferredKeyIndex = 0

function getApiKeys(): string[] {
  const keys = [
    process.env.OPENAI_API_KEY,
    ...(process.env.AI_API_KEYS || '').split(','),
  ]
    .map((k) => k?.trim())
    .filter((k): k is string => Boolean(k))
  return [...new Set(keys)]
}

/** True, wenn ein Failover zum nächsten Key sinnvoll ist. */
function isFailoverStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 408 || status === 429 || status >= 500
}

const createSessionSchema = z.object({
  title: z.string().trim().max(200).optional(),
})

const updateSessionSchema = z.object({
  title: z.string().trim().min(1).max(200),
})

const sendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Nachricht darf nicht leer sein').max(20000),
})

/**
 * GET /api/chat/sessions - Liste der Chats des Nutzers.
 */
chatRoute.get('/sessions', async (c) => {
  const userId = c.get('userId')
  const rows = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .orderBy(desc(chatSessions.updatedAt))

  return c.json(rows)
})

/**
 * POST /api/chat/sessions - Neue Chat-Sitzung starten.
 */
chatRoute.post('/sessions', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => ({}))
  const parsed = createSessionSchema.safeParse(body)
  const title = parsed.success && parsed.data.title ? parsed.data.title : 'Neuer Chat'

  const [session] = await db
    .insert(chatSessions)
    .values({
      userId,
      title,
    })
    .returning()

  return c.json(session, 201)
})

/**
 * PUT /api/chat/sessions/:id - Chat-Titel umbenennen.
 */
chatRoute.put('/sessions/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const parsed = updateSessionSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: z.prettifyError(parsed.error) }, 400)
  }

  const [updated] = await db
    .update(chatSessions)
    .set({
      title: parsed.data.title,
      updatedAt: new Date(),
    })
    .where(and(eq(chatSessions.id, id), eq(chatSessions.userId, userId)))
    .returning()

  if (!updated) {
    return c.json({ error: 'Chat nicht gefunden' }, 404)
  }

  return c.json(updated)
})

/**
 * DELETE /api/chat/sessions/:id - Chat löschen (Kaskade löscht Nachrichten).
 */
chatRoute.delete('/sessions/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const [deleted] = await db
    .delete(chatSessions)
    .where(and(eq(chatSessions.id, id), eq(chatSessions.userId, userId)))
    .returning()

  if (!deleted) {
    return c.json({ error: 'Chat nicht gefunden' }, 404)
  }

  return c.json({ success: true })
})

/**
 * GET /api/chat/sessions/:id/messages - Nachrichten einer Sitzung.
 */
chatRoute.get('/sessions/:id/messages', async (c) => {
  const userId = c.get('userId')
  const sessionId = c.req.param('id')

  const [session] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))

  if (!session) {
    return c.json({ error: 'Chat nicht gefunden' }, 404)
  }

  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt))

  return c.json(messages)
})

/**
 * POST /api/chat/sessions/:id/messages - Neue Nachricht senden & KI-Antwort abrufen.
 */
chatRoute.post('/sessions/:id/messages', async (c) => {
  const userId = c.get('userId')
  const sessionId = c.req.param('id')

  const [session] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))

  if (!session) {
    return c.json({ error: 'Chat nicht gefunden' }, 404)
  }

  const parsed = sendMessageSchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: z.prettifyError(parsed.error) }, 400)
  }

  const userContent = parsed.data.content

  // 1. User-Nachricht speichern
  const [userMsg] = await db
    .insert(chatMessages)
    .values({
      sessionId,
      role: 'user',
      content: userContent,
    })
    .returning()

  // Falls der Chat noch "Neuer Chat" heißt, aktualisiere den Titel mit der ersten Frage
  if (session.title === 'Neuer Chat') {
    const cleanTitle =
      userContent.length > 35 ? `${userContent.slice(0, 35).trim()}…` : userContent
    await db
      .update(chatSessions)
      .set({ title: cleanTitle, updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId))
  } else {
    await db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId))
  }

  // 2. Historie für den Kontext laden (letzte 20 Nachrichten)
  const history = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt))
    .limit(20)

  // 3. KI-Provider anrufen (OpenAI-kompatibel, mit API-Key-Failover)
  const baseUrl = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')
  const model = process.env.AI_MODEL || 'gpt-4o-mini'

  let assistantContent = ''
  let usage: {
    promptTokens: number | null
    completionTokens: number | null
    totalTokens: number | null
    ratelimit: {
      remainingRequests: number | null
      remainingTokens: number | null
      resetRequests: string | null
      resetTokens: string | null
    } | null
  } | null = null

  const apiKeys = getApiKeys()
  if (apiKeys.length === 0) {
    assistantContent = `👋 **Hallo! Ich bin Omni, dein KI-Assistent.**

Aktuell ist noch kein \`OPENAI_API_KEY\` in der \`.env.local\` hinterlegt.

Um mich live zu nutzen, trage einfach folgendes in deine \`.env.local\` ein:
\`\`\`env
OPENAI_API_KEY=dein_api_schluessel_hier
# Optional: weitere Keys als Fallback (Reihenfolge = Priorität)
# AI_API_KEYS=weiterer_key_1,weiterer_key_2
# Optional (z. B. für OpenRouter, LM Studio, Ollama):
# AI_BASE_URL=https://openrouter.ai/api/v1
# AI_MODEL=meta-llama/llama-3-8b-instruct
\`\`\`

Deine Nachricht wurde dennoch erfolgreich im Chatverlauf gespeichert!`
  } else {
    const messagesPayload = [
      {
        role: 'system',
        content:
          'Du bist Omni, der KI-Assistent von OmniDesk, einer modularen Produktivitätsplattform für IT-Profis, Fachinformatiker (FiSi) und Power-User. Du hörst auf den Namen "Omni" – wenn dich jemand mit deinem Namen anspricht (z. B. "Omni, wie geht das?"), antwortest du selbstverständlich direkt. Interne Änderungen werden ausschließlich über den separaten Bereich "Aktionen" oben bei Omni geplant, als Vorschau gezeigt und vom Nutzer bestätigt. Du kannst aus diesem normalen Chat heraus keine Aktionen ausführen. Behaupte niemals, eine Aufgabe oder einen Termin angelegt oder geändert zu haben. Verweise bei solchen Aufträgen auf den Aktionen-Knopf. Antworte präzise, hilfsbereit, auf Deutsch, nutze Markdown und hebe Codeblöcke mit passendem Sprachbezeichner hervor.',
      },
      ...history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ]

    // Start beim "sticky" bevorzugten Key, danach der Rest der Kette.
    const order = [
      ...apiKeys.slice(preferredKeyIndex),
      ...apiKeys.slice(0, preferredKeyIndex),
    ]
    let lastStatus: number | null = null
    let lastError: string | null = null

    for (let i = 0; i < order.length; i++) {
      const apiKey = order[i]
      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: messagesPayload,
            temperature: 0.7,
          }),
        })

        if (!response.ok) {
          lastStatus = response.status
          lastError = (await response.text()).slice(0, 500)
          if (isFailoverStatus(response.status) && i < order.length - 1) {
            continue // Nächster Key in der Fallback-Kette
          }
          assistantContent = `⚠️ **Fehler bei der KI-Anfrage (HTTP ${response.status}):**\n\`\`\`\n${lastError}\n\`\`\``
          break
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>
          usage?: {
            prompt_tokens?: number
            completion_tokens?: number
            total_tokens?: number
          }
        }
        assistantContent =
          data.choices?.[0]?.message?.content ||
          'Es konnte keine Antwort vom Modell generiert werden.'

        // Funktionierenden Key merken, damit künftige Anfragen ihn zuerst nutzen.
        preferredKeyIndex = apiKeys.indexOf(apiKey)

        // Token-Verbrauch & Rate-Limit-Status (Groq/OpenAI-Header)
        // für den /context-Befehl im Frontend durchreichen.
        const toInt = (value: string | null) =>
          value === null ? null : Number.parseInt(value, 10)
        usage = {
          promptTokens: data.usage?.prompt_tokens ?? null,
          completionTokens: data.usage?.completion_tokens ?? null,
          totalTokens: data.usage?.total_tokens ?? null,
          ratelimit:
            response.headers.has('x-ratelimit-remaining-tokens') ||
            response.headers.has('x-ratelimit-remaining-requests')
              ? {
                  remainingRequests: toInt(
                    response.headers.get('x-ratelimit-remaining-requests'),
                  ),
                  remainingTokens: toInt(
                    response.headers.get('x-ratelimit-remaining-tokens'),
                  ),
                  resetRequests: response.headers.get('x-ratelimit-reset-requests'),
                  resetTokens: response.headers.get('x-ratelimit-reset-tokens'),
                }
              : null,
        }
        break
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        lastError = msg
        if (i < order.length - 1) {
          continue // Netzwerkfehler → nächster Key
        }
        assistantContent = `⚠️ **Verbindungsfehler zur KI-Schnittstelle:**\n${msg}`
      }
    }

    // Alle Keys fehlgeschlagen, ohne dass ein Status-Fehler gesetzt wurde:
    if (!assistantContent && lastStatus !== null && !lastError) {
      assistantContent = `⚠️ **Fehler bei der KI-Anfrage (HTTP ${lastStatus}).**`
    } else if (!assistantContent && lastError && lastStatus === null) {
      assistantContent = `⚠️ **Verbindungsfehler zur KI-Schnittstelle:**\n${lastError}`
    }
  }

  // 4. Assistant-Antwort speichern
  const [assistantMsg] = await db
    .insert(chatMessages)
    .values({
      sessionId,
      role: 'assistant',
      content: assistantContent,
    })
    .returning()

  return c.json({
    userMessage: userMsg,
    assistantMessage: assistantMsg,
    usage,
  })
})
