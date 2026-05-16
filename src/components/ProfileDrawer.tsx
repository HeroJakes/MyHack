/**
 * ProfileDrawer — slide-in detail panel for one ecosystem profile.
 *
 * Positioned absolutely (never `fixed`) over the page. Lazily loads the
 * profile's recent `ecosystemLinks` and, when opened from a context, the
 * matching AI `ParticipantSuggestion` document (read-only).
 */
import { useEffect, useRef, useState } from 'react'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { EcosystemLink, ParticipantSuggestion, User } from '../types'
import {
  colorForName,
  derivePossibleRoles,
  deriveRole,
  formatMemberSince,
  initials,
  strengthInfo,
} from '../lib/profileHelpers'
import { InviteButton } from './ProfileCard'
import type { InviteState } from './ProfileCard'
import { Calendar, MapPin, Shield, Sparkles, X } from './icons'

interface ProfileDrawerProps {
  user: User
  contextId: string | null
  invited: boolean
  inviteState: InviteState
  canInvite: boolean
  onClose: () => void
  onInvite: () => void
  onToast: (message: string) => void
}

type Tab = 'overview' | 'linkages' | 'ai'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'linkages', label: 'Past Linkages' },
  { id: 'ai', label: 'AI Matching' },
]

function linkStatusClass(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-700'
    case 'completed':
      return 'bg-gray-100 text-gray-600'
    case 'declined':
      return 'bg-red-100 text-red-700'
    case 'invited':
      return 'bg-amber-100 text-amber-700'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}

function titleCase(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function confidenceClass(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-700'
  if (score >= 60) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-600'
}

/** Circular profile-strength ring. */
function StrengthRing({ score }: { score: number }) {
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(100, Math.max(0, score))
  const strength = strengthInfo(clamped)
  return (
    <div className="relative h-16 w-16">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (circumference * clamped) / 100}
          className={strength.text}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-sm font-black text-gray-900">
        {Math.round(clamped)}
      </div>
    </div>
  )
}

/** Small labelled tile used in the Overview metadata grid. */
function MetaTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <div className="mt-0.5 text-sm font-semibold text-gray-800">{children}</div>
    </div>
  )
}

