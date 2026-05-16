import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import type { EcoEvent, EcosystemContext, EventStatus, Invite } from '../types'

type TabKey = 'all' | 'events' | 'programmes' | 'initiatives' | 'cohorts'

type ContextRow = {
  id: string
  name: string
  contextType: 'Event' | 'Programme' | 'Initiative' | 'Cohort' | 'CountryExpansion'
  typeLabel: string
  field: string
  location: string
  startDate?: unknown
  endDate?: unknown
  createdAt?: unknown
  status: EventStatus
  imageUrl?: string
  needsCount: number
  source: 'events' | 'ecosystemContexts'
}

type InviteCounts = Record<string, { confirmed: number; total: number }>

const TABS: { key: TabKey; label: string; accepts: (row: ContextRow) => boolean }[] = [
  { key: 'all', label: 'All', accepts: () => true },
  { key: 'events', label: 'Events', accepts: (row) => row.contextType === 'Event' },
  { key: 'programmes', label: 'Programmes', accepts: (row) => row.contextType === 'Programme' },
  { key: 'initiatives', label: 'Initiatives', accepts: (row) => row.contextType === 'Initiative' },
  { key: 'cohorts', label: 'Cohorts', accepts: (row) => row.contextType === 'Cohort' },
]

const TYPE_STYLES: Record<ContextRow['contextType'], string> = {
  Event: 'bg-blue-50 text-blue-700',
  Programme: 'bg-emerald-50 text-emerald-700',
  Initiative: 'bg-violet-50 text-violet-700',
  Cohort: 'bg-amber-50 text-amber-700',
  CountryExpansion: 'bg-slate-100 text-slate-700',
}

const STATUS_STYLES = {
  Active: 'bg-emerald-50 text-emerald-700',
  Upcoming: 'bg-blue-50 text-blue-700',
  Past: 'bg-slate-100 text-slate-700',
  Draft: 'bg-gray-100 text-gray-600',
}

function toMillis(value: unknown): number {
  if (!value) return 0
  const timestamp = value as { toMillis?: () => number; seconds?: number }
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis()
  if (typeof timestamp.seconds === 'number') return timestamp.seconds * 1000
  if (typeof value === 'number') return value
  return 0
}

function formatDate(value: unknown): string {
  const millis = toMillis(value)
  if (!millis) return 'Ongoing'
  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(millis))
}

function dateLabel(row: ContextRow): string {
  const start = toMillis(row.startDate)
  const end = toMillis(row.endDate)
  if (!start && !end) return 'Ongoing'
  if (start && end && start !== end) return `${formatDate(start)} - ${formatDate(end)}`
  return formatDate(start || end)
}

function statusLabel(row: ContextRow): keyof typeof STATUS_STYLES {
  const now = Date.now()
  const start = toMillis(row.startDate)
  const end = toMillis(row.endDate)
  if (row.status === 'draft') return 'Draft'
  if (row.status === 'closed' || row.status === 'completed') return 'Past'
  if (end && end < now) return 'Past'
  if (start && start > now) return 'Upcoming'
  return 'Active'
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase()
}

function normalizeEvent(event: EcoEvent): ContextRow {
  return {
    id: event.id,
    name: event.name,
    contextType: 'Event',
    typeLabel: event.type || 'Event',
    field: event.field,
    location:
      event.location ||
      (event.locationType === 'Virtual' ? 'Virtual Event' : event.field || 'Ecosystem context'),
    startDate: event.eventDate,
    createdAt: event.createdAt,
    status: event.status,
    imageUrl: event.imageUrl,
    needsCount: event.roleRequirements?.reduce((sum, need) => sum + need.count, 0) ?? 0,
    source: 'events',
  }
}

function normalizeContext(context: EcosystemContext): ContextRow {
  return {
    id: context.id,
    name: context.name,
    contextType: context.contextType,
    typeLabel: context.contextType === 'CountryExpansion' ? 'Country Expansion' : context.contextType,
    field: context.field,
    location:
      context.location ||
      (context.locationType === 'Virtual' ? 'Virtual Programme' : context.field),
    startDate: context.startDate,
    endDate: context.endDate,
    createdAt: context.createdAt,
    status: context.status,
    imageUrl: context.imageUrl,
    needsCount: context.relationshipNeeds?.reduce((sum, need) => sum + need.count, 0) ?? 0,
    source: 'ecosystemContexts',
  }
}

