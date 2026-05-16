import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { useRespondToInvite } from '../hooks/useRespondToInvite'
import type { EcoEvent, Invite, InviteStatus, RelationshipRole } from '../types'

type StatusFilter = 'all' | InviteStatus
type SortMode = 'recent' | 'oldest' | 'confidence'

type ContextMap = Record<string, EcoEvent | undefined>

const PAGE_SIZE = 6

const ROLE_FILTERS: { label: string; value: RelationshipRole }[] = [
  { label: 'Mentor', value: 'Mentor' },
  { label: 'Partner', value: 'Partner' },
  { label: 'Startup', value: 'Startup/Company' },
  { label: 'Service Provider', value: 'Service Provider' },
]

const ROLE_STYLES: Record<string, string> = {
  Mentor: 'bg-violet-50 text-violet-700 ring-violet-100',
  Partner: 'bg-orange-50 text-orange-700 ring-orange-100',
  'Startup/Company': 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  'Service Provider': 'bg-blue-50 text-blue-700 ring-blue-100',
  'Programme Admin': 'bg-slate-100 text-slate-700 ring-slate-200',
}

function toMillis(value: unknown): number {
  if (!value) return 0
  const timestamp = value as { toMillis?: () => number; seconds?: number }
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis()
  if (typeof timestamp.seconds === 'number') return timestamp.seconds * 1000
  return 0
}

function formatRelativeTime(value: unknown): string {
  const millis = toMillis(value)
  if (!millis) return 'Recently'

  const diff = Date.now() - millis
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return 'Just now'
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}m ago`
  if (diff < day) return `${Math.max(1, Math.floor(diff / hour))}h ago`
  if (diff < day * 2) return 'Yesterday'
  return `${Math.floor(diff / day)}d ago`
}

function formatEventMeta(event: EcoEvent | undefined, invite: Invite): string {
  const parts: string[] = []
  const date = event?.eventDate
  const millis = toMillis(date)

  if (millis) {
    parts.push(
      new Intl.DateTimeFormat('en-MY', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(millis)),
    )
  }

  if (event?.field) parts.push(event.field)
  if (!event?.field && invite.contextType) parts.push(invite.contextType)

  return parts.join(' · ') || 'Campaign details will appear here'
}

function roleLabel(role: RelationshipRole): string {
  return role === 'Startup/Company' ? 'Startup' : role
}

function initials(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function StatCard({
  icon,
  iconClass,
  value,
  label,
  helper,
}: {
  icon: 'mail' | 'check' | 'x' | 'rate'
  iconClass: string
  value: string | number
  label: string
  helper: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-full ${iconClass}`}>
          {icon === 'mail' && (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect width="18" height="14" x="3" y="5" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          )}
          {icon === 'check' && (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m5 12 4 4L19 6" />
            </svg>
          )}
          {icon === 'x' && (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          )}
          {icon === 'rate' && (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m13 3-2 7h7L9 21l2-7H4z" />
            </svg>
          )}
        </div>
        <div>
          <p className="text-xl font-black text-slate-950">{value}</p>
          <p className="text-xs font-bold text-slate-900">{label}</p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">{helper}</p>
        </div>
      </div>
    </div>
  )
}

function useMyInvites() {
  const { user } = useAuth()
  const [invites, setInvites] = useState<Invite[]>([])
  const [contexts, setContexts] = useState<ContextMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) {
      setInvites([])
      setContexts({})
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')

    const invitesQuery = query(
      collection(db, 'invites'),
      where('invitedUserId', '==', user.uid),
    )

    return onSnapshot(
      invitesQuery,
      async (snap) => {
        const rows = snap.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Invite[]
        rows.sort((a, b) => toMillis(b.sentAt) - toMillis(a.sentAt))

        const uniqueContextIds = Array.from(
          new Set(rows.map((invite) => invite.contextId).filter(Boolean)),
        )

        try {
          const contextEntries = await Promise.all(
            uniqueContextIds.map(async (contextId) => {
              const contextSnap = await getDoc(doc(db, 'events', contextId))
              if (!contextSnap.exists()) return [contextId, undefined] as const
              return [
                contextId,
                { id: contextSnap.id, ...contextSnap.data() } as EcoEvent,
              ] as const
            }),
          )

          if (cancelled) return
          setInvites(rows)
          setContexts(Object.fromEntries(contextEntries))
          setLoading(false)
        } catch (err) {
          if (cancelled) return
          setInvites(rows)
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load campaign details.',
          )
          setLoading(false)
        }
      },
      (err) => {
        if (cancelled) return
        setError(err.message)
        setLoading(false)
      },
    )
  }, [user])

  return { invites, contexts, loading, error }
}

