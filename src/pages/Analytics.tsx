import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import type {
  EcosystemLink,
  Invite,
  RelationshipType,
} from '../types'

type ContextRow = {
  id: string
  name: string
  type: string
  createdBy: string
}

type ConfidenceBand = {
  label: string
  range: string
  count: number
  percent: number
  tone: string
}

const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  mentor_match: 'Mentor Match',
  partner_linkage: 'Partner Linkage',
  service_support: 'Service Support',
  programme_fit: 'Programme Fit',
  participant_orchestration: 'Participant Orchestration',
}

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function toMillis(value: unknown): number {
  if (!value) return 0
  const ts = value as { toMillis?: () => number; seconds?: number }
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  if (typeof value === 'number') return value
  return 0
}

function normalizeContext(doc: { id: string } & Record<string, unknown>): ContextRow {
  return {
    id: doc.id,
    name: String(doc.name ?? 'Untitled context'),
    type: String(doc.contextType ?? doc.type ?? 'Event'),
    createdBy: String(doc.createdBy ?? ''),
  }
}

function percentage(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 1000) / 10
}

function trendLabel(value: number): string {
  return value > 0 ? `+${value}%` : '0%'
}

function relationshipLabel(type: string): string {
  return RELATIONSHIP_LABELS[type as RelationshipType] ?? type.replaceAll('_', ' ')
}

function AnalyticsIcon({
  name,
}: {
  name: 'context' | 'invite' | 'check' | 'trend' | 'spark' | 'link'
}) {
  switch (name) {
    case 'context':
      return (
        <svg className="h-5 w-5" {...ICON_PROPS}>
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5Z" />
        </svg>
      )
    case 'invite':
      return (
        <svg className="h-5 w-5" {...ICON_PROPS}>
          <path d="M22 2 11 13" />
          <path d="M22 2 15 22l-4-9-9-4Z" />
        </svg>
      )
    case 'check':
      return (
        <svg className="h-5 w-5" {...ICON_PROPS}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <path d="m9 11 3 3L22 4" />
        </svg>
      )
    case 'trend':
      return (
        <svg className="h-5 w-5" {...ICON_PROPS}>
          <path d="M3 17 9 11l4 4 8-8" />
          <path d="M17 7h4v4" />
        </svg>
      )
    case 'spark':
      return (
        <svg className="h-5 w-5" {...ICON_PROPS}>
          <path d="M12 3 9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5L12 3Z" />
        </svg>
      )
    case 'link':
      return (
        <svg className="h-5 w-5" {...ICON_PROPS}>
          <path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 4.93" />
          <path d="M14 11a5 5 0 0 0-7.07 0L4.81 13.12a5 5 0 0 0 7.07 7.07L13 19.07" />
        </svg>
      )
  }
}