function Icon({ name }: { name: 'search' | 'bell' | 'plus' | 'more' | 'chevron' }) {
  const common = {
    className: 'h-4 w-4',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    viewBox: '0 0 24 24',
    'aria-hidden': true,
  }

  switch (name) {
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      )
    case 'bell':
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      )
    case 'more':
      return (
        <svg {...common}>
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      )
    case 'chevron':
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      )
  }
}

function useMyContextRows() {
  const { user } = useAuth()
  const [eventRows, setEventRows] = useState<ContextRow[]>([])
  const [contextRows, setContextRows] = useState<ContextRow[]>([])
  const [inviteCounts, setInviteCounts] = useState<InviteCounts>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) {
      setEventRows([])
      setContextRows([])
      setInviteCounts({})
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    let pending = 3
    const markLoaded = () => {
      pending -= 1
      if (pending === 0) setLoading(false)
    }
    const fail = (message: string) => {
      setError(message)
      setLoading(false)
    }

    const eventsQuery = query(collection(db, 'events'), where('createdBy', '==', user.uid))
    const contextsQuery = query(
      collection(db, 'ecosystemContexts'),
      where('createdBy', '==', user.uid),
    )
    const invitesQuery = query(collection(db, 'invites'), where('invitedBy', '==', user.uid))

    const unsubscribeEvents = onSnapshot(
      eventsQuery,
      (snap) => {
        setEventRows(snap.docs.map((doc) => normalizeEvent({ id: doc.id, ...doc.data() } as EcoEvent)))
        markLoaded()
      },
      (err) => fail(err.message),
    )
    const unsubscribeContexts = onSnapshot(
      contextsQuery,
      (snap) => {
        setContextRows(
          snap.docs.map((doc) => normalizeContext({ id: doc.id, ...doc.data() } as EcosystemContext)),
        )
        markLoaded()
      },
      (err) => fail(err.message),
    )
    const unsubscribeInvites = onSnapshot(
      invitesQuery,
      (snap) => {
        const next: InviteCounts = {}
        snap.docs.forEach((doc) => {
          const invite = { id: doc.id, ...doc.data() } as Invite
          const current = next[invite.contextId] ?? { confirmed: 0, total: 0 }
          current.total += 1
          if (invite.status === 'confirmed') current.confirmed += 1
          next[invite.contextId] = current
        })
        setInviteCounts(next)
        markLoaded()
      },
      (err) => fail(err.message),
    )

    return () => {
      unsubscribeEvents()
      unsubscribeContexts()
      unsubscribeInvites()
    }
  }, [user])

  const rows = useMemo(
    () =>
      [...contextRows, ...eventRows]
        .sort((a, b) => {
          const aTime = toMillis(a.startDate) || toMillis(a.createdAt)
          const bTime = toMillis(b.startDate) || toMillis(b.createdAt)
          return bTime - aTime
        }),
    [contextRows, eventRows],
  )

  return { rows, inviteCounts, loading, error }
}

