import { useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'

/**
 * Fehler einer beantworteten API-Anfrage. Die Meldung bleibt unverändert die
 * des Servers; zusätzlich steht der HTTP-Status zur Verfügung, damit
 * React Query deterministische Fehler nicht sinnlos wiederholt.
 */
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * Authentifizierter Fetch für alle Modul-APIs: hängt automatisch das
 * Clerk-Session-Token an und wirft bei Fehlern eine Error mit der
 * Server-Fehlermeldung.
 */
export function useApiFetch() {
  const { getToken } = useAuth()

  return useCallback(
    async <T>(path: string, init?: RequestInit): Promise<T> => {
      const token = await getToken()
      const res = await fetch(path, {
        ...init,
        headers: {
          ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
          Authorization: `Bearer ${token}`,
          ...init?.headers,
        },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new ApiError(
          body?.error ?? `Anfrage fehlgeschlagen (${res.status})`,
          res.status,
        )
      }
      return res.json() as Promise<T>
    },
    [getToken],
  )
}
