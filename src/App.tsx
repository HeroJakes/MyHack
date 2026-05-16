/**
 * App - React Router routes and the authenticated sidebar shell.
 */
import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import AppSidebar from './components/AppSidebar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CreateEvent from './pages/CreateEvent'
import EventDetail from './pages/EventDetail'
import InviteView from './pages/InviteView'
import RelationshipGraph from './pages/RelationshipGraph'
import MyContexts from './pages/MyContexts'
import MyInvites from './pages/MyInvites'
import EcosystemLinks from './pages/EcosystemLinks'
import People from './pages/People'
import Analytics from './pages/Analytics'
import OnboardingStep1 from './pages/onboarding/OnboardingStep1'
import OnboardingStep2 from './pages/onboarding/OnboardingStep2'
import OnboardingStep3 from './pages/onboarding/OnboardingStep3'

function FullScreenLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#f6f6f7]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <p className="text-sm text-gray-500">Loading EcoGraph AI...</p>
      </div>
    </div>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6f6f7] lg:flex">
      <div className="lg:sticky lg:top-0 lg:h-screen lg:shrink-0">
        <AppSidebar />
      </div>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        {children}
      </main>
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

/** Requires auth but not a completed onboarding, and guards the onboarding flow. */
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

      <Route path="/" element={<RootRoute />} />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/contexts"
        element={
          <PrivateRoute>
            <MyContexts />
          </PrivateRoute>
        }
      />
      <Route
        path="/invites"
        element={
          <PrivateRoute>
            <MyInvites />
          </PrivateRoute>
        }
      />
      <Route
        path="/ecosystem-links"
        element={
          <PrivateRoute>
            <EcosystemLinks />
          </PrivateRoute>
        }
      />
      <Route
        path="/people"
        element={
          <PrivateRoute>
            <People />
          </PrivateRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <PrivateRoute>
            <Analytics />
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
