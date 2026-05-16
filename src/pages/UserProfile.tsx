import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { useEcosystemLinks } from '../hooks/useEcosystemLinks'
import type { ResolvedEcosystemLink } from '../hooks/useEcosystemLinks'
import type { Invite, User as ProfileUser } from '../types'

type ProfileState = {
  profile: ProfileUser | null
  loading: boolean
  error: string
}

type RecentRole = {
  id: string
  context: string
  type: string
  role: string
  accent: 'navy' | 'green' | 'violet'
  createdAt: number
}

const fallbackTags = ['Profile setup in progress']
function toMillis(value: unknown): number {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  const ts = value as { toMillis?: () => number; seconds?: number }
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  return 0
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function useUserProfile(): ProfileState {
  const { user } = useAuth()
  const [state, setState] = useState<ProfileState>({
    profile: null,
    loading: true,
    error: '',
  })

  useEffect(() => {
    if (!user) {
      setState({ profile: null, loading: false, error: '' })
      return
    }

    setState((prev) => ({ ...prev, loading: true, error: '' }))

    return onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        const data = snap.data()
        setState({
          profile: data
            ? ({
                id: user.uid,
                name: data.name ?? user.displayName ?? 'EcoGraph Member',
                email: data.email ?? user.email ?? '',
                photoURL:
                  data.profileImageBase64 ??
                  data.photoURL ??
                  data.image ??
                  user.photoURL ??
                  '',
                image:
                  data.profileImageBase64 ??
                  data.image ??
                  data.photoURL ??
                  user.photoURL ??
                  '',
                profileImageBase64: data.profileImageBase64,
                hasAddedAISignals: data.hasAddedAISignals === true,
                headline: data.headline ?? '',
                linkedinId: data.linkedinId,
                inferredSector: Array.isArray(data.inferredSector)
                  ? data.inferredSector
                  : [],
                inferredExpertise: Array.isArray(data.inferredExpertise)
                  ? data.inferredExpertise
                  : [],
                inferredStage: data.inferredStage ?? 'ecosystem',
                contributionSignals: Array.isArray(data.contributionSignals)
                  ? data.contributionSignals
                  : [],
                bio: data.bio ?? '',
                profileCompleteness: Number(data.profileCompleteness ?? 0),
                onboardingComplete: data.onboardingComplete === true,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
              } as ProfileUser)
            : null,
          loading: false,
          error: '',
        })
      },
      (err) => {
        setState({ profile: null, loading: false, error: err.message })
      },
    )
  }, [user])

  return state
}

function useRecentInvites() {
  const { user } = useAuth()
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)

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

    return onSnapshot(
      invitesQuery,
      (snap) => {
        setInvites(
          snap.docs.map((item) => ({ id: item.id, ...item.data() }) as Invite),
        )
        setLoading(false)
      },
      () => {
        setInvites([])
        setLoading(false)
      },
    )
  }, [user])

  return { invites, loading }
}

function Tag({
  children,
  tone = 'blue',
}: {
  children: string
  tone?: 'blue' | 'green' | 'violet'
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    violet: 'bg-violet-50 text-violet-700 ring-violet-100',
  }

  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-full px-2 py-1 text-xs font-semibold leading-none ring-1 ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

function PanelIcon({
  children,
  tone = 'blue',
}: {
  children: React.ReactNode
  tone?: 'blue' | 'green' | 'violet' | 'navy'
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    navy: 'bg-slate-950 text-white',
  }

  return (
    <span
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

function InitialsAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="grid aspect-square w-full place-items-center rounded-full bg-blue-50 text-2xl font-bold text-blue-700 sm:text-3xl">
      {initials || 'EA'}
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <div className="h-7 w-44 animate-pulse rounded-xl bg-gray-200" />
        <div className="mt-2 h-3.5 w-72 max-w-full animate-pulse rounded-lg bg-gray-100" />
      </div>
      <div className="h-50 animate-pulse rounded-2xl border border-gray-100 bg-white" />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.8fr)]">
        <div className="h-64 animate-pulse rounded-2xl border border-gray-100 bg-white" />
        <div className="h-56 animate-pulse rounded-2xl border border-gray-100 bg-white" />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-6xl rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-base font-semibold text-gray-950">No profile found yet</p>
      <p className="mt-2 max-w-xl text-[13px] leading-5 text-gray-500">
        Finish onboarding once and EcoGraph AI will create your user profile
        document here automatically.
      </p>
      <Link
        to="/onboarding/step1"
        className="mt-4 inline-flex h-9 items-center rounded-lg bg-blue-600 px-3.5 text-[13px] font-semibold text-white shadow-sm shadow-blue-500/20"
      >
        Complete onboarding
      </Link>
    </div>
  )
}

