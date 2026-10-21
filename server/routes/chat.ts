import { captureAutoMemory } from '../omni-memory-auto'
import { isSimpleSmallTalk, omniChatSystemPrompt } from '../omni-chat-style'
import { readAutoMemoryStates } from '../omni-memory-auto-storage'
import { chatMemoryOptions } from '../omni-memory-policy'
import {
  prepareChatMemory,
  memoryPromptMessage,
  ephemeralMemoryReceipt,
  saveMemoryReceipt,
  readMemoryReceipts,
} from '../omni-memory-context'
import { and, asc, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../src/db/client'
import { chatMessages, chatSessions, projects } from '../../src/db/schema/index'

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
  return (
    status === 401 ||
    status === 403 ||
    status === 408 ||
    status === 429 ||
    status >= 500
  )
}

const createSessionSchema = z.object({
  title: z.string().trim().max(200).optional(),
})

const updateSessionSchema = z.object({
  title: z.string().trim().min(1).max(200),
})

const sendMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Nachricht darf nicht leer sein')
    .max(20000),
  memory: chatMemoryOptions.optional(),
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
  const title =
    parsed.success && parsed.data.title ? parsed.data.title : 'Neuer Chat'

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

  const receipts = await readMemoryReceipts(userId, sessionId)
  const autoStates = await readAutoMemoryStates(userId, sessionId)
  return c.json(
    messages.map((message) => ({
      ...message,
      memory: receipts[message.id] ?? null,
      autoMemory: autoStates[message.id] ?? null,
    })),
  )
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
  const smallTalk = isSimpleSmallTalk(userContent)
  const memoryOptions = parsed.data.memory ?? {
    enabled: false,
    projectId: null,
  }
  if (memoryOptions.projectId) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, memoryOptions.projectId),
          eq(projects.userId, userId),
        ),
      )
    if (!project)
      return c.json({ error: 'Projektkontext nicht verfügbar.' }, 404)
  }
  const preparedMemory = await prepareChatMemory(
    userId,
    userContent,
    memoryOptions,
  )

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
      userContent.length > 35
        ? `${userContent.slice(0, 35).trim()}…`
        : userContent
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

  // 2. Neueste 20 Nachrichten laden; für den Provider danach chronologisch umdrehen.
  const history = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(20)

  // 3. KI-Provider anrufen (OpenAI-kompatibel, mit API-Key-Failover)
  const baseUrl = (
    process.env.AI_BASE_URL || 'https://api.openai.com/v1'
  ).replace(/\/+$/, '')
  const model = process.env.AI_MODEL || 'gpt-4o-mini'

  let assistantContent = ''
  let providerSucceeded = false
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
    assistantContent =
      'Omni ist noch nicht mit einem KI-Anbieter verbunden. Bitte prüfe die KI-Konfiguration; deine Nachricht ist gespeichert.'
  } else {
    const messagesPayload = [
      {
        role: 'system',
        content: omniChatSystemPrompt,
      },
      ...(memoryPromptMessage(preparedMemory)
        ? [memoryPromptMessage(preparedMemory)!]
        : []),
      ...(smallTalk
        ? [{ role: 'user', content: userContent }]
        : [...history].reverse().map((m) => ({
            role: m.role,
            content: m.content,
          }))),
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
            ...(smallTalk ? { max_tokens: 160 } : {}),
          }),
        })

        if (!response.ok) {
          lastStatus = response.status
          lastError = (await response.text()).slice(0, 500)
          if (isFailoverStatus(response.status) && i < order.length - 1) {
            continue // Nächster Key in der Fallback-Kette
          }
          assistantContent = `Der KI-Anbieter konnte nicht antworten (HTTP ${response.status}). Bitte prüfe die Verbindung oder versuche es später erneut.`
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

        providerSucceeded = true

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
                  resetRequests: response.headers.get(
                    'x-ratelimit-reset-requests',
                  ),
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
        assistantContent =
          'Die Verbindung zum KI-Anbieter ist fehlgeschlagen. Bitte versuche es erneut.'
      }
    }

    // Alle Keys fehlgeschlagen, ohne dass ein Status-Fehler gesetzt wurde:
    if (!assistantContent && lastStatus !== null && !lastError) {
      assistantContent = `Der KI-Anbieter konnte nicht antworten (HTTP ${lastStatus}). Bitte versuche es später erneut.`
    } else if (!assistantContent && lastError && lastStatus === null) {
      assistantContent =
        'Die Verbindung zum KI-Anbieter ist fehlgeschlagen. Bitte versuche es erneut.'
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

  const receiptMemory = providerSucceeded
    ? preparedMemory
    : { ...preparedMemory, status: 'unavailable' as const, items: [] }
  let receiptSaved = true
  try {
    await saveMemoryReceipt(userId, assistantMsg.id, receiptMemory)
  } catch {
    receiptSaved = false
  }
  if (
    providerSucceeded &&
    !smallTalk &&
    memoryOptions.enabled &&
    memoryOptions.autoCapture
  )
    await captureAutoMemory(
      userId,
      userMsg.id,
      assistantMsg.id,
      userContent,
      memoryOptions.projectId,
    )
  const autoStates = memoryOptions.autoCapture
    ? await readAutoMemoryStates(userId, sessionId)
    : {}
  return c.json({
    userMessage: userMsg,
    assistantMessage: {
      ...assistantMsg,
      memory: ephemeralMemoryReceipt(receiptMemory),
      autoMemory: autoStates[assistantMsg.id] ?? null,
    },
    memoryReceiptSaved: receiptSaved,
    usage,
  })
})
