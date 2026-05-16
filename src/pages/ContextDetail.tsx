/**
 * ContextDetail — the organizer's workspace for one ecosystem context.
 *
 * Top bar (breadcrumb, title, Generate AI Linkages), an info card, five live
 * stat cards, and four tabs (AI Recommendations, Invite Tracking, Ecosystem
 * Links, Activity Feed). A fixed 320px right rail summarises invites and
 * ecosystem links.
 *
 * Every collection is read with onSnapshot so counts stay live. The context
 * document is looked up in `ecosystemContexts` first, then `events`, so the
 * page works regardless of which collection a context was created in. All
 * Firestore writes happen inside Cloud Functions — never here.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore'
import type { DocumentData } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../lib/firebase'
import { useSendInvites } from '../hooks/useSendInvites'
import ContextStatCards from '../components/ContextStatCards'
import InviteStatusBadge from '../components/InviteStatusBadge'
import { confidenceColor } from '../lib/confidence'
import type {
  EcosystemLink,
  EcosystemLinkStatus,
  Invite,
  ParticipantSuggestion,
  User,
} from '../types'

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type TabKey = 'ai' | 'invites' | 'links' | 'activity'

interface ContextNeed {
  role: string
  relationshipType: string
  count: number
  requirements: string
}

interface ContextView {
  id: string
  name: string
  contextType: string
  field: string
  description: string
  location: string
  status: string
  dateLabel: string
  needs: ContextNeed[]
}

interface ActivityItem {
  id: string
  kind: 'invite-sent' | 'invite-accepted' | 'invite-declined' | 'ai-generated'
  description: string
  at: Date
}

const ROLE_FILTERS = [
  'All roles',
  'Mentor',
  'Partner',
  'Startup/Company',
  'Service Provider',
  'Programme Admin',
]

const TABS: { key: TabKey; label: string }[] = [
  { key: 'ai', label: 'AI Recommendations' },
  { key: 'invites', label: 'Invite Tracking' },
  { key: 'links', label: 'Ecosystem Links' },
  { key: 'activity', label: 'Activity Feed' },
]

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function tsToDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  const v = value as { toDate?: () => Date; seconds?: number }
  if (typeof v.toDate === 'function') {
    try {
      return v.toDate()
    } catch {
      return null
    }
  }
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000)
  return null
}

function toMillis(value: unknown): number {
  const d = tsToDate(value)
  return d ? d.getTime() : 0
}

function inviteIdentity(invite: Invite): string {
  return [
    invite.contextId,
    invite.invitedUserId,
    invite.assignedRole,
    invite.relationshipType,
  ].join('|')
}

function formatDate(value: unknown): string {
  const d = tsToDate(value)
  if (!d) return '—'
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value: unknown): string {
  const d = tsToDate(value)
  if (!d) return '—'
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatRange(start: unknown, end: unknown): string {
  const startLabel = formatDate(start)
  const endLabel = formatDate(end)
  if (startLabel === '—') return '—'
  if (endLabel === '—' || endLabel === startLabel) return startLabel
  return `${startLabel} — ${endLabel}`
}

function readableType(contextType: string): string {
  return contextType.replace(/([a-z])([A-Z])/g, '$1 $2')
}

function statusDisplay(status: string): { label: string; classes: string } {
  switch (status) {
    case 'open':
      return { label: 'Open / Upcoming', classes: 'bg-green-100 text-green-700' }
    case 'completed':
      return { label: 'Completed', classes: 'bg-blue-100 text-blue-700' }
    case 'closed':
      return { label: 'Closed', classes: 'bg-gray-100 text-gray-600' }
    case 'draft':
      return { label: 'Draft', classes: 'bg-gray-100 text-gray-600' }
    default:
      return {
        label: status ? readableType(status) : 'Unknown',
        classes: 'bg-gray-100 text-gray-600',
      }
  }
}

const ROLE_PILL: Record<string, string> = {
  Mentor: 'bg-blue-100 text-blue-700',
  Partner: 'bg-purple-100 text-purple-700',
  'Service Provider': 'bg-orange-100 text-orange-700',
  'Startup/Company': 'bg-green-100 text-green-700',
  'Programme Admin': 'bg-gray-100 text-gray-700',
}

function rolePillClass(role: string): string {
  return ROLE_PILL[role] ?? 'bg-gray-100 text-gray-700'
}

function recommendationReason(row: ParticipantSuggestion): string {
  const raw = row.reason?.trim()
  if (
    raw &&
    !raw.includes('Suggested from profile sector') &&
    raw !== 'Review candidate'
  ) {
    return raw
  }

  const profileSignal = row.headline?.trim()
  const role = row.suggestedRole || 'this role'
  const relationship = row.relationshipType?.replaceAll('_', ' ')
  return `${row.name} is recommended for ${role} because their profile${profileSignal ? ` shows ${profileSignal}` : ''} aligns with the ${relationship} need for this context.`
}

function nextActionLabel(row: ParticipantSuggestion): string {
  const raw = row.suggestedNextAction?.trim()
  if (raw && raw !== 'Review candidate') return raw
  if (row.suggestedRole === 'Mentor') return 'Invite as mentor.'
  if (row.suggestedRole === 'Partner') return 'Invite as partner.'
  if (row.suggestedRole === 'Service Provider') return 'Invite as service provider.'
  if (row.suggestedRole === 'Startup/Company') return 'Invite as startup.'
  return 'Send invite.'
}

const LINK_STATUS_PILL: Record<EcosystemLinkStatus, string> = {
  suggested: 'bg-gray-100 text-gray-600',
  invited: 'bg-amber-100 text-amber-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-700',
  declined: 'bg-red-100 text-red-700',
  archived: 'bg-gray-100 text-gray-500',
}

function linkStatusClass(status: EcosystemLinkStatus): string {
  return LINK_STATUS_PILL[status] ?? 'bg-gray-100 text-gray-600'
}

function initials(name: string): string {
  return (
    name
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  )
}

function normalizeNeeds(raw: unknown): ContextNeed[] {
  if (!Array.isArray(raw)) return []
  return raw.map((entry: DocumentData) => ({
    role: String(entry?.role ?? ''),
    relationshipType: String(entry?.relationshipType ?? ''),
    count: Number(entry?.count ?? 0),
    requirements: String(entry?.requirements ?? ''),
  }))
}

function normalizeContext(
  source: 'ecosystemContexts' | 'events',
  data: DocumentData,
  id: string,
): ContextView {
  if (source === 'ecosystemContexts') {
    return {
      id,
      name: String(data.name ?? 'Untitled context'),
      contextType: String(data.contextType ?? 'Event'),
      field: String(data.field ?? '—'),
      description: String(data.description ?? ''),
      location: String(data.location ?? '').trim() || '—',
      status: String(data.status ?? 'draft'),
      dateLabel: formatRange(data.startDate, data.endDate),
      needs: normalizeNeeds(data.relationshipNeeds),
    }
  }
  return {
    id,
    name: String(data.name ?? 'Untitled context'),
    contextType: String(data.contextType ?? 'Event'),
    field: String(data.field ?? '—'),
    description: String(data.description ?? ''),
    location: '—',
    status: String(data.status ?? 'draft'),
    dateLabel: data.eventDate ? formatDateTime(data.eventDate) : '—',
    needs: normalizeNeeds(data.roleRequirements),
  }
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function ContextDetail() {
  const { contextId } = useParams<{ contextId: string }>()
  const navigate = useNavigate()

  // --- Live data ----------------------------------------------------------
  const [eco, setEco] = useState<{ loaded: boolean; data: DocumentData | null }>(
    { loaded: false, data: null },
  )
  const [evt, setEvt] = useState<{ loaded: boolean; data: DocumentData | null }>(
    { loaded: false, data: null },
  )
  const [suggestions, setSuggestions] = useState<ParticipantSuggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(true)
  const [invites, setInvites] = useState<Invite[]>([])
  const [links, setLinks] = useState<EcosystemLink[]>([])
  const [userMap, setUserMap] = useState<Map<string, User>>(new Map())
  const [errors, setErrors] = useState<string[]>([])

  // --- UI state -----------------------------------------------------------
  const [activeTab, setActiveTab] = useState<TabKey>('ai')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All roles')
  const [confidenceSort, setConfidenceSort] = useState<'high' | 'low' | 'all'>(
    'high',
  )
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [rejectedSuggestionIds, setRejectedSuggestionIds] = useState<Set<string>>(
    new Set(),
  )
  const [profileFor, setProfileFor] = useState<ParticipantSuggestion | null>(
    null,
  )
  const [generating, setGenerating] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{
    type: 'error' | 'success'
    message: string
  } | null>(null)

  const { sendInvites } = useSendInvites()

  const pushError = useCallback((message: string) => {
    setErrors((prev) => (prev.includes(message) ? prev : [...prev, message]))
  }, [])

  // Context document — ecosystemContexts first, events as a fallback.
  useEffect(() => {
    if (!contextId) return
    setEco({ loaded: false, data: null })
    setEvt({ loaded: false, data: null })

    const unsubEco = onSnapshot(
      doc(db, 'ecosystemContexts', contextId),
      (snap) => {
        const data = snap.data()
        setEco({
          loaded: true,
          data: snap.exists() && data ? { id: snap.id, ...data } : null,
        })
      },
      (err) => {
        setEco({ loaded: true, data: null })
        pushError(`Could not load the context: ${err.message}`)
      },
    )
    const unsubEvt = onSnapshot(
      doc(db, 'events', contextId),
      (snap) => {
        const data = snap.data()
        setEvt({
          loaded: true,
          data: snap.exists() && data ? { id: snap.id, ...data } : null,
        })
      },
      // The events fallback is optional — a miss here is not a hard error.
      () => setEvt({ loaded: true, data: null }),
    )
    return () => {
      unsubEco()
      unsubEvt()
    }
  }, [contextId, pushError])

  // Participant suggestions subcollection.
  useEffect(() => {
    if (!contextId) return
    setSuggestionsLoading(true)
    const unsub = onSnapshot(
      collection(db, 'suggestions', contextId, 'participants'),
      (snap) => {
        const rows = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as ParticipantSuggestion,
        )
        rows.sort((a, b) => a.rank - b.rank)
        setSuggestions(rows)
        setSuggestionsLoading(false)
      },
      (err) => {
        pushError(`Could not load AI recommendations: ${err.message}`)
        setSuggestionsLoading(false)
      },
    )
    return unsub
  }, [contextId, pushError])

  // Invites for this context.
  useEffect(() => {
    if (!contextId) return
    const unsub = onSnapshot(
      query(collection(db, 'invites'), where('contextId', '==', contextId)),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Invite)
        rows.sort((a, b) => toMillis(b.sentAt) - toMillis(a.sentAt))
        setInvites(rows)
      },
      (err) => pushError(`Could not load invites: ${err.message}`),
    )
    return unsub
  }, [contextId, pushError])

  // Ecosystem links for this context.
  useEffect(() => {
    if (!contextId) return
    const unsub = onSnapshot(
      query(
        collection(db, 'ecosystemLinks'),
        where('contextId', '==', contextId),
      ),
      (snap) => {
        setLinks(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EcosystemLink),
        )
      },
      (err) => pushError(`Could not load ecosystem links: ${err.message}`),
    )
    return unsub
  }, [contextId, pushError])

  // Users — used to resolve invitee / actor names and full profiles.
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const map = new Map<string, User>()
        snap.docs.forEach((d) => {
          map.set(d.id, { id: d.id, ...d.data() } as User)
        })
        setUserMap(map)
      },
      (err) => pushError(`Could not load profiles: ${err.message}`),
    )
    return unsub
  }, [pushError])

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(timer)
  }, [toast])

  // --- Derived data -------------------------------------------------------
  const ctxLoading = !eco.loaded || !evt.loaded
  const context = useMemo<ContextView | null>(() => {
    if (!contextId) return null
    if (eco.data) return normalizeContext('ecosystemContexts', eco.data, contextId)
    if (evt.data) return normalizeContext('events', evt.data, contextId)
    return null
  }, [eco.data, evt.data, contextId])
  const contextMissing = eco.loaded && evt.loaded && !eco.data && !evt.data

  const uniqueInvites = useMemo(() => {
    const byIdentity = new Map<string, Invite>()
    for (const invite of invites) {
      const key = inviteIdentity(invite)
      const existing = byIdentity.get(key)
      if (!existing || toMillis(invite.sentAt) >= toMillis(existing.sentAt)) {
        byIdentity.set(key, invite)
      }
    }
    return [...byIdentity.values()].sort((a, b) => toMillis(b.sentAt) - toMillis(a.sentAt))
  }, [invites])

  const inviteCounts = useMemo(() => {
    let pending = 0
    let confirmed = 0
    let declined = 0
    for (const invite of uniqueInvites) {
      if (invite.status === 'pending') pending += 1
      else if (invite.status === 'confirmed') confirmed += 1
      else if (invite.status === 'declined') declined += 1
    }
    return { pending, confirmed, declined, total: uniqueInvites.length }
  }, [uniqueInvites])

  const averageConfidence = useMemo(() => {
    if (suggestions.length === 0) return null
    const sum = suggestions.reduce((acc, s) => acc + (s.confidence ?? 0), 0)
    return Math.round(sum / suggestions.length)
  }, [suggestions])

  const visibleSuggestions = useMemo(() => {
    const invitedOrConfirmedUserIds = new Set(
      uniqueInvites
        .filter((invite) => invite.status === 'pending' || invite.status === 'confirmed')
        .map((invite) => invite.invitedUserId),
    )
    let rows = suggestions
    rows = rows.filter((s) => !rejectedSuggestionIds.has(s.id))
    rows = rows.filter((s) => !invitedOrConfirmedUserIds.has(s.userId))
    if (roleFilter !== 'All roles') {
      rows = rows.filter((s) => s.suggestedRole === roleFilter)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.headline ?? '').toLowerCase().includes(q),
      )
    }
    if (confidenceSort === 'high') {
      rows = [...rows].sort((a, b) => b.confidence - a.confidence)
    } else if (confidenceSort === 'low') {
      rows = [...rows].sort((a, b) => a.confidence - b.confidence)
    }
    return rows
  }, [
    suggestions,
    uniqueInvites,
    roleFilter,
    search,
    confidenceSort,
    rejectedSuggestionIds,
  ])

  const activity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = []
    for (const invite of uniqueInvites) {
      const name = userMap.get(invite.invitedUserId)?.name ?? 'a candidate'
      const sentAt = tsToDate(invite.sentAt)
      if (sentAt) {
        items.push({
          id: `${invite.id}-sent`,
          kind: 'invite-sent',
          description: `Invite sent to ${name} as ${invite.assignedRole}`,
          at: sentAt,
        })
      }
      const respondedAt = tsToDate(invite.respondedAt)
      if (respondedAt && invite.status === 'confirmed') {
        items.push({
          id: `${invite.id}-confirmed`,
          kind: 'invite-accepted',
          description: `${name} accepted the ${invite.assignedRole} invite`,
          at: respondedAt,
        })
      }
      if (respondedAt && invite.status === 'declined') {
        items.push({
          id: `${invite.id}-declined`,
          kind: 'invite-declined',
          description: `${name} declined the ${invite.assignedRole} invite`,
          at: respondedAt,
        })
      }
    }
    if (suggestions.length > 0) {
      let latest: Date | null = null
      for (const s of suggestions) {
        const d = tsToDate(s.generatedAt)
        if (d && (!latest || d > latest)) latest = d
      }
      if (latest) {
        items.push({
          id: 'ai-generated',
          kind: 'ai-generated',
          description: `AI generated ${suggestions.length} recommendation${
            suggestions.length === 1 ? '' : 's'
          }`,
          at: latest,
        })
      }
    }
    return items.sort((a, b) => b.at.getTime() - a.at.getTime())
  }, [uniqueInvites, suggestions, userMap])

  // --- Actions ------------------------------------------------------------
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allVisibleSelected =
    visibleSuggestions.length > 0 &&
    visibleSuggestions.every((s) => selectedIds.has(s.id))

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev)
        visibleSuggestions.forEach((s) => next.delete(s.id))
        return next
      }
      const next = new Set(prev)
      visibleSuggestions.forEach((s) => next.add(s.id))
      return next
    })
  }

  const handleGenerate = async () => {
    if (!contextId) return
    setGenerating(true)
    try {
      const callable = httpsCallable<{ contextId: string }, unknown>(
        functions,
        'generateParticipants',
      )
      await callable({ contextId })
      setActiveTab('ai')
      setToast({ type: 'success', message: 'AI linkages generated.' })
    } catch (err) {
      setToast({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Failed to generate AI linkages.',
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleSendSelected = async () => {
    if (!contextId) return
    const chosen = suggestions.filter((s) => selectedIds.has(s.id))
    if (chosen.length === 0) return
    try {
      await sendInvites(
        contextId,
        chosen.map((s) => ({
          userId: s.userId,
          suggestedRole: s.suggestedRole,
          relationshipType: s.relationshipType,
          reason: s.reason,
          confidence: s.confidence,
        })),
      )
      setSelectedIds(new Set())
      setToast({
        type: 'success',
        message: `Sent ${chosen.length} invite${
          chosen.length === 1 ? '' : 's'
        }.`,
      })
      navigate('/contexts')
    } catch (err) {
      setToast({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Failed to send invites.',
      })
    }
  }

  const handleRejectSelected = () => {
    if (selectedIds.size === 0) return
    setRejectedSuggestionIds((prev) => {
      const next = new Set(prev)
      selectedIds.forEach((id) => next.add(id))
      return next
    })
    const rejectedCount = selectedIds.size
    setSelectedIds(new Set())
    setToast({
      type: 'success',
      message: `Rejected ${rejectedCount} recommendation${
        rejectedCount === 1 ? '' : 's'
      }.`,
    })
  }

  const handleResend = async (invite: Invite) => {
    if (!contextId) return
    setResendingId(invite.id)
    try {
      await sendInvites(contextId, [
        {
          userId: invite.invitedUserId,
          suggestedRole: invite.assignedRole,
          relationshipType: invite.relationshipType,
          reason: invite.aiReason,
          confidence: invite.confidence,
        },
      ])
      setToast({ type: 'success', message: 'Invite resent.' })
    } catch (err) {
      setToast({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Failed to resend invite.',
      })
    } finally {
      setResendingId(null)
    }
  }

  // --- Render guards ------------------------------------------------------
  if (ctxLoading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-gray-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
        Loading context…
      </div>
    )
  }

  if (contextMissing || !context) {
    return (
      <div className="space-y-3">
        <Link
          to="/contexts"
          className="text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          ← My Contexts
        </Link>
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          This context could not be found.
        </p>
      </div>
    )
  }

  const status = statusDisplay(context.status)
  const needRoles = context.needs.map((n) => n.role).filter(Boolean)

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* ------------------------------------------------------------------ */}
      {/* TOP BAR                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <nav className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
            <Link
              to="/contexts"
              className="text-blue-600 hover:text-blue-700"
            >
              ← My Contexts
            </Link>
            <span aria-hidden>/</span>
            <span className="truncate text-slate-700">{context.name}</span>
          </nav>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-slate-950">
              {context.name}
            </h1>
            <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-700 ring-1 ring-blue-100">
              {readableType(context.contextType)}
            </span>
          </div>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Manage AI recommendations, invites, and ecosystem links for this
            context.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <IconButton label="Notifications">
            <svg {...ICON} className="h-5 w-5">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </IconButton>
          <IconButton label="Help">
            <svg {...ICON} className="h-5 w-5">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
          </IconButton>
          <button
            type="button"
            onClick={() => navigate(`/create-context?edit=${context.id}`)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 text-xs font-black text-blue-600 shadow-sm transition hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <svg {...ICON} className="h-3.5 w-3.5">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Edit Context Details
          </button>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generating}
            className="hidden"
          >
            {generating ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <svg {...ICON} className="h-3.5 w-3.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
            )}
            {generating ? 'Generating…' : 'Generate AI Linkages'}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* BODY                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-5">
          {/* INFO CARD */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-4 md:grid-cols-3">
              <dl className="space-y-2.5">
                <MetaRow label="Type" value={readableType(context.contextType)}>
                  <svg {...ICON} className="h-4 w-4">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </svg>
                </MetaRow>
                <MetaRow label="Field / Sector" value={context.field}>
                  <svg {...ICON} className="h-4 w-4">
                    <path d="M3 7h18M3 12h18M3 17h18" />
                  </svg>
                </MetaRow>
                <MetaRow label="Date / Duration" value={context.dateLabel}>
                  <svg {...ICON} className="h-4 w-4">
                    <rect width="16" height="17" x="4" y="5" rx="2" />
                    <path d="M8 3v4M16 3v4M4 10h16" />
                  </svg>
                </MetaRow>
              </dl>

              <dl className="space-y-2.5">
                <MetaRow label="Location" value={context.location}>
                  <svg {...ICON} className="h-4 w-4">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </MetaRow>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-gray-400">
                    <svg {...ICON} className="h-4 w-4">
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  </span>
                  <div>
                    <dt className="text-[11px] font-bold text-slate-500">
                      Status
                    </dt>
                    <dd className="mt-0.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${status.classes}`}
                      >
                        {status.label}
                      </span>
                    </dd>
                  </div>
                </div>
                <MetaRow
                  label="Relationship Needs"
                  value={needRoles.length > 0 ? needRoles.join(', ') : '—'}
                >
                  <svg {...ICON} className="h-4 w-4">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />
                  </svg>
                </MetaRow>
              </dl>

              <div>
                <p className="text-xs font-black text-slate-950">Description</p>
                <p className="mt-1.5 text-xs font-medium leading-5 text-slate-600">
                  {context.description || 'No description provided.'}
                </p>
              </div>
            </div>
          </section>

          {/* ERROR BANNER — directly under the info card */}
          {errors.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              <p className="font-black">Some data could not be loaded</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {errors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* STAT CARDS */}
          <ContextStatCards
            invitesSent={inviteCounts.total}
            confirmed={inviteCounts.confirmed}
            pending={inviteCounts.pending}
            aiRecommendations={suggestions.length}
            averageConfidence={averageConfidence}
          />

          {/* TABS */}
          <div>
            <div
              role="tablist"
              aria-label="Context detail sections"
              className="flex flex-wrap gap-1 border-b border-slate-200"
            >
              {TABS.map((tab) => {
                const active = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(tab.key)}
                    className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-black transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      active
                        ? 'border-blue-600 text-blue-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <TabIcon tab={tab.key} />
                    {tab.label}
                  </button>
                )
              })}
            </div>

            <div className="mt-3">
              {activeTab === 'ai' && (
                <AiRecommendationsTab
                  loading={suggestionsLoading}
                  totalCount={suggestions.length}
                  rows={visibleSuggestions}
                  search={search}
                  onSearch={setSearch}
                  roleFilter={roleFilter}
                  onRoleFilter={setRoleFilter}
                  confidenceSort={confidenceSort}
                  onConfidenceSort={setConfidenceSort}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  allVisibleSelected={allVisibleSelected}
                  onToggleSelectAll={toggleSelectAll}
                  onSend={() => void handleSendSelected()}
                  onReject={handleRejectSelected}
                  onViewProfile={setProfileFor}
                />
              )}
              {activeTab === 'invites' && (
                <InviteTrackingTab
                  invites={uniqueInvites}
                  userMap={userMap}
                  resendingId={resendingId}
                  onResend={(invite) => void handleResend(invite)}
                />
              )}
              {activeTab === 'links' && (
                <EcosystemLinksTab links={links} userMap={userMap} />
              )}
              {activeTab === 'activity' && (
                <ActivityFeedTab items={activity} />
              )}
            </div>
          </div>
      </div>

      {/* PROFILE MODAL */}
      {profileFor && (
        <ProfileModal
          suggestion={profileFor}
          user={userMap.get(profileFor.userId)}
          onClose={() => setProfileFor(null)}
        />
      )}

      {/* TOAST */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${
            toast.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-green-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Shared presentational helpers                                              */
/* -------------------------------------------------------------------------- */

const ICON = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function IconButton({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {children}
    </button>
  )
}

function MetaRow({
  label,
  value,
  children,
}: {
  label: string
  value: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-gray-400">{children}</span>
      <div className="min-w-0">
        <dt className="text-[11px] font-bold text-slate-500">{label}</dt>
        <dd className="mt-0.5 text-xs font-medium text-slate-900">{value}</dd>
      </div>
    </div>
  )
}

function TabIcon({ tab }: { tab: TabKey }) {
  if (tab === 'ai') {
    return (
      <svg {...ICON} className="h-4 w-4">
        <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
      </svg>
    )
  }
  if (tab === 'invites') {
    return (
      <svg {...ICON} className="h-4 w-4">
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-10 6L2 7" />
      </svg>
    )
  }
  if (tab === 'links') {
    return (
      <svg {...ICON} className="h-4 w-4">
        <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
        <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
      </svg>
    )
  }
  return (
    <svg {...ICON} className="h-4 w-4">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}

function Avatar({
  name,
  photoURL,
}: {
  name: string
  photoURL?: string
}) {
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name}
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    )
  }
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">
      {initials(name)}
    </span>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
      {message}
    </p>
  )
}

