import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import * as d3 from 'd3'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { useEvents } from '../hooks/useEvents'
import { useEcosystemLinks } from '../hooks/useEcosystemLinks'
import { useRespondToInvite } from '../hooks/useRespondToInvite'
import type {
  EcoEvent,
  EcosystemLink,
  Invite,
  RelationshipRole,
} from '../types'

type Profile = {
  id: string
  name: string
  headline: string
  photoURL: string
}

type GraphNode = d3.SimulationNodeDatum & {
  id: string
  label: string
  role: RelationshipRole | 'You'
  isHub?: boolean
}

type GraphEdge = d3.SimulationLinkDatum<GraphNode>

const ROLE_STYLES: Record<string, string> = {
  Mentor: 'bg-violet-50 text-violet-700 ring-violet-100',
  Partner: 'bg-orange-50 text-orange-700 ring-orange-100',
  'Startup/Company': 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  'Service Provider': 'bg-cyan-50 text-cyan-700 ring-cyan-100',
  'Programme Admin': 'bg-slate-100 text-slate-700 ring-slate-200',
}

const ROLE_COLORS: Record<string, string> = {
  Mentor: '#8b5cf6',
  Partner: '#f59e0b',
  'Startup/Company': '#22c55e',
  'Service Provider': '#14b8a6',
  'Programme Admin': '#64748b',
  You: '#2563eb',
}

function linkedNode(value: string | number | GraphNode): GraphNode | null {
  return typeof value === 'object' && value !== null ? value : null
}

function toMillis(value: unknown): number {
  if (!value) return 0
  const timestamp = value as { toMillis?: () => number; seconds?: number }
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis()
  if (typeof timestamp.seconds === 'number') return timestamp.seconds * 1000
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

function formatRelativeTime(value: unknown): string {
  const millis = toMillis(value)
  if (!millis) return 'recently'
  const diff = Date.now() - millis
  const hour = 60 * 60 * 1000
  const day = 24 * hour
  if (diff < hour) return `${Math.max(1, Math.floor(diff / 60000))}m ago`
  if (diff < day) return `${Math.max(1, Math.floor(diff / hour))}h ago`
  return `${Math.max(1, Math.floor(diff / day))}d ago`
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

function roleLabel(role: RelationshipRole): string {
  return role === 'Startup/Company' ? 'Startup' : role
}

function useDashboardInvites() {
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
    setError('')
    const invitesQuery = query(
      collection(db, 'invites'),
      where('invitedUserId', '==', user.uid),
    )

    return onSnapshot(
      invitesQuery,
      (snap) => {
        const rows = snap.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Invite[]
        rows.sort((a, b) => toMillis(b.sentAt) - toMillis(a.sentAt))
        setInvites(rows)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
  }, [user])

  return { invites, loading, error }
}

function useProfiles(ids: string[]) {
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const stableIds = useMemo(() => Array.from(new Set(ids.filter(Boolean))), [ids])

  useEffect(() => {
    if (stableIds.length === 0) {
      setProfiles({})
      return
    }

    const unsubscribers = stableIds.map((id) =>
      onSnapshot(doc(db, 'users', id), (snap) => {
        const data = snap.data()
        setProfiles((current) => ({
          ...current,
          [id]: {
            id,
            name: data?.name || data?.email?.split('@')[0] || 'PoyoLink User',
            headline: data?.headline || 'Ecosystem Builder',
            photoURL: data?.photoURL || '',
          },
        }))
      }),
    )

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [stableIds])

  return profiles
}

function Icon({ name }: { name: 'calendar' | 'mail' | 'links' | 'score' | 'bell' | 'help' | 'arrow' }) {
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
    case 'calendar':
      return (
        <svg {...common}>
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <rect width="18" height="17" x="3" y="4" rx="2" />
          <path d="M3 10h18" />
        </svg>
      )
    case 'mail':
      return (
        <svg {...common}>
          <rect width="18" height="14" x="3" y="5" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      )
    case 'links':
      return (
        <svg {...common}>
          <circle cx="6" cy="12" r="2" />
          <circle cx="18" cy="5" r="2" />
          <circle cx="18" cy="19" r="2" />
          <path d="m8 11 8-5" />
          <path d="m8 13 8 5" />
        </svg>
      )
    case 'score':
      return (
        <svg {...common}>
          <path d="M3 17 9 11l4 4 8-8" />
          <path d="M14 7h7v7" />
        </svg>
      )
    case 'bell':
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      )
    case 'help':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4" />
          <path d="M12 17h.01" />
        </svg>
      )
    case 'arrow':
      return (
        <svg {...common}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      )
  }
}