export default function ProfileDrawer({
  user,
  contextId,
  invited,
  inviteState,
  canInvite,
  onClose,
  onInvite,
  onToast,
}: ProfileDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')

  const [links, setLinks] = useState<EcosystemLink[]>([])
  const [linksLoading, setLinksLoading] = useState(true)

  const [suggestion, setSuggestion] = useState<ParticipantSuggestion | null>(null)
  const [suggestionLoading, setSuggestionLoading] = useState(false)

  const role = deriveRole(user)
  const possibleRoles = derivePossibleRoles(user)
  const expertise = user.inferredExpertise ?? []
  const strength = strengthInfo(user.profileCompleteness ?? 0)

  // Slide in on mount; the parent unmounts us after the slide-out completes.
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    panelRef.current?.focus()
    return () => cancelAnimationFrame(id)
  }, [])

  function handleClose() {
    setVisible(false)
    window.setTimeout(onClose, 220)
  }

  // Close on Escape.
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Lazily load the profile's recent ecosystem links.
  useEffect(() => {
    let active = true
    setLinksLoading(true)
    getDocs(
      query(
        collection(db, 'ecosystemLinks'),
        where('targetUserId', '==', user.id),
        limit(5),
      ),
    )
      .then((snap) => {
        if (!active) return
        setLinks(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EcosystemLink),
        )
        setLinksLoading(false)
      })
      .catch((err) => {
        console.error('ProfileDrawer links error:', err)
        if (!active) return
        setLinks([])
        setLinksLoading(false)
      })
    return () => {
      active = false
    }
  }, [user.id])

  // Load the AI suggestion for this user in the active context (read-only).
  useEffect(() => {
    if (!contextId) {
      setSuggestion(null)
      return
    }
    let active = true
    setSuggestionLoading(true)
    getDoc(doc(db, 'suggestions', contextId, 'participants', `${contextId}_${user.id}`))
      .then((snap) => {
        if (!active) return
        setSuggestion(
          snap.exists()
            ? ({ id: snap.id, ...snap.data() } as ParticipantSuggestion)
            : null,
        )
        setSuggestionLoading(false)
      })
      .catch((err) => {
        // Permission-denied (non-organizer) is expected — treat as "no data".
        console.error('ProfileDrawer suggestion error:', err)
        if (!active) return
        setSuggestion(null)
        setSuggestionLoading(false)
      })
    return () => {
      active = false
    }
  }, [user.id, contextId])

  return (
    <>
      <div
        onClick={handleClose}
        className={`absolute inset-0 z-20 bg-gray-900/30 backdrop-blur-[1px] transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-label={`Profile: ${user.name}`}
        tabIndex={-1}
        className={`absolute right-0 top-0 z-30 flex h-full w-96 max-w-full flex-col bg-white shadow-2xl outline-none transition-transform duration-200 ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header. */}
        <div className="relative bg-gradient-to-br from-blue-50 via-white to-white p-5">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close profile drawer"
            className="absolute right-3 top-3 rounded-md p-1 text-gray-400 transition-colors hover:bg-white hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="h-16 w-16 rounded-full object-cover ring-4 ring-white shadow-sm"
              />
            ) : (
              <div
                className={`grid h-16 w-16 place-items-center rounded-full text-lg font-bold ring-4 ring-white shadow-sm ${colorForName(
                  user.name,
                )}`}
              >
                {initials(user.name)}
              </div>
            )}
            <div className="min-w-0 pt-1">
              <p className="font-black text-gray-900">{user.name}</p>
              <p className="line-clamp-2 text-xs text-gray-500">
                {user.headline}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                <MapPin className="h-3.5 w-3.5" />
                {user.location || 'Malaysia'}
              </p>
            </div>
          </div>

          <div className="mt-3">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${role.badgeClass}`}
            >
              {role.label}
            </span>
          </div>

          <div className="mt-3 flex gap-2">
            <InviteButton
              invited={invited}
              inviteState={inviteState}
              canInvite={canInvite}
              userName={user.name}
              onInvite={onInvite}
              label="Invite to Campaign"
            />
          </div>
        </div>

        {/* Tabs. */}
        <div className="flex border-b border-gray-100 px-5">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors ${
                tab === item.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Tab content. */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'overview' && (
            <div className="space-y-5">
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  Profile Summary
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-gray-600">
                  {user.bio || 'No profile summary available yet.'}
                </p>
              </section>

              <div className="grid grid-cols-2 gap-2.5">
                <MetaTile label="Industry / Sector">
                  {user.inferredSector?.join(', ') || '—'}
                </MetaTile>
                <MetaTile label="Ecosystem Stage">
                  <span className="capitalize">{user.inferredStage || '—'}</span>
                </MetaTile>
                <MetaTile label="Member Since">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    {formatMemberSince(user.createdAt)}
                  </span>
                </MetaTile>
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    Profile Strength
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <StrengthRing score={user.profileCompleteness ?? 0} />
                    <span className={`text-sm font-bold ${strength.text}`}>
                      {strength.label}
                    </span>
                  </div>
                </div>
              </div>

              {expertise.length > 0 && (
                <section>
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                    Skills &amp; Expertise
                  </h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {expertise.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  Possible Roles
                </h3>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {possibleRoles.map((roleInfo) => (
                    <span
                      key={roleInfo.key}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleInfo.chipClass}`}
                    >
                      {roleInfo.label}
                    </span>
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === 'linkages' && (
            <div className="space-y-2.5">
              {linksLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-16 animate-pulse rounded-lg bg-gray-100"
                  />
                ))
              ) : links.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
                  No ecosystem linkages yet for this profile.
                </p>
              ) : (
                links.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {link.contextName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {titleCase(link.relationshipType)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${linkStatusClass(
                          link.status,
                        )}`}
                      >
                        {link.status}
                      </span>
                      <span className="text-[11px] font-medium text-gray-500">
                        {link.confidence}% match
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'ai' && (
            <div>
              {!contextId ? (
                <p className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
                  Open this page from a context to see AI match analysis.
                </p>
              ) : suggestionLoading ? (
                <div className="h-32 animate-pulse rounded-lg bg-gray-100" />
              ) : suggestion ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-indigo-500" />
                      <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-500">
                        AI Match Reason
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm leading-6 text-indigo-900">
                      {suggestion.reason}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Confidence</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${confidenceClass(
                        suggestion.confidence,
                      )}`}
                    >
                      {suggestion.confidence}%
                    </span>
                  </div>

                  {suggestion.riskFlags.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                        Risk Flags
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {suggestion.riskFlags.map((flag) => (
                          <span
                            key={flag}
                            className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600"
                          >
                            {flag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                      Suggested Next Action
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-800">
                      {suggestion.suggestedNextAction}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
                  No AI match analysis recorded for this profile in the current
                  context.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