export default function MyInvites() {
  const { invites, contexts, loading, error } = useMyInvites()
  const { respond, error: responseError } = useRespondToInvite()
  const [queryText, setQueryText] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [roleFilters, setRoleFilters] = useState<RelationshipRole[]>([])
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [page, setPage] = useState(1)
  const [actionInviteId, setActionInviteId] = useState<string | null>(null)

  const stats = useMemo(() => {
    const pending = invites.filter((invite) => invite.status === 'pending')
    const accepted = invites.filter((invite) => invite.status === 'confirmed')
    const declined = invites.filter((invite) => invite.status === 'declined')
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const newThisWeek = pending.filter(
      (invite) => toMillis(invite.sentAt) >= sevenDaysAgo,
    ).length
    const completed = accepted.length + declined.length
    const responseRate = completed
      ? Math.round((accepted.length / completed) * 100)
      : 0

    return {
      pending: pending.length,
      accepted: accepted.length,
      declined: declined.length,
      newThisWeek,
      responseRate,
    }
  }, [invites])

  const roleInsights = useMemo(() => {
    const pending = invites.filter((invite) => invite.status === 'pending')
    const total = pending.length || 1

    return ROLE_FILTERS.map(({ label, value }) => {
      const count = pending.filter((invite) => invite.assignedRole === value).length
      return {
        label,
        value,
        count,
        percent: Math.round((count / total) * 100),
      }
    }).filter((row) => row.count > 0)
  }, [invites])

  const filteredInvites = useMemo(() => {
    const normalizedSearch = queryText.trim().toLowerCase()
    const rows = invites.filter((invite) => {
      const event = contexts[invite.contextId]
      const matchesStatus =
        statusFilter === 'all' ? true : invite.status === statusFilter
      const matchesRole = roleFilters.length
        ? roleFilters.includes(invite.assignedRole)
        : true
      const haystack = [
        invite.contextName,
        invite.assignedRole,
        invite.relationshipType,
        invite.aiReason,
        event?.name,
        event?.field,
        event?.type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return (
        matchesStatus &&
        matchesRole &&
        (!normalizedSearch || haystack.includes(normalizedSearch))
      )
    })

    rows.sort((a, b) => {
      if (sortMode === 'oldest') return toMillis(a.sentAt) - toMillis(b.sentAt)
      if (sortMode === 'confidence') return b.confidence - a.confidence
      return toMillis(b.sentAt) - toMillis(a.sentAt)
    })

    return rows
  }, [contexts, invites, queryText, roleFilters, sortMode, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredInvites.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visibleInvites = filteredInvites.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  )

  useEffect(() => {
    setPage(1)
  }, [queryText, roleFilters, sortMode, statusFilter])

  const handleRoleSelect = (value: string) => {
    setRoleFilters(value ? [value as RelationshipRole] : [])
  }

  const handleRespond = async (
    inviteId: string,
    response: 'accepted' | 'declined',
  ) => {
    setActionInviteId(inviteId)
    try {
      await respond(inviteId, response)
    } catch {
      // The hook exposes the error below the filters.
    } finally {
      setActionInviteId(null)
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-950">
            My Invites
          </h1>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Review and manage your ecosystem invitations.
          </p>
        </div>
        <div className="flex items-center gap-3 text-slate-500">
          <button
            type="button"
            className="relative grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white shadow-sm transition-colors hover:text-blue-600"
            aria-label="Notifications"
          >
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white shadow-sm transition-colors hover:text-blue-600"
            aria-label="Help"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 2-3 4" />
              <path d="M12 17h.01" />
            </svg>
          </button>
        </div>
      </header>

      <section className="grid gap-3 xl:grid-cols-[repeat(4,minmax(0,1fr))_1.2fr]">
        <StatCard
          icon="mail"
          iconClass="bg-blue-100 text-blue-600"
          value={stats.pending}
          label="Pending Invites"
          helper={`${stats.newThisWeek} new this week`}
        />
        <StatCard
          icon="check"
          iconClass="bg-emerald-100 text-emerald-600"
          value={stats.accepted}
          label="Accepted"
          helper="Active ecosystem links"
        />
        <StatCard
          icon="x"
          iconClass="bg-red-100 text-red-600"
          value={stats.declined}
          label="Declined"
          helper="Archived responses"
        />
        <StatCard
          icon="rate"
          iconClass="bg-amber-100 text-amber-600"
          value={`${stats.responseRate}%`}
          label="Response Rate"
          helper="Your avg. acceptance"
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-blue-50 text-blue-600">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 17 9 11l4 4 8-8" />
                <path d="M14 7h7v7" />
              </svg>
            </span>
            <h2 className="text-xs font-black text-slate-950">Invite Insights</h2>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xl font-black text-slate-950">{stats.pending}</p>
              <p className="text-xs font-medium text-slate-500">Pending</p>
            </div>
            <div className="min-w-32 space-y-1.5">
              {roleInsights.length ? (
                roleInsights.map((row) => (
                  <div key={row.value} className="flex items-center justify-between gap-3 text-[11px] font-bold text-slate-600">
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${
                        row.value === 'Mentor'
                          ? 'bg-violet-500'
                          : row.value === 'Partner'
                            ? 'bg-orange-500'
                            : row.value === 'Startup/Company'
                              ? 'bg-emerald-500'
                              : 'bg-blue-500'
                      }`} />
                      {row.label}
                    </span>
                    <span>{row.count} ({row.percent}%)</span>
                  </div>
                ))
              ) : (
                <p className="text-[11px] font-medium text-slate-500">
                  No pending role mix yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-2.5 xl:grid-cols-[minmax(360px,1fr)_auto_auto_auto] xl:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search invites</span>
          <input
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            placeholder="Search invites by name, role, campaign or context..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-4 pr-10 text-xs font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
          <svg className="absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </label>

        <div className="flex flex-wrap gap-2 xl:flex-nowrap">
          {[
            { label: 'All Invites', value: 'all' as const },
            { label: 'Pending', value: 'pending' as const },
            { label: 'Accepted', value: 'confirmed' as const },
            { label: 'Declined', value: 'declined' as const },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setStatusFilter(item.value)}
              className={`h-10 rounded-xl border px-3.5 text-xs font-black transition ${
                statusFilter === item.value
                  ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-sm shadow-blue-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label>
          <span className="sr-only">Filter by role</span>
          <select
            value={roleFilters[0] ?? ''}
            onChange={(event) => handleRoleSelect(event.target.value)}
            className="h-10 min-w-44 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">All roles</option>
            {ROLE_FILTERS.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="sr-only">Sort invites</span>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          >
            <option value="recent">Sort by: Most recent</option>
            <option value="oldest">Sort by: Oldest</option>
            <option value="confidence">Sort by: Match confidence</option>
          </select>
        </label>
      </section>

      {(error || responseError) && (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">
          {error || responseError}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center gap-3 px-5 py-10 text-xs font-semibold text-slate-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            Loading your invites...
          </div>
        ) : visibleInvites.length ? (
          <div className="divide-y divide-slate-100">
            {visibleInvites.map((invite) => {
              const event = contexts[invite.contextId]
              const isPending = invite.status === 'pending'
              const isWorking = actionInviteId === invite.id

              return (
                <div key={invite.id} className="grid gap-3 px-4 py-3 transition hover:bg-slate-50 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                  <Link to={`/invites/${invite.id}`} className="flex min-w-0 items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-50 to-slate-100 text-xs font-black text-slate-700 ring-1 ring-slate-100">
                      {initials(invite.contextName)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-xs font-black text-slate-950">
                          {invite.contextName}
                        </h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ${ROLE_STYLES[invite.assignedRole] ?? ROLE_STYLES['Programme Admin']}`}>
                          {roleLabel(invite.assignedRole)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                        {event?.type || invite.relationshipType.replaceAll('_', ' ')}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M8 2v4" />
                          <path d="M16 2v4" />
                          <rect width="18" height="18" x="3" y="4" rx="2" />
                          <path d="M3 10h18" />
                        </svg>
                        {formatEventMeta(event, invite)}
                      </p>
                    </div>
                  </Link>

                  <div className="flex items-center text-[11px] font-semibold text-slate-500 lg:justify-end">
                    Invited {formatRelativeTime(invite.sentAt)}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                    {isPending ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleRespond(invite.id, 'accepted')}
                          disabled={isWorking || actionInviteId !== null}
                          className="h-8 rounded-lg bg-blue-600 px-5 text-xs font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isWorking ? 'Saving...' : 'Accept'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRespond(invite.id, 'declined')}
                          disabled={isWorking || actionInviteId !== null}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-5 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Decline
                        </button>
                      </>
                    ) : (
                      <span className={`rounded-full px-3 py-1 text-[11px] font-black ${
                        invite.status === 'confirmed'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {invite.status === 'confirmed' ? 'Accepted' : 'Declined'}
                      </span>
                    )}
                    <Link
                      to={`/invites/${invite.id}`}
                      className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label={`Open ${invite.contextName} invite`}
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <circle cx="12" cy="5" r="1.8" />
                        <circle cx="12" cy="12" r="1.8" />
                        <circle cx="12" cy="19" r="1.8" />
                      </svg>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-blue-600">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect width="18" height="14" x="3" y="5" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
            </div>
            <h2 className="mt-4 text-sm font-black text-slate-950">
              No invites found
            </h2>
            <p className="mt-2 text-xs font-medium text-slate-500">
              Try another filter, or check back when a campaign organizer invites you.
            </p>
          </div>
        )}

        {!loading && filteredInvites.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5">
            <p className="text-[11px] font-bold text-slate-500">
              Showing {(safePage - 1) * PAGE_SIZE + 1} to{' '}
              {Math.min(safePage * PAGE_SIZE, filteredInvites.length)} of{' '}
              {filteredInvites.length} invites
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={safePage === 1}
                className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-xs font-black text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                &lt;
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                (pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={`grid h-7 w-7 place-items-center rounded-lg border text-xs font-black transition ${
                      safePage === pageNumber
                        ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {pageNumber}
                  </button>
                ),
              )}
              <button
                type="button"
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={safePage === totalPages}
                className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-xs font-black text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                &gt;
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