/* -------------------------------------------------------------------------- */
/* Tab: AI Recommendations                                                    */
/* -------------------------------------------------------------------------- */

interface AiTabProps {
  loading: boolean
  totalCount: number
  rows: ParticipantSuggestion[]
  search: string
  onSearch: (value: string) => void
  roleFilter: string
  onRoleFilter: (value: string) => void
  confidenceSort: 'high' | 'low' | 'all'
  onConfidenceSort: (value: 'high' | 'low' | 'all') => void
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  allVisibleSelected: boolean
  onToggleSelectAll: () => void
  onSend: () => void
  onReject: () => void
  onViewProfile: (suggestion: ParticipantSuggestion) => void
}

function AiRecommendationsTab({
  loading,
  totalCount,
  rows,
  search,
  onSearch,
  roleFilter,
  onRoleFilter,
  confidenceSort,
  onConfidenceSort,
  selectedIds,
  onToggleSelect,
  allVisibleSelected,
  onToggleSelectAll,
  onSend,
  onReject,
  onViewProfile,
}: AiTabProps) {
  const selectClass =
    'h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="px-4 pt-4">
        <h3 className="text-sm font-black text-slate-950">
          AI Recommendation Results
        </h3>
        <p className="mt-0.5 text-xs font-medium text-slate-500">
          Ranked suggestions based on context data, candidate profiles,
          previous links, and Gemini reasoning.
        </p>
      </header>

      {/* Filter / action row */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 pb-3">
        <div className="flex h-8 min-w-[200px] flex-1 items-center rounded-lg border border-slate-200 bg-white px-2.5 focus-within:border-blue-500">
          <svg {...ICON} className="h-4 w-4 text-gray-400">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search candidates"
            aria-label="Search candidates"
            className="ml-2 min-w-0 flex-1 bg-transparent text-xs font-medium text-slate-800 outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => onRoleFilter(e.target.value)}
          aria-label="Filter by role"
          className={selectClass}
        >
          {ROLE_FILTERS.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <select
          value={confidenceSort}
          onChange={(e) =>
            onConfidenceSort(e.target.value as 'high' | 'low' | 'all')
          }
          aria-label="Sort by confidence"
          className={selectClass}
        >
          <option value="high">High to Low</option>
          <option value="low">Low to High</option>
          <option value="all">All</option>
        </select>
        <label className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-600">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={onToggleSelectAll}
            className="h-4 w-4 rounded border-gray-300 accent-blue-600"
          />
          Selected ({selectedIds.size})
        </label>
        <button
          type="button"
          onClick={onSend}
          disabled={selectedIds.size === 0}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-black text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Send Selected Invites
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={selectedIds.size === 0}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 text-xs font-black text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          Reject Selected
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] font-black text-slate-500">
              <th className="w-8 px-4 py-2" />
              <th className="px-2 py-2">Candidate</th>
              <th className="px-2 py-2">Role</th>
              <th className="px-2 py-2">Relationship Type</th>
              <th className="px-2 py-2">Confidence</th>
              <th className="px-2 py-2">AI Reason &amp; Risk Flags</th>
              <th className="px-2 py-2">Next Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [0, 1, 2].map((i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td colSpan={7} className="px-4 py-3">
                    <div className="h-10 animate-pulse rounded-lg bg-gray-100" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6">
                  <EmptyState
                    message={
                      totalCount === 0
                        ? 'No AI recommendations yet. Click Generate AI Linkages to start.'
                        : 'No candidates match the current filters.'
                    }
                  />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 align-top transition hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => onToggleSelect(row.id)}
                      aria-label={`Select ${row.name}`}
                      className="h-4 w-4 rounded border-gray-300 accent-blue-600"
                    />
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-start gap-2.5">
                      <Avatar name={row.name} photoURL={row.photoURL} />
                      <div className="min-w-0">
                        <p className="font-black text-slate-950">
                          {row.name}
                        </p>
                        <p className="text-[11px] font-medium text-slate-500">
                          {row.headline || 'No headline'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-black ${rolePillClass(
                        row.suggestedRole,
                      )}`}
                    >
                      {row.suggestedRole}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">
                      {row.relationshipType}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`text-xs font-black ${confidenceColor(
                          row.confidence,
                        )}`}
                      >
                        {row.confidence}%
                      </span>
                      <span
                        className={`w-fit rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                          row.confidenceSource === 'fallback'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {row.confidenceSource === 'fallback'
                          ? 'Fallback'
                          : 'AI'}
                      </span>
                    </div>
                  </td>
                  <td className="max-w-sm px-2 py-3">
                    <p className="text-xs font-medium text-slate-700">
                      {recommendationReason(row)}
                    </p>
                    <p className="mt-1 text-[11px]">
                      <span className="font-black text-slate-500">
                        Risk Flags:{' '}
                      </span>
                      {row.riskFlags.length === 0 ? (
                        <span className="font-semibold text-green-600">
                          None
                        </span>
                      ) : (
                        <span className="font-medium text-amber-600">
                          {row.riskFlags.join(', ')}
                        </span>
                      )}
                    </p>
                  </td>
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      onClick={() => onViewProfile(row)}
                      className="rounded-lg border border-blue-200 px-2 py-1 text-[11px] font-black text-blue-600 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      View Profile
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Tab: Invite Tracking                                                       */
/* -------------------------------------------------------------------------- */

function InviteTrackingTab({
  invites,
  userMap,
  resendingId,
  onResend,
}: {
  invites: Invite[]
  userMap: Map<string, User>
  resendingId: string | null
  onResend: (invite: Invite) => void
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <header>
        <h3 className="text-base font-bold text-gray-950">Invite Tracking</h3>
        <p className="mt-0.5 text-sm text-gray-500">
          Track the status of all sent invitations.
        </p>
      </header>

      {invites.length === 0 ? (
        <div className="mt-4">
          <EmptyState message="No invites sent yet." />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="py-2 pr-3">Invitee</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Relationship Type</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Sent At</th>
                <th className="py-2 pr-3">Responded At</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => {
                const user = userMap.get(invite.invitedUserId)
                return (
                  <tr key={invite.id} className="border-b border-gray-50">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          name={user?.name ?? 'Unknown'}
                          photoURL={user?.photoURL}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900">
                            {user?.name ?? 'Unknown invitee'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {user?.headline || '—'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${rolePillClass(
                          invite.assignedRole,
                        )}`}
                      >
                        {invite.assignedRole}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {invite.relationshipType}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <InviteStatusBadge status={invite.status} />
                    </td>
                    <td className="py-3 pr-3 text-xs text-gray-600">
                      {formatDate(invite.sentAt)}
                    </td>
                    <td className="py-3 pr-3 text-xs text-gray-600">
                      {invite.respondedAt ? formatDate(invite.respondedAt) : '—'}
                    </td>
                    <td className="py-3">
                      {invite.status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => onResend(invite)}
                          disabled={resendingId === invite.id}
                          className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          {resendingId === invite.id ? 'Resending…' : 'Resend'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Tab: Ecosystem Links                                                       */
/* -------------------------------------------------------------------------- */

function EcosystemLinksTab({
  links,
  userMap,
}: {
  links: EcosystemLink[]
  userMap: Map<string, User>
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <header>
        <h3 className="text-base font-bold text-gray-950">Ecosystem Links</h3>
        <p className="mt-0.5 text-sm text-gray-500">
          These are reusable ecosystem relationships created from confirmed
          matches.
        </p>
      </header>

      {links.length === 0 ? (
        <div className="mt-4">
          <EmptyState message="No ecosystem links yet. Links are created when invites are accepted." />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="py-2 pr-3">Target Actor</th>
                <th className="py-2 pr-3">Relationship Type</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Confidence</th>
                <th className="py-2">Reusable Tags</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => {
                const target = userMap.get(link.targetUserId)
                return (
                  <tr key={link.id} className="border-b border-gray-50 align-top">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          name={target?.name ?? 'Unknown'}
                          photoURL={target?.photoURL}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900">
                            {target?.name ?? 'Unknown actor'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {target?.headline || '—'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {link.relationshipType}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${linkStatusClass(
                          link.status,
                        )}`}
                      >
                        {link.status}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`text-sm font-bold ${confidenceColor(
                          link.confidence,
                        )}`}
                      >
                        {link.confidence}%
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {link.reusableTags.length === 0 ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (
                          link.reusableTags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500"
                            >
                              {tag}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Tab: Activity Feed                                                         */
/* -------------------------------------------------------------------------- */

function ActivityFeedTab({ items }: { items: ActivityItem[] }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <header>
        <h3 className="text-base font-bold text-gray-950">Activity Feed</h3>
        <p className="mt-0.5 text-sm text-gray-500">
          Recent actions and events for this context.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="mt-4">
          <EmptyState message="No activity yet." />
        </div>
      ) : (
        <ol className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3">
              <ActivityIcon kind={item.kind} />
              <div className="min-w-0">
                <p className="text-sm text-gray-800">{item.description}</p>
                <p className="text-xs text-gray-400">
                  {formatDateTime(item.at)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function ActivityIcon({ kind }: { kind: ActivityItem['kind'] }) {
  const tone =
    kind === 'invite-accepted'
      ? 'bg-green-50 text-green-600'
      : kind === 'invite-declined'
        ? 'bg-red-50 text-red-600'
        : kind === 'ai-generated'
          ? 'bg-purple-50 text-purple-600'
          : 'bg-blue-50 text-blue-600'

  return (
    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${tone}`}>
      {kind === 'invite-sent' && (
        <svg {...ICON} className="h-4 w-4">
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="m22 7-10 6L2 7" />
        </svg>
      )}
      {kind === 'invite-accepted' && (
        <svg {...ICON} className="h-4 w-4">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
      {kind === 'invite-declined' && (
        <svg {...ICON} className="h-4 w-4">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      )}
      {kind === 'ai-generated' && (
        <svg {...ICON} className="h-4 w-4">
          <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
        </svg>
      )}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Profile modal                                                              */
/* -------------------------------------------------------------------------- */

function ProfileModal({
  suggestion,
  user,
  onClose,
}: {
  suggestion: ParticipantSuggestion
  user: User | undefined
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar
              name={user?.name ?? suggestion.name}
              photoURL={user?.photoURL ?? suggestion.photoURL}
            />
            <div>
              <h2
                id="profile-modal-title"
                className="text-base font-bold text-gray-950"
              >
                {user?.name ?? suggestion.name}
              </h2>
              <p className="text-xs text-gray-500">
                {user?.headline ?? suggestion.headline ?? '—'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile"
            className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <svg {...ICON} className="h-4 w-4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {user ? (
          <dl className="mt-4 space-y-3 text-sm">
            <ProfileField
              label="Inferred Sector"
              value={user.inferredSector?.join(', ') || '—'}
            />
            <ProfileField
              label="Inferred Expertise"
              value={user.inferredExpertise?.join(', ') || '—'}
            />
            <ProfileField
              label="Inferred Stage"
              value={user.inferredStage || '—'}
            />
            <ProfileField
              label="Contribution Signals"
              value={user.contributionSignals?.join(', ') || '—'}
            />
            <div>
              <dt className="text-xs font-semibold text-gray-500">
                Profile Completeness
              </dt>
              <dd className="mt-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(100, user.profileCompleteness ?? 0),
                      )}%`,
                    }}
                  />
                </div>
                <span className="mt-1 block text-xs text-gray-500">
                  {user.profileCompleteness ?? 0}%
                </span>
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">
            Full profile is unavailable for this candidate.
          </p>
        )}
      </div>
    </div>
  )
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-gray-800">{value}</dd>
    </div>
  )
}
