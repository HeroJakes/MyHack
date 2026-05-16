/**
 * App — React Router routes and the authenticated app shell.
 *
 * Routes:
 *   /login                 public sign-in / sign-up
 *   /signup                alias of /login that opens on the sign-up tab
 *   /onboarding/step1..3    first-run profile onboarding (auth, pre-onboarding)
 *   / , /dashboard          Dashboard
 *   /events/new             CreateEvent
 *   /events/:eventId        EventDetail (organizer view)
 *   /invites/:inviteId      InviteView (invitee view)
 *   /graph                  RelationshipGraph
 *
 * `PrivateRoute` gates the main app on a completed onboarding; `OnboardingRoute`
 * gates the onboarding flow so users who already finished cannot re-enter it.
 */
import type { ReactNode } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CreateEvent from './pages/CreateEvent'
import EventDetail from './pages/EventDetail'
import InviteView from './pages/InviteView'
import RelationshipGraph from './pages/RelationshipGraph'
import OnboardingStep1 from './pages/onboarding/OnboardingStep1'
import OnboardingStep2 from './pages/onboarding/OnboardingStep2'
import OnboardingStep3 from './pages/onboarding/OnboardingStep3'

function FullScreenLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#f6f6f7]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <p className="text-sm text-gray-500">Loading EcoGraph AI…</p>
      </div>
    </div>
  )
}

function AppHeader() {
  const { user, logout } = useAuth()

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
      isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <NavLink to="/" className="flex items-center gap-2">
          <span className="text-lg">🌿</span>
          <span className="text-base font-bold text-gray-900">EcoGraph AI</span>
        </NavLink>

        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={linkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/graph" className={linkClass}>
            Graph
          </NavLink>
          <NavLink to="/events/new" className={linkClass}>
            New Event
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-sm text-gray-500 sm:inline">
            {user?.displayName ?? user?.email}
          </span>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6f6f7]">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  )
}

/** Requires auth + a completed onboarding; otherwise redirects appropriately. */
function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, loading, onboardingComplete, profileLoading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace />
  if (profileLoading) return <FullScreenLoader />
  if (!onboardingComplete) return <Navigate to="/onboarding/step1" replace />
  return <Shell>{children}</Shell>
}

/** Requires auth but NOT a completed onboarding — guards the onboarding flow. */
function OnboardingRoute({ children }: { children: ReactNode }) {
  const { user, loading, onboardingComplete, profileLoading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace />
  if (profileLoading) return <FullScreenLoader />
  if (onboardingComplete) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function RootRoute() {
  const { user, loading, onboardingComplete, profileLoading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace />
  if (profileLoading) return <FullScreenLoader />
  if (!onboardingComplete) return <Navigate to="/onboarding/step1" replace />
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Login />} />

      <Route
        path="/onboarding/step1"
        element={
          <OnboardingRoute>
            <OnboardingStep1 />
          </OnboardingRoute>
        }
      />
      <Route
        path="/onboarding/step2"
        element={
          <OnboardingRoute>
            <OnboardingStep2 />
          </OnboardingRoute>
        }
      />
      <Route
        path="/onboarding/step3"
        element={
          <OnboardingRoute>
            <OnboardingStep3 />
          </OnboardingRoute>
        }
      />

      <Route
        path="/"
        element={<RootRoute />}
      />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/events/new"
        element={
          <PrivateRoute>
            <CreateEvent />
          </PrivateRoute>
        }
      />
      <Route
        path="/events/:eventId"
        element={
          <PrivateRoute>
            <EventDetail />
          </PrivateRoute>
        }
      />
      <Route
        path="/invites/:inviteId"
        element={
          <PrivateRoute>
            <InviteView />
          </PrivateRoute>
        }
      />
      <Route
        path="/graph"
        element={
          <PrivateRoute>
            <RelationshipGraph />
          </PrivateRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