function ContextAvatar({ row }: { row: ContextRow }) {
  if (row.imageUrl) {
    return (
      <img
        src={row.imageUrl}
        alt=""
        className="h-9 w-9 rounded-lg object-cover ring-1 ring-slate-200"
      />
    )
  }

  const palette: Record<ContextRow['contextType'], string> = {
    Event: 'from-slate-950 to-blue-900',
    Programme: 'from-lime-950 to-emerald-600',
    Initiative: 'from-teal-800 to-amber-500',
    Cohort: 'from-indigo-900 to-sky-500',
    CountryExpansion: 'from-slate-700 to-slate-400',
  }

  return (
    <div
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${palette[row.contextType]} text-[10px] font-black text-white shadow-sm`}
    >
      {initials(row.name)}
    </div>
  )
}

export default function MyContexts() {
  const { rows, inviteCounts, loading, error } = useMyContextRows()
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [search, setSearch] = useState('')

  const tabCounts = useMemo(
    () =>
      TABS.reduce<Record<TabKey, number>>((acc, tab) => {
        acc[tab.key] = rows.filter(tab.accepts).length
        return acc
      }, {} as Record<TabKey, number>),
    [rows],
  )

  const visibleRows = useMemo(() => {
    const active = TABS.find((tab) => tab.key === activeTab) ?? TABS[0]
    const term = search.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesTab = active.accepts(row)
      const matchesSearch =
        !term ||
        [row.name, row.field, row.location, row.typeLabel].some((value) =>
          value.toLowerCase().includes(term),
        )
      return matchesTab && matchesSearch
    })
  }, [activeTab, rows, search])

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-950">My Contexts</h1>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Manage your events, programmes and initiatives.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative block">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <Icon name="search" />
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search contexts..."
              className="h-10 w-64 rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs font-medium text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </label>
          <button
            type="button"
            className="relative grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:text-blue-600"
            aria-label="Notifications"
          >
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
            <Icon name="bell" />
          </button>
          <Link
            to="/create-context"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
          >
            <Icon name="plus" />
            Create Context
          </Link>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Context filters">
        {TABS.map((tab) => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`h-10 rounded-xl border px-3.5 text-xs font-black transition ${
                active
                  ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-sm shadow-blue-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label} ({tabCounts[tab.key] ?? 0})
            </button>
          )
        })}
      </nav>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {error ? (
          <p className="m-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-3 px-5 py-10 text-xs font-semibold text-slate-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            Loading contexts...
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-black text-slate-700">
                    <th className="px-4 py-3">Context</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Dates</th>
                    <th className="px-4 py-3">Confirmed</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-xs font-semibold text-slate-500">
                        {search ? 'No contexts match your search.' : 'No contexts yet. Create one to start.'}
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map((row) => {
                      const status = statusLabel(row)
                      const counts = inviteCounts[row.id] ?? { confirmed: 0, total: 0 }
                      return (
                        <tr key={`${row.source}-${row.id}`} className="group transition hover:bg-slate-50/70">
                          <td className="px-4 py-3">
                            <Link to={`/contexts/${row.id}`} className="flex min-w-0 items-center gap-3">
                              <ContextAvatar row={row} />
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-black text-slate-950">
                                  {row.name}
                                </span>
                                <span className="mt-0.5 block truncate text-xs font-medium text-slate-500">
                                  {row.location}
                                </span>
                              </span>
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ring-inset ${TYPE_STYLES[row.contextType]}`}>
                              {row.typeLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-medium text-slate-600">{dateLabel(row)}</td>
                          <td
                            className="px-4 py-3 text-xs font-black text-slate-900"
                            title={`${counts.total} invite${counts.total === 1 ? '' : 's'} sent`}
                          >
                            {counts.confirmed}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black ${STATUS_STYLES[status]}`}>
                              {status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                to={`/contexts/${row.id}`}
                                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-blue-600"
                                aria-label={`Open ${row.name}`}
                                title={`Open ${row.name}`}
                              >
                                <Icon name="chevron" />
                              </Link>
                              <button
                                type="button"
                                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                aria-label={`More actions for ${row.name}`}
                                title="More actions"
                              >
                                <Icon name="more" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5">
              <span className="text-[11px] font-bold text-slate-500">
                Showing {visibleRows.length === 0 ? 0 : 1} to {visibleRows.length} of {visibleRows.length} contexts
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled
                  className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-xs font-black text-slate-300 disabled:opacity-70"
                  aria-label="Previous page"
                >
                  <span className="rotate-180">
                    <Icon name="chevron" />
                  </span>
                </button>
                <span className="grid h-7 min-w-7 place-items-center rounded-lg bg-blue-600 px-2 text-xs font-black text-white shadow-lg shadow-blue-500/20">
                  1
                </span>
                <button
                  type="button"
                  disabled
                  className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-xs font-black text-slate-300 disabled:opacity-70"
                  aria-label="Next page"
                >
                  <Icon name="chevron" />
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  )
}
