import { SignIn } from '@clerk/clerk-react'

/** Vollbild-Anmeldeseite; wird gezeigt, solange kein Benutzer angemeldet ist. */
export function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="text-gradient-accent text-4xl font-bold tracking-tight">
          OmniDesk
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Deine All-in-One-Schaltzentrale. Bitte melde dich an.
        </p>
      </div>
      <div className="glow rounded-xl">
        <SignIn
          routing="hash"
          fallbackRedirectUrl={
            window.location.origin +
            window.location.pathname +
            window.location.search
          }
          signUpFallbackRedirectUrl={
            window.location.origin +
            window.location.pathname +
            window.location.search
          }
        />
      </div>
    </main>
  )
}