function RoleAccentIcon({ accent }: { accent: RecentRole['accent'] }) {
  if (accent === 'green') {
    return (
      <PanelIcon tone="green">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </PanelIcon>
    )
  }

  if (accent === 'violet') {
    return (
      <PanelIcon tone="violet">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
        </svg>
      </PanelIcon>
    )
  }

  return (
    <PanelIcon tone="navy">
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 3 9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5L12 3Z" />
      </svg>
    </PanelIcon>
  )
}

function buildRecentRoles(
  invites: Invite[],
  links: ResolvedEcosystemLink[],
): RecentRole[] {
  const inviteRoles = invites.map((invite, index) => ({
    id: `invite-${invite.id}`,
    context: invite.contextName || 'Untitled context',
    type: invite.contextType || 'Context',
    role: invite.assignedRole || titleCase(invite.relationshipType),
    accent: (index % 3 === 1 ? 'green' : index % 3 === 2 ? 'violet' : 'navy') as RecentRole['accent'],
    createdAt: toMillis(invite.sentAt),
  }))

  const linkRoles = links.map((link, index) => ({
    id: `link-${link.id}`,
    context: link.contextName || 'Untitled context',
    type: link.contextType || 'Context',
    role: link.assignedRole || titleCase(link.relationshipType),
    accent: (index % 3 === 1 ? 'green' : index % 3 === 2 ? 'violet' : 'navy') as RecentRole['accent'],
    createdAt: toMillis(link.createdAt),
  }))

  const byContextRole = new Map<string, RecentRole>()
  for (const role of [...inviteRoles, ...linkRoles]) {
    const key = `${role.context}-${role.role}`
    const current = byContextRole.get(key)
    if (!current || role.createdAt > current.createdAt) byContextRole.set(key, role)
  }

  return [...byContextRole.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3)
}

