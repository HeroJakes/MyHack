/**
 * Dashboard — the authenticated home screen.
 *
 * Three tabs:
 *   - My Events: events the user organizes.
 *   - My Invites: invites addressed to the user.
 *   - Relationship Graph: the user's reusable ecosystem links.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { useEvents } from '../hooks/useEvents'
import { useEcosystemLinks } from '../hooks/useEcosystemLinks'
import EventCard from '../components/EventCard'
import InviteStatusBadge from '../components/InviteStatusBadge'
import RelationshipGraphPanel from '../components/RelationshipGraphPanel'
import type { Invite } from '../types'

type Tab = 'events' | 'invites' | 'graph'

const TABS: { id: Tab; label: string }[] = [
  { id: 'events', label: 'My Contexts' },
  { id: 'invites', label: 'My Invites' },
  { id: 'graph', label: 'Relationship Graph' },
]

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
      {label}
    </div>
  )
}

/** Inline real-time listener for the invites addressed to the current user. */
function useMyInvites() {
  const { user } = useAuth()
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) {
      setInvites([])
      setLoading(false)
      return
    }
    setLoading(true)
    const invitesQuery = query(
      collection(db, 'invites'),
      where('invitedUserId', '==', user.uid),
    )
    const unsubscribe = onSnapshot(
      invitesQuery,
      (snap) => {
        setInvites(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Invite),
        )
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [user])

  return { invites, loading, error }
}

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('events')
  const { events, loading: eventsLoading, error: eventsError } = useEvents()
  const { invites, loading: invitesLoading, error: invitesError } =
    useMyInvites()
  const { links, loading: linksLoading, error: linksError } =
    useEcosystemLinks()

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">
            Orchestrate events, respond to invites and grow your ecosystem.
          </p>
        </div>
        <Link
          to="/events/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Create Context
        </Link>
      </div>

      <div className="mt-5 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'events' && (
          <section>
            {eventsLoading && <Spinner label="Loading your events…" />}
            {eventsError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {eventsError}
              </p>
            )}
            {!eventsLoading && !eventsError && events.length === 0 && (
              <p className="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
                You have not created any events yet.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </section>
        )}

        {tab === 'invites' && (
          <section>
            {invitesLoading && <Spinner label="Loading your invites…" />}
            {invitesError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {invitesError}
              </p>
            )}
            {!invitesLoading && !invitesError && invites.length === 0 && (
              <p className="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
                No invites yet. They will appear here when an organizer
                reaches out.
              </p>
            )}
            <div className="space-y-3">
              {invites.map((invite) => (
                <Link
                  key={invite.id}
                  to={`/invites/${invite.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-gray-900">
                      {invite.contextName}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {invite.assignedRole} · {invite.relationshipType}
                    </p>
                  </div>
                  <InviteStatusBadge status={invite.status} />
                </Link>
              ))}
            </div>
          </section>
        )}

        {tab === 'graph' && (
          <section>
            {linksLoading && <Spinner label="Loading your ecosystem links…" />}
            {linksError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {linksError}
              </p>
            )}
            {!linksLoading && !linksError && (
              <>
                <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  These are reusable ecosystem relationships created from
                  confirmed matches.
                </p>
                <RelationshipGraphPanel links={links} />
              </>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