function StatCard({
  icon,
  iconClass,
  value,
  label,
  helper,
}: {
  icon: 'calendar' | 'mail' | 'links' | 'score'
  iconClass: string
  value: string | number
  label: string
  helper: string
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${iconClass}`}>
          <Icon name={icon} />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-black leading-none text-slate-950">{value}</p>
          <h2 className="mt-1 text-xs font-black text-slate-950">{label}</h2>
          <p className="mt-1 truncate text-[11px] font-medium text-slate-500">{helper}</p>
        </div>
      </div>
    </article>
  )
}

function Panel({
  title,
  actionLabel,
  actionHref,
  children,
}: {
  title: string
  actionLabel?: string
  actionHref?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <h2 className="text-sm font-black text-slate-950">{title}</h2>
        {actionLabel && actionHref ? (
          <Link to={actionHref} className="text-xs font-black text-blue-600 hover:text-blue-700">
            {actionLabel}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-xs font-semibold text-slate-500">
      {label}
    </p>
  )
}

function UpcomingContexts({ events }: { events: EcoEvent[] }) {
  const visible = events.slice(0, 3)

  if (visible.length === 0) {
    return <EmptyState label="No contexts yet. Create one to start building your ecosystem." />
  }

  return (
    <div className="divide-y divide-slate-100">
      {visible.map((event) => {
        const totalNeeded = event.roleRequirements.reduce((sum, need) => sum + need.count, 0)

        return (
          <Link
            key={event.id}
            to={`/events/${event.id}`}
            className="grid gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-[48px_1fr_auto_auto] sm:items-center"
          >
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-blue-900 to-slate-800 text-[10px] font-black uppercase text-white">
              {initials(event.name)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-sm font-black text-slate-950">{event.name}</h3>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-700 ring-1 ring-blue-100">
                  {event.type || event.contextType}
                </span>
              </div>
              <p className="mt-1 truncate text-xs font-medium text-slate-500">{event.field || 'Ecosystem context'}</p>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">{formatDate(event.eventDate)}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm font-black text-slate-950">{totalNeeded}</p>
              <p className="text-[11px] font-bold capitalize text-emerald-600">{event.status}</p>
            </div>
            <span className="hidden text-slate-400 sm:block">
              <Icon name="arrow" />
            </span>
          </Link>
        )
      })}
    </div>
  )
}

function RecentInvites({
  invites,
  profiles,
}: {
  invites: Invite[]
  profiles: Record<string, Profile>
}) {
  const { respond, isLoading } = useRespondToInvite()
  const [activeInviteId, setActiveInviteId] = useState<string | null>(null)
  const visible = invites.filter((invite) => invite.status === 'pending').slice(0, 3)

  const handleRespond = async (inviteId: string, response: 'accepted' | 'declined') => {
    setActiveInviteId(inviteId)
    try {
      await respond(inviteId, response)
    } finally {
      setActiveInviteId(null)
    }
  }

  if (visible.length === 0) {
    return <EmptyState label="No pending invites right now." />
  }

  return (
    <div className="divide-y divide-slate-100">
      {visible.map((invite) => {
        const profile = profiles[invite.invitedBy]
        const name = profile?.name || 'Ecosystem Builder'
        const working = activeInviteId === invite.id

        return (
          <div key={invite.id} className="grid gap-3 py-3 first:pt-0 last:pb-0 lg:grid-cols-[1fr_auto] lg:items-center">
            <Link to={`/invites/${invite.id}`} className="flex min-w-0 items-center gap-3">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-700">
                  {initials(name)}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-black text-slate-950">{name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ${ROLE_STYLES[invite.assignedRole]}`}>
                    {roleLabel(invite.assignedRole)}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs font-semibold text-slate-600">{invite.contextName}</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">Invited {formatRelativeTime(invite.sentAt)}</p>
              </div>
            </Link>
            <div className="flex items-center gap-2 lg:justify-end">
              <button
                type="button"
                onClick={() => void handleRespond(invite.id, 'accepted')}
                disabled={isLoading}
                className="h-8 rounded-lg bg-blue-600 px-4 text-xs font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-60"
              >
                {working ? 'Saving' : 'Accept'}
              </button>
              <button
                type="button"
                onClick={() => void handleRespond(invite.id, 'declined')}
                disabled={isLoading}
                className="h-8 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Decline
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RecentLinks({
  links,
  profiles,
  currentUserId,
}: {
  links: EcosystemLink[]
  profiles: Record<string, Profile>
  currentUserId: string
}) {
  const visible = links.slice(0, 3)

  if (visible.length === 0) {
    return <EmptyState label="Confirmed ecosystem links will appear here." />
  }

  return (
    <div className="divide-y divide-slate-100">
      {visible.map((link) => {
        const otherUserId = link.sourceUserId === currentUserId ? link.targetUserId : link.sourceUserId
        const source = profiles[link.sourceUserId]
        const target = profiles[otherUserId]

        return (
          <Link
            key={link.id}
            to="/ecosystem-links"
            className="grid gap-3 py-3 first:pt-0 last:pb-0 md:grid-cols-[1fr_auto_auto] md:items-center"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-black text-blue-700">
                {initials(source?.name || 'You')}
              </div>
              <span className="text-slate-400">↔</span>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-xs font-black text-emerald-700">
                {initials(target?.name || 'LP')}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-slate-950">
                  {source?.name || 'You'} and {target?.name || 'Linked profile'}
                </p>
                <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">{link.contextName}</p>
              </div>
            </div>
            <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ${ROLE_STYLES[link.assignedRole]}`}>
              {link.status}
            </span>
            <p className="text-[11px] font-semibold text-slate-500 md:text-right">{formatRelativeTime(link.createdAt)}</p>
          </Link>
        )
      })}
    </div>
  )
}

function EcosystemGraphSnapshot({
  links,
  profiles,
  currentUserId,
}: {
  links: EcosystemLink[]
  profiles: Record<string, Profile>
  currentUserId: string
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const width = 560
  const height = 260

  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, GraphNode>()
    nodeMap.set(currentUserId, {
      id: currentUserId,
      label: 'You',
      role: 'You',
      isHub: true,
      fx: width / 2,
      fy: height / 2,
    })

    links.slice(0, 8).forEach((link) => {
      const otherUserId = link.sourceUserId === currentUserId ? link.targetUserId : link.sourceUserId
      const profile = profiles[otherUserId]
      if (!nodeMap.has(otherUserId)) {
        nodeMap.set(otherUserId, {
          id: otherUserId,
          label: profile?.name || roleLabel(link.assignedRole),
          role: link.assignedRole,
        })
      }
    })

    const graphNodes = Array.from(nodeMap.values())
    const graphEdges = links.slice(0, 8).map((link) => ({
      source: currentUserId,
      target: link.sourceUserId === currentUserId ? link.targetUserId : link.sourceUserId,
    }))

    return { nodes: graphNodes, edges: graphEdges }
  }, [currentUserId, links, profiles])

  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    if (nodes.length <= 1) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#64748b')
        .attr('font-size', 12)
        .attr('font-weight', 700)
        .text('No links yet')
      return
    }

    const simulation = d3
      .forceSimulation<GraphNode>(nodes.map((node) => ({ ...node })))
      .force('link', d3.forceLink<GraphNode, GraphEdge>(edges).id((node) => node.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-260))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(25))

    const edgeSelection = svg
      .append('g')
      .attr('stroke', '#cbd5e1')
      .attr('stroke-dasharray', '3 3')
      .attr('stroke-width', 1.2)
      .selectAll('line')
      .data(edges)
      .join('line')

    const nodeGroup = svg
      .append('g')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(simulation.nodes())
      .join('g')

    nodeGroup
      .append('circle')
      .attr('r', (node) => (node.isHub ? 28 : 18))
      .attr('fill', (node) => ROLE_COLORS[node.role] || '#64748b')
      .attr('fill-opacity', (node) => (node.isHub ? 1 : 0.16))
      .attr('stroke', (node) => ROLE_COLORS[node.role] || '#64748b')
      .attr('stroke-width', (node) => (node.isHub ? 0 : 1.5))

    nodeGroup
      .append('text')
      .text((node) => initials(node.label))
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('fill', (node) => (node.isHub ? '#fff' : ROLE_COLORS[node.role] || '#334155'))
      .attr('font-size', (node) => (node.isHub ? 12 : 10))
      .attr('font-weight', 900)

    simulation.on('tick', () => {
      edgeSelection
        .attr('x1', (edge) => linkedNode(edge.source)?.x ?? 0)
        .attr('y1', (edge) => linkedNode(edge.source)?.y ?? 0)
        .attr('x2', (edge) => linkedNode(edge.target)?.x ?? 0)
        .attr('y2', (edge) => linkedNode(edge.target)?.y ?? 0)
      nodeGroup.attr('transform', (node) => `translate(${node.x ?? 0},${node.y ?? 0})`)
    })

    return () => {
      simulation.stop()
    }
  }, [edges, nodes])

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="h-64 w-full"
        role="img"
        aria-label="Ecosystem graph snapshot"
      />
      <div className="flex flex-wrap justify-center gap-3 text-[10px] font-bold text-slate-500">
        {(['Mentor', 'Partner', 'Startup/Company', 'Service Provider', 'Programme Admin'] as RelationshipRole[]).map((role) => (
          <span key={role} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ROLE_COLORS[role] }} />
            {roleLabel(role)}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { events, loading: eventsLoading, error: eventsError } = useEvents()
  const { invites, loading: invitesLoading, error: invitesError } = useDashboardInvites()
  const { links, loading: linksLoading, error: linksError } = useEcosystemLinks()

  const profileIds = useMemo(
    () => [
      user?.uid || '',
      ...invites.map((invite) => invite.invitedBy),
      ...links.flatMap((link) => [link.sourceUserId, link.targetUserId]),
    ],
    [invites, links, user?.uid],
  )
  const profiles = useProfiles(profileIds)
  const currentProfile = user ? profiles[user.uid] : undefined

  const stats = useMemo(() => {
    const now = Date.now()
    const upcoming = events.filter((event) => {
      const date = toMillis(event.eventDate)
      return !date || date >= now
    }).length
    const past = Math.max(events.length - upcoming, 0)
    const pending = invites.filter((invite) => invite.status === 'pending')
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    const newThisWeek = pending.filter((invite) => toMillis(invite.sentAt) >= weekAgo).length
    const activeLinks = links.filter((link) => link.status === 'active' || link.status === 'completed')
    const confidenceValues = [
      ...invites.map((invite) => invite.confidence),
      ...links.map((link) => link.confidence),
    ].filter((value) => Number.isFinite(value))
    const avgConfidence = confidenceValues.length
      ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length)
      : 0

    return {
      contexts: events.length,
      upcoming,
      past,
      pendingInvites: pending.length,
      newThisWeek,
      links: links.length,
      activeLinks: activeLinks.length,
      avgConfidence,
    }
  }, [events, invites, links])

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => {
      const aTime = toMillis(a.eventDate) || Number.MAX_SAFE_INTEGER
      const bTime = toMillis(b.eventDate) || Number.MAX_SAFE_INTEGER
      return aTime - bTime
    }),
    [events],
  )

  const firstError = eventsError || invitesError || linksError
  const loading = eventsLoading || invitesLoading || linksLoading

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-950">Dashboard</h1>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Welcome back, {currentProfile?.name || user?.displayName || 'there'}! Here's your ecosystem overview.
          </p>
        </div>
        <div className="flex items-center gap-3 text-slate-500">
          <button
            type="button"
            className="relative grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white shadow-sm transition-colors hover:text-blue-600"
            aria-label="Notifications"
          >
            {stats.pendingInvites ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" /> : null}
            <Icon name="bell" />
          </button>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white shadow-sm transition-colors hover:text-blue-600"
            aria-label="Help"
          >
            <Icon name="help" />
          </button>
        </div>
      </header>

      {firstError ? (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
          {firstError}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon="calendar"
          iconClass="bg-blue-50 text-blue-600"
          value={stats.contexts}
          label="My Contexts"
          helper={`${stats.upcoming} upcoming, ${stats.past} past`}
        />
        <StatCard
          icon="mail"
          iconClass="bg-emerald-50 text-emerald-600"
          value={stats.pendingInvites}
          label="Pending Invites"
          helper={`${stats.newThisWeek} new this week`}
        />
        <StatCard
          icon="links"
          iconClass="bg-violet-50 text-violet-600"
          value={stats.links}
          label="Ecosystem Links"
          helper={`${stats.activeLinks} active relationships`}
        />
        <StatCard
          icon="score"
          iconClass="bg-amber-50 text-amber-600"
          value={stats.avgConfidence || '-'}
          label="AI Match Score"
          helper="Your avg. relevance"
        />
      </section>

      {loading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-6 text-xs font-semibold text-slate-500 shadow-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
          Loading your dashboard...
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.95fr]">
          <Panel title="My Upcoming Contexts" actionLabel="View all" actionHref="/contexts">
            <UpcomingContexts events={sortedEvents} />
          </Panel>

          <Panel title="Recent Invites" actionLabel="View all" actionHref="/invites">
            <RecentInvites invites={invites} profiles={profiles} />
          </Panel>

          <Panel title="Recent Ecosystem Links" actionLabel="View all" actionHref="/ecosystem-links">
            <RecentLinks links={links} profiles={profiles} currentUserId={user?.uid || ''} />
          </Panel>

          <Panel title="Ecosystem Graph (Snapshot)" actionLabel="View full graph" actionHref="/graph">
            <EcosystemGraphSnapshot links={links} profiles={profiles} currentUserId={user?.uid || ''} />
          </Panel>
        </div>
      )}
    </div>
  )
}
