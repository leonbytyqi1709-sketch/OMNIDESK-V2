import net from 'node:net'
import tls from 'node:tls'
import { and, eq } from 'drizzle-orm'
import { db } from '../src/db/client'
import { uptimeChecks, uptimeMonitors, type UptimeMonitor } from '../src/db/schema/index'

/**
 * Ermittelt verbleibende SSL-Gültigkeitstage für einen HTTPS-Host via TLS-Handshake.
 */
function getSslDaysRemaining(
  hostname: string,
  port = 443,
  timeoutMs = 5000,
): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const socket = tls.connect(
        {
          host: hostname,
          port,
          servername: hostname,
          rejectUnauthorized: false,
          timeout: timeoutMs,
        },
        () => {
          try {
            const cert = socket.getPeerCertificate()
            socket.destroy()
            if (cert && cert.valid_to) {
              const expireDate = new Date(cert.valid_to).getTime()
              const now = Date.now()
              const days = Math.floor((expireDate - now) / (1000 * 60 * 60 * 24))
              resolve(days)
            } else {
              resolve(null)
            }
          } catch {
            socket.destroy()
            resolve(null)
          }
        },
      )

      socket.on('error', () => {
        socket.destroy()
        resolve(null)
      })
      socket.on('timeout', () => {
        socket.destroy()
        resolve(null)
      })
    } catch {
      resolve(null)
    }
  })
}

/**
 * Führt einen HTTP(S)-Check durch.
 */
async function checkHttp(
  url: string,
  expectedStatus = 200,
  timeoutMs = 10000,
): Promise<{
  status: 'up' | 'down'
  responseTimeMs: number
  statusCode: number | null
  sslDaysLeft: number | null
  error: string | null
}> {
  const start = performance.now()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  let statusCode: number | null = null
  let sslDaysLeft: number | null = null

  try {
    // Normalisiere URL: falls Protokoll fehlt, https:// voranstellen
    const normalizedUrl =
      url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
    const parsedUrl = new URL(normalizedUrl)

    if (parsedUrl.protocol === 'https:') {
      const sslPort = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 443
      sslDaysLeft = await getSslDaysRemaining(
        parsedUrl.hostname,
        sslPort,
        Math.min(timeoutMs, 5000),
      )
    }

    const res = await fetch(normalizedUrl, {
      signal: controller.signal,
      method: 'GET',
      headers: {
        'User-Agent': 'OmniDesk-Uptime-Monitor/1.0',
      },
    })
    clearTimeout(timeoutId)
    const duration = Math.round(performance.now() - start)
    statusCode = res.status
    // Der Inhalt interessiert nicht; ohne Freigabe bleibt die Verbindung offen.
    await res.body?.cancel().catch(() => {})

    if (res.status === expectedStatus) {
      return {
        status: 'up',
        responseTimeMs: duration,
        statusCode,
        sslDaysLeft,
        error: null,
      }
    } else {
      return {
        status: 'down',
        responseTimeMs: duration,
        statusCode,
        sslDaysLeft,
        error: `Status ${res.status} (erwartet: ${expectedStatus})`,
      }
    }
  } catch (err: unknown) {
    clearTimeout(timeoutId)
    const duration = Math.round(performance.now() - start)
    const message = err instanceof Error ? err.message : String(err)
    return {
      status: 'down',
      responseTimeMs: duration,
      statusCode,
      sslDaysLeft,
      error: message.includes('aborted') ? `Timeout (${timeoutMs}ms)` : message,
    }
  }
}

/**
 * Führt einen TCP-Port-Check durch.
 */
function checkTcp(
  host: string,
  port: number,
  timeoutMs = 10000,
): Promise<{
  status: 'up' | 'down'
  responseTimeMs: number
  statusCode: number | null
  sslDaysLeft: number | null
  error: string | null
}> {
  return new Promise((resolve) => {
    const start = performance.now()
    const socket = new net.Socket()

    socket.setTimeout(timeoutMs)

    socket.connect(port, host, () => {
      const duration = Math.round(performance.now() - start)
      socket.destroy()
      resolve({
        status: 'up',
        responseTimeMs: duration,
        statusCode: null,
        sslDaysLeft: null,
        error: null,
      })
    })

    socket.on('error', (err) => {
      const duration = Math.round(performance.now() - start)
      socket.destroy()
      resolve({
        status: 'down',
        responseTimeMs: duration,
        statusCode: null,
        sslDaysLeft: null,
        error: err.message,
      })
    })

    socket.on('timeout', () => {
      const duration = Math.round(performance.now() - start)
      socket.destroy()
      resolve({
        status: 'down',
        responseTimeMs: duration,
        statusCode: null,
        sslDaysLeft: null,
        error: `Timeout (${timeoutMs}ms)`,
      })
    })
  })
}

/**
 * Führt einen Check für einen einzelnen Monitor durch und speichert das Ergebnis in der DB.
 */
export async function checkSingleMonitor(monitor: UptimeMonitor) {
  let result: {
    status: 'up' | 'down'
    responseTimeMs: number
    statusCode: number | null
    sslDaysLeft: number | null
    error: string | null
  }

  if (monitor.type === 'tcp') {
    const port = monitor.port || 80
    result = await checkTcp(monitor.url, port, monitor.timeoutMs)
  } else {
    result = await checkHttp(monitor.url, monitor.expectedStatus, monitor.timeoutMs)
  }

  const [row] = await db
    .insert(uptimeChecks)
    .values({
      monitorId: monitor.id,
      status: result.status,
      responseTimeMs: result.responseTimeMs,
      statusCode: result.statusCode,
      sslDaysLeft: result.sslDaysLeft,
      error: result.error,
    })
    .returning()

  return row
}

/**
 * Aktualisiert alle aktiven Monitore (optional gefiltert nach userId).
 */
export async function refreshAllMonitors(userId?: string) {
  const query = userId
    ? and(eq(uptimeMonitors.active, true), eq(uptimeMonitors.userId, userId))
    : eq(uptimeMonitors.active, true)

  const monitors = await db.select().from(uptimeMonitors).where(query)
  if (monitors.length === 0) return []

  const results = await Promise.allSettled(
    monitors.map((m) => checkSingleMonitor(m)),
  )

  return results
}