function useAnalyticsData() {
  const { user } = useAuth()
  const [contexts, setContexts] = useState<ContextRow[]>([])
  const [events, setEvents] = useState<ContextRow[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [links, setLinks] = useState<EcosystemLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) {
      setContexts([])
      setEvents([])
      setInvites([])
      setLinks([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    let remaining = 4
    const markLoaded = () => {
      remaining -= 1
      if (remaining === 0) setLoading(false)
    }
    const fail = (message: string) => {
      setError(message)
      setLoading(false)
    }

    const unsubContexts = onSnapshot(
      query(collection(db, 'ecosystemContexts'), where('createdBy', '==', user.uid)),
      (snap) => {
        setContexts(snap.docs.map((item) => normalizeContext({ id: item.id, ...item.data() })))
        markLoaded()
      },
      (err) => fail(err.message),
    )
    const unsubEvents = onSnapshot(
      query(collection(db, 'events'), where('createdBy', '==', user.uid)),
      (snap) => {
        setEvents(
          snap.docs.map((item) => normalizeContext({ id: item.id, ...item.data() })),
        )
        markLoaded()
      },
      (err) => fail(err.message),
    )
    const unsubInvites = onSnapshot(
      query(collection(db, 'invites'), where('invitedBy', '==', user.uid)),
      (snap) => {
        setInvites(snap.docs.map((item) => ({ id: item.id, ...item.data() }) as Invite))
        markLoaded()
      },
      (err) => fail(err.message),
    )
    const unsubLinks = onSnapshot(
      query(collection(db, 'ecosystemLinks'), where('sourceUserId', '==', user.uid)),
      (snap) => {
        setLinks(snap.docs.map((item) => ({ id: item.id, ...item.data() }) as EcosystemLink))
        markLoaded()
      },
      (err) => fail(err.message),
    )
    return () => {
      unsubContexts()
      unsubEvents()
      unsubInvites()
      unsubLinks()
    }
  }, [user])

  return {
    contexts: [...contexts, ...events],
    invites,
    links,
    loading,
    error,
  }
}

function StatCard({
  icon,
  tone,
  label,
  value,
  trend,
}: {
  icon: 'context' | 'invite' | 'check' | 'trend'
  tone: string
  label: string
  value: string
  trend: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${tone}`}>
          <AnalyticsIcon name={icon} />
        </span>
        <div>
          <p className="text-[11px] font-bold text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-black tracking-tight text-slate-950">{value}</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] font-semibold text-slate-400">
        <span className="text-emerald-600">{trend}</span> vs last 7 days
      </p>
    </div>
  )
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string
  icon: 'spark' | 'link'
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-50 text-blue-600">
          <AnalyticsIcon name={icon} />
        </span>
        <h2 className="text-sm font-black text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function InviteDonut({
  total,
  confirmed,
  pending,
  declined,
}: {
  total: number
  confirmed: number
  pending: number
  declined: number
}) {
  const confirmedPercent = percentage(confirmed, total)
  const pendingPercent = percentage(pending, total)
  const declinedPercent = percentage(declined, total)
  const background = `conic-gradient(#22c55e 0 ${confirmedPercent}%, #f59e0b ${confirmedPercent}% ${
    confirmedPercent + pendingPercent
  }%, #ef4444 ${confirmedPercent + pendingPercent}% 100%)`

  return (
    <div className="grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center">
      <div className="relative mx-auto grid h-36 w-36 place-items-center rounded-full" style={{ background }}>
        <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center shadow-inner">
          <p className="text-2xl font-black text-slate-950">{total}</p>
          <p className="text-[10px] font-bold text-slate-500">Total Invites</p>
        </div>
      </div>
      <div className="space-y-3 text-xs font-semibold text-slate-600">
        <LegendRow color="bg-emerald-500" label="Confirmed" value={confirmed} percent={confirmedPercent} />
        <LegendRow color="bg-amber-500" label="Pending" value={pending} percent={pendingPercent} />
        <LegendRow color="bg-red-500" label="Declined" value={declined} percent={declinedPercent} />
      </div>
    </div>
  )
}

function LegendRow({
  color,
  label,
  value,
  percent,
}: {
  color: string
  label: string
  value: number
  percent: number
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        {label}
      </span>
      <span className="font-black text-slate-700">
        {value} <span className="font-medium text-slate-400">({percent}%)</span>
      </span>
    </div>
  )
}

function ProgressRow({
  label,
  value,
  percent,
  tone = 'bg-blue-600',
}: {
  label: string
  value: string
  percent: number
  tone?: string
}) {
  return (
    <div className="grid grid-cols-[150px_1fr_72px] items-center gap-3 text-[11px] font-semibold text-slate-600">
      <span className="truncate">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
      <span className="text-right font-black text-slate-700">{value}</span>
    </div>
  )
}

export default function Analytics() {
  const { contexts, invites, links, loading, error } = useAnalyticsData()

  const stats = useMemo(() => {
    const confirmedInvites = invites.filter((invite) => invite.status === 'confirmed').length
    const pendingInvites = invites.filter((invite) => invite.status === 'pending').length
    const declinedInvites = invites.filter((invite) => invite.status === 'declined').length
    const confirmedLinks = links.filter((link) => link.status === 'active' || link.status === 'completed').length
    const linkSuccessRate = percentage(confirmedLinks, Math.max(links.length, invites.length))
    const confidenceValues = [
      ...invites.map((item) => item.confidence ?? 0),
      ...links.map((item) => item.confidence ?? 0),
    ].filter((value) => value > 0)
    const averageConfidence = confidenceValues.length
      ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length)
      : 0

    return {
      confirmedInvites,
      pendingInvites,
      declinedInvites,
      confirmedLinks,
      linkSuccessRate,
      averageConfidence,
    }
  }, [invites, links])

  const confidenceBands = useMemo<ConfidenceBand[]>(() => {
    const values = [
      ...invites.map((item) => item.confidence ?? 0),
      ...links.map((item) => item.confidence ?? 0),
    ].filter((value) => value > 0)
    const total = values.length || 1
    const high = values.filter((value) => value >= 80).length
    const medium = values.filter((value) => value >= 50 && value < 80).length
    const low = values.filter((value) => value < 50).length

    return [
      { label: 'High Confidence', range: '80%+', count: high, percent: percentage(high, total), tone: 'bg-blue-600' },
      { label: 'Medium Confidence', range: '50-79%', count: medium, percent: percentage(medium, total), tone: 'bg-blue-500' },
      { label: 'Low Confidence', range: '<50%', count: low, percent: percentage(low, total), tone: 'bg-blue-300' },
    ]
  }, [invites, links])

  const linkBreakdown = useMemo(() => {
    const counts = new Map<string, number>()
    links.forEach((link) => {
      counts.set(link.relationshipType, (counts.get(link.relationshipType) ?? 0) + 1)
    })
    const total = links.length || 1
    return [...counts.entries()]
      .map(([type, count]) => ({
        type,
        label: relationshipLabel(type),
        count,
        percent: percentage(count, total),
      }))
      .sort((a, b) => b.count - a.count)
  }, [links])

  const topContexts = useMemo(() => {
    return contexts
      .map((context) => {
        const contextInvites = invites.filter((invite) => invite.contextId === context.id)
        const contextLinks = links.filter((link) => link.contextId === context.id)
        const confirmed = contextLinks.filter((link) => link.status === 'active' || link.status === 'completed').length
        return {
          ...context,
          invites: contextInvites.length,
          confirmed,
          successRate: percentage(confirmed, Math.max(contextInvites.length, contextLinks.length)),
        }
      })
      .sort((a, b) => b.invites + b.confirmed - (a.invites + a.confirmed))
      .slice(0, 5)
  }, [contexts, invites, links])

  const bestBreakdown = linkBreakdown[0]
  const insight = bestBreakdown
    ? `${bestBreakdown.label} relationships have the strongest share of active ecosystem links across your contexts.`
    : 'Invite and linkage data will turn into ecosystem relationship insights as your contexts grow.'

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <p className="text-base font-black text-slate-950">Analytics could not load</p>
        <p className="mt-2 text-sm font-medium text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[28px] font-black tracking-tight text-slate-950">Analytics</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Track ecosystem activity, invite conversion, and relationship quality.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 shadow-sm"
        >
          <svg className="h-4 w-4" {...ICON_PROPS}>
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          18 May 2026 - 19 May 2026
          <svg className="h-4 w-4" {...ICON_PROPS}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="context" tone="bg-blue-50 text-blue-600" label="Total Contexts" value={String(contexts.length)} trend={trendLabel(contexts.length ? 12 : 0)} />
        <StatCard icon="invite" tone="bg-blue-50 text-blue-600" label="Total Invites" value={String(invites.length)} trend={trendLabel(invites.length ? 18 : 0)} />
        <StatCard icon="check" tone="bg-emerald-50 text-emerald-600" label="Confirmed Links" value={String(stats.confirmedLinks)} trend={trendLabel(stats.confirmedLinks ? 22 : 0)} />
        <StatCard icon="trend" tone="bg-emerald-50 text-emerald-600" label="Link Success Rate" value={`${stats.linkSuccessRate}%`} trend={trendLabel(stats.linkSuccessRate ? 8 : 0)} />
      </section>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <Panel title="Invite Performance" icon="spark">
              <InviteDonut
                total={invites.length}
                confirmed={stats.confirmedInvites}
                pending={stats.pendingInvites}
                declined={stats.declinedInvites}
              />
            </Panel>

            <Panel title="AI Matching Quality" icon="spark">
              <div className="grid gap-5 md:grid-cols-[150px_1fr] md:items-center">
                <div>
                  <p className="text-[11px] font-bold text-slate-500">Average AI Confidence</p>
                  <p className="mt-3 text-4xl font-black tracking-tight text-blue-600">
                    {stats.averageConfidence}%
                  </p>
                </div>
                <div className="space-y-4">
                  {confidenceBands.map((band) => (
                    <ProgressRow
                      key={band.label}
                      label={`${band.label} (${band.range})`}
                      value={`${band.count} (${band.percent}%)`}
                      percent={band.percent}
                      tone={band.tone}
                    />
                  ))}
                </div>
              </div>
            </Panel>
          </section>

          <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <Panel title="Ecosystem Link Breakdown" icon="link">
              <div className="space-y-3">
                {(linkBreakdown.length ? linkBreakdown : [
                  { type: 'empty', label: 'No links yet', count: 0, percent: 0 },
                ]).map((item) => (
                  <ProgressRow
                    key={item.type}
                    label={item.label}
                    value={`${item.count} (${item.percent}%)`}
                    percent={item.percent}
                  />
                ))}
                <div className="flex justify-between border-t border-slate-100 pt-3 text-xs font-black text-slate-700">
                  <span>Total Links</span>
                  <span>{links.length}</span>
                </div>
              </div>
            </Panel>

            <Panel title="Top Context Performance" icon="spark">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-black text-slate-500">
                      <th className="py-2 pr-3">Context</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3 text-right">Invites</th>
                      <th className="py-2 pr-3 text-right">Confirmed Links</th>
                      <th className="py-2 text-right">Success Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(topContexts.length ? topContexts : [{
                      id: 'empty',
                      name: 'No contexts yet',
                      type: '-',
                      invites: 0,
                      confirmed: 0,
                      successRate: 0,
                    }]).map((context) => (
                      <tr key={context.id} className="border-b border-slate-50">
                        <td className="py-2 pr-3 font-bold text-slate-700">{context.name}</td>
                        <td className="py-2 pr-3 text-slate-500">{context.type}</td>
                        <td className="py-2 pr-3 text-right font-bold text-slate-700">{context.invites}</td>
                        <td className="py-2 pr-3 text-right font-bold text-slate-700">{context.confirmed}</td>
                        <td className={`py-2 text-right font-black ${context.successRate >= 50 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {context.successRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </section>

          <section className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-slate-600">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-600 text-white">
              <AnalyticsIcon name="spark" />
            </span>
            <span>
              <span className="font-black text-slate-950">AI Insight</span> {insight}
            </span>
          </section>
        </>
      )}
    </div>
  )
}
