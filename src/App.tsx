/**
 * App — React Router routes and the authenticated app shell.
 *
 * Routes:
 *   /login           public sign-in page
 *   /                Dashboard (My Events / My Invites / Relationship Graph)
 *   /events/new      CreateEvent
 *   /events/:eventId EventDetail (organizer view)
 *   /invites/:inviteId InviteView (invitee view)
 *   /graph           RelationshipGraph
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

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace />
  return <Shell>{children}</Shell>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/new"
        element={
          <ProtectedRoute>
            <CreateEvent />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/:eventId"
        element={
          <ProtectedRoute>
            <EventDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/invites/:inviteId"
        element={
          <ProtectedRoute>
            <InviteView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/graph"
        element={
          <ProtectedRoute>
            <RelationshipGraph />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
