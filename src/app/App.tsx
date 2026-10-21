import { lazy, Suspense, useState } from 'react'
import { captureRoomInvitation } from '@/lib/room-invitation'
import { BrowserRouter, Route, Routes } from 'react-router'
import { ClerkLoaded, ClerkLoading, SignedIn, SignedOut } from '@clerk/clerk-react'
import { ModuleLoader } from '@/components/layout/ModuleLoader'
import { AppRouter } from './router'
import { SignInPage } from './SignInPage'

/** Öffentliche Buchungsseite – eigener Chunk, lädt ohne App-Shell. */
const BookingPage = lazy(() => import('./BookingPage'))

function FullscreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <ModuleLoader />
    </div>
  )
}

/** Der bisherige App-Einstieg: alles hinter dem Clerk-Login. */
function AuthenticatedApp() {
  return (
    <>
      <ClerkLoading>
        <FullscreenLoader />
      </ClerkLoading>
      <ClerkLoaded>
        <SignedIn>
          <AppRouter />
        </SignedIn>
        <SignedOut>
          <SignInPage />
        </SignedOut>
      </ClerkLoaded>
    </>
  )
}

/**
 * /book/:slug rendert IMMER (öffentliche Terminbuchung, Spec Abschnitt 4) –
 * nur der Rest der App liegt hinter dem SignedIn-Gate.
 */
export default function App() {
  useState(() => captureRoomInvitation())
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/book/:slug"
          element={
            <Suspense fallback={<FullscreenLoader />}>
              <BookingPage />
            </Suspense>
          }
        />
        <Route path="*" element={<AuthenticatedApp />} />
      </Routes>
    </BrowserRouter>
  )
}
