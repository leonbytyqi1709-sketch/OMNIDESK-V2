import type { ReactNode } from 'react'
import { ClerkProvider } from '@clerk/clerk-react'
import { deDE } from '@clerk/localizations'
import { dark } from '@clerk/themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import { ApiError } from '@/hooks/use-api'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Robust gegen kurze API-Aussetzer, aber ohne Wiederholungen für
      // Antworten, die der Server bewusst gegeben hat: Ein 401, 404 oder ein
      // „noch nicht eingerichtet" (503) fällt beim zweiten Versuch genauso
      // aus und hat die Anzeige der eigentlichen Meldung nur verzögert.
      retry: (failureCount, error) => {
        if (
          error instanceof ApiError &&
          (error.status < 500 || error.status === 501 || error.status === 503)
        )
          return false
        return failureCount < 2
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      // Beim Wechsel zwischen Modulen werden zwischengespeicherte Daten
      // sofort angezeigt, statt bei jedem Aufruf neu zu laden. Änderungen
      // machen ihre eigenen Abfragen weiterhin gezielt ungültig.
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
    },
  },
})

const rawKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

if (!rawKey) {
  throw new Error(
    'VITE_CLERK_PUBLISHABLE_KEY fehlt – bitte in .env.local hinterlegen.',
  )
}

const PUBLISHABLE_KEY: string = rawKey

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      localization={deDE}
      appearance={{
        baseTheme: dark,
        variables: {
          colorBackground: '#18181b',
          colorInputBackground: '#09090b',
          colorPrimary: '#230d8f',
          colorDanger: '#cf0a0a',
          colorText: '#fafafa',
          colorTextSecondary: '#a1a1aa',
          borderRadius: '0.625rem',
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        {/* Theme-Verwaltung (Dark/Light/System) – Umschalter in den Einstellungen */}
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  )
}