export default function UserProfile() {
  const { profile, loading, error } = useUserProfile()
  const { invites, loading: invitesLoading } = useRecentInvites()
  const { links, isLoading: linksLoading } = useEcosystemLinks()

  const recentRoles = useMemo(
    () => buildRecentRoles(invites, links),
    [invites, links],
  )

  if (loading) return <ProfileSkeleton />

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <p className="text-base font-semibold text-gray-950">Profile could not load</p>
        <p className="mt-2 text-[13px] text-red-600">{error}</p>
      </div>
    )
  }

  if (!profile) return <EmptyState />

  const completeness = Math.max(
    0,
    Math.min(100, Math.round(profile.profileCompleteness || 0)),
  )
  const sectors =
    profile.inferredSector.length > 0 ? profile.inferredSector : fallbackTags
  const expertise =
    profile.inferredExpertise.length > 0 ? profile.inferredExpertise : fallbackTags
  const signals =
    profile.contributionSignals.length > 0
      ? profile.contributionSignals
      : ['Technical Advisory', 'Software Development', 'Mentorship']

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[27px] font-bold tracking-tight text-gray-950">
            My Profile
          </h1>
          <p className="mt-1 text-[13px] font-medium text-slate-600 sm:text-[15px]">
            Manage your ecosystem identity and AI-generated profile.
          </p>
        </div>

        <Link
          to="/profile/edit"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3.5 text-[13px] font-semibold text-blue-600 shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50 sm:h-10"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
          </svg>
          Edit Profile
        </Link>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-6 lg:p-7">
        <div className="grid gap-5 lg:grid-cols-[162px_minmax(0,1fr)_225px] lg:items-center">
          <div className="flex flex-col items-center border-slate-100 lg:border-r lg:pr-6">
            <div className="w-[86px] max-w-full overflow-hidden rounded-full bg-gray-100 sm:w-[115px]">
              {profile.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt=""
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <InitialsAvatar name={profile.name} />
              )}
            </div>
          </div>

          <div className="border-slate-100 lg:border-r lg:px-6">
            <h2 className="text-[22px] font-bold tracking-tight text-gray-950 sm:text-[25px]">
              {profile.name}
            </h2>
            <p className="mt-2.5 text-[13px] font-semibold text-blue-600">
              {profile.headline || 'Ecosystem builder'}
            </p>
            <p className="mt-3.5 max-w-xl text-[13px] font-normal leading-[1.55] text-slate-600 sm:text-sm">
              {profile.bio ||
                'Your AI-generated profile summary will appear here after onboarding.'}
            </p>

            <div className="mt-5 flex items-center gap-2.5 text-[13px] font-medium text-slate-600">
              <svg className="h-4.5 w-4.5 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect width="18" height="14" x="3" y="5" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
              <span>{profile.email || 'No email available'}</span>
            </div>
          </div>

          <div className="lg:pl-6">
            <p className="text-sm font-semibold text-gray-950">
              Profile Completeness
            </p>
            <p className="mt-3.5 text-[38px] font-bold leading-none text-blue-600 sm:text-[43px]">
              {completeness}%
            </p>
            <div className="mt-3.5 h-[7px] overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${completeness}%` }}
              />
            </div>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M13 2 8 14h7l-4 8 9-13h-7l4-7Z" />
              </svg>
              {completeness >= 80 ? 'Excellent' : completeness >= 50 ? 'Growing' : 'Getting started'}
            </div>
            <p className="mt-2.5 text-[13px] font-medium leading-5 text-slate-500">
              {completeness >= 80
                ? "Keep going! You're almost there."
                : 'A richer profile improves your ecosystem matches.'}
            </p>
          </div>
        </div>
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.8fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-5 lg:p-6">
          <div className="mb-5 flex items-center gap-2.5">
            <PanelIcon>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 3 9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5L12 3Z" />
              </svg>
            </PanelIcon>
            <h2 className="text-base font-semibold text-gray-950 sm:text-lg">AI Profile Signals</h2>
          </div>

          <div className="grid gap-3.5 lg:grid-cols-2">
            <div className="grid gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
              <div className="flex items-center gap-2.5">
                <PanelIcon>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M3 21h18" />
                    <path d="M5 21V7l8-4v18" />
                    <path d="M19 21V11l-6-4" />
                    <path d="M9 9v.01" />
                    <path d="M9 13v.01" />
                    <path d="M9 17v.01" />
                  </svg>
                </PanelIcon>
                <p className="text-[13px] font-semibold text-gray-950">Industry / Sector</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sectors.map((sector) => (
                  <Tag key={sector}>{sector}</Tag>
                ))}
              </div>
            </div>

            <div className="grid gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
              <div className="flex items-center gap-2.5">
                <PanelIcon>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="m16 18 6-6-6-6" />
                    <path d="m8 6-6 6 6 6" />
                  </svg>
                </PanelIcon>
                <p className="text-[13px] font-semibold text-gray-950">Skills & Expertise</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {expertise.map((skill) => (
                  <Tag key={skill}>{skill}</Tag>
                ))}
              </div>
            </div>

            <div className="grid gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
              <div className="flex items-center gap-2.5">
                <PanelIcon>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M3 17 9 11l4 4 8-8" />
                    <path d="M14 7h7v7" />
                  </svg>
                </PanelIcon>
                <p className="text-[13px] font-semibold text-gray-950">Growth Stage</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Tag tone="green">{titleCase(profile.inferredStage)}</Tag>
              </div>
            </div>

            <div className="grid gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
              <div className="flex items-center gap-2.5">
                <PanelIcon>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <rect width="20" height="14" x="2" y="7" rx="2" />
                    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                  </svg>
                </PanelIcon>
                <p className="text-[13px] font-semibold text-gray-950">Possible Roles</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {signals.map((signal) => (
                  <Tag key={signal} tone="violet">
                    {signal}
                  </Tag>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-5 lg:p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <PanelIcon>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect width="20" height="14" x="2" y="7" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              </svg>
            </PanelIcon>
            <h2 className="text-base font-semibold text-gray-950 sm:text-lg">
              Recent Contextual Roles
            </h2>
          </div>

          <div className="grid grid-cols-[1fr_80px_118px] gap-2.5 border-b border-slate-100 px-1 pb-2.5 text-[11px] font-semibold text-slate-500 max-sm:hidden">
            <span>Context</span>
            <span>Type</span>
            <span>Role</span>
          </div>

          {invitesLoading || linksLoading ? (
            <div className="space-y-2.5 py-3.5">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-11 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : recentRoles.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {recentRoles.map((role) => (
                <div
                  key={role.id}
                  className="grid gap-2.5 py-3.5 sm:grid-cols-[1fr_80px_118px] sm:items-center"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <RoleAccentIcon accent={role.accent} />
                    <p className="truncate text-[13px] font-semibold text-gray-950">
                      {role.context}
                    </p>
                  </div>
                  <div>
                    <Tag tone={role.accent === 'green' ? 'green' : 'blue'}>
                      {role.type}
                    </Tag>
                  </div>
                  <p className="text-[13px] font-medium text-slate-700">{role.role}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-7 text-center">
              <p className="text-sm font-semibold text-gray-950">No contextual roles yet</p>
              <p className="mx-auto mt-1.5 max-w-xs text-[13px] leading-5 text-slate-500">
                Roles will appear here after you receive invites or create
                confirmed ecosystem links.
              </p>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Link
              to="/ecosystem-links"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-blue-600"
            >
              View all roles
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
