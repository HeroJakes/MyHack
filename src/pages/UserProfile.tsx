import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { useEcosystemLinks } from '../hooks/useEcosystemLinks'
import type { EcosystemLink, Invite, User as ProfileUser } from '../types'

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
                photoURL: data.photoURL ?? user.photoURL ?? '',
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
      className={`inline-flex min-h-7 items-center rounded-lg px-3 text-xs font-black ring-1 ${tones[tone]}`}
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
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tones[tone]}`}
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
    <div className="grid aspect-square w-full place-items-center rounded-full bg-blue-50 text-5xl font-black text-blue-700">
      {initials || 'EA'}
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <div className="h-10 w-56 animate-pulse rounded-xl bg-gray-200" />
        <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded-lg bg-gray-100" />
      </div>
      <div className="h-72 animate-pulse rounded-[1.35rem] border border-gray-100 bg-white" />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-96 animate-pulse rounded-[1.35rem] border border-gray-100 bg-white" />
        <div className="h-96 animate-pulse rounded-[1.35rem] border border-gray-100 bg-white" />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-[1.35rem] border border-blue-100 bg-white p-8 shadow-sm">
      <p className="text-lg font-black text-gray-950">No profile found yet</p>
      <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
        Finish onboarding once and EcoGraph AI will create your user profile
        document here automatically.
      </p>
      <Link
        to="/onboarding/step1"
        className="mt-6 inline-flex h-11 items-center rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-500/20"
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
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
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
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
        </svg>
      </PanelIcon>
    )
  }

  return (
    <PanelIcon tone="navy">
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 3 9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5L12 3Z" />
      </svg>
    </PanelIcon>
  )
}

function buildRecentRoles(invites: Invite[], links: EcosystemLink[]): RecentRole[] {
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
  const { links, loading: linksLoading } = useEcosystemLinks()

  const recentRoles = useMemo(
    () => buildRecentRoles(invites, links),
    [invites, links],
  )

  if (loading) return <ProfileSkeleton />

  if (error) {
    return (
      <div className="rounded-[1.35rem] border border-red-100 bg-white p-8 shadow-sm">
        <p className="text-lg font-black text-gray-950">Profile could not load</p>
        <p className="mt-2 text-sm text-red-600">{error}</p>
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
    <div className="mx-auto max-w-[1500px] space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-gray-950">
            My Profile
          </h1>
          <p className="mt-3 text-lg font-medium text-slate-600">
            Manage your ecosystem identity and AI-generated profile.
          </p>
        </div>

        <Link
          to="/onboarding/step1"
          className="inline-flex h-12 items-center justify-center gap-3 rounded-xl border border-blue-200 bg-white px-5 text-sm font-black text-blue-600 shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
          </svg>
          Edit Profile
        </Link>
      </header>

      <section className="rounded-[1.35rem] border border-slate-100 bg-white px-6 py-7 shadow-[0_18px_45px_rgba(15,23,42,0.06)] lg:px-12">
        <div className="grid gap-8 lg:grid-cols-[260px_1fr_330px] lg:items-center">
          <div className="flex flex-col items-center border-slate-100 lg:border-r lg:pr-12">
            <div className="w-44 max-w-full overflow-hidden rounded-full bg-gray-100">
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
            <button
              type="button"
              className="mt-7 inline-flex h-12 items-center gap-3 rounded-xl bg-blue-600 px-8 text-sm font-black text-white shadow-lg shadow-blue-500/25"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="m17 8-5-5-5 5" />
                <path d="M12 3v12" />
              </svg>
              Upload Photo
            </button>
            <p className="mt-4 text-sm font-bold text-slate-500">
              PNG, JPG up to 5MB
            </p>
          </div>

          <div className="border-slate-100 lg:border-r lg:px-8">
            <h2 className="text-4xl font-black tracking-tight text-gray-950">
              {profile.name}
            </h2>
            <p className="mt-6 text-base font-black text-blue-600">
              {profile.headline || 'Ecosystem builder'}
            </p>
            <p className="mt-6 max-w-3xl text-base font-medium leading-8 text-slate-600">
              {profile.bio ||
                'Your AI-generated profile summary will appear here after onboarding.'}
            </p>

            <div className="mt-10 flex items-center gap-4 text-base font-bold text-slate-600">
              <svg className="h-6 w-6 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect width="18" height="14" x="3" y="5" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
              <span>{profile.email || 'No email available'}</span>
            </div>
          </div>

          <div className="lg:pl-8">
            <p className="text-lg font-black text-gray-950">
              Profile Completeness
            </p>
            <p className="mt-8 text-5xl font-black text-blue-600">
              {completeness}%
            </p>
            <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${completeness}%` }}
              />
            </div>
            <div className="mt-9 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M13 2 8 14h7l-4 8 9-13h-7l4-7Z" />
              </svg>
              {completeness >= 80 ? 'Excellent' : completeness >= 50 ? 'Growing' : 'Getting started'}
            </div>
            <p className="mt-5 text-sm font-semibold text-slate-500">
              {completeness >= 80
                ? "Keep going! You're almost there."
                : 'A richer profile improves your ecosystem matches.'}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[1.35rem] border border-slate-100 bg-white p-7 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-8">
          <div className="mb-8 flex items-center gap-4">
            <PanelIcon>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 3 9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5L12 3Z" />
              </svg>
            </PanelIcon>
            <h2 className="text-xl font-black text-gray-950">AI Profile Signals</h2>
          </div>

          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-[210px_1fr] sm:items-start">
              <div className="flex items-center gap-4">
                <PanelIcon>
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M3 21h18" />
                    <path d="M5 21V7l8-4v18" />
                    <path d="M19 21V11l-6-4" />
                    <path d="M9 9v.01" />
                    <path d="M9 13v.01" />
                    <path d="M9 17v.01" />
                  </svg>
                </PanelIcon>
                <p className="font-black text-gray-950">Industry / Sector</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {sectors.map((sector) => (
                  <Tag key={sector}>{sector}</Tag>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[210px_1fr] sm:items-start">
              <div className="flex items-center gap-4">
                <PanelIcon>
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="m16 18 6-6-6-6" />
                    <path d="m8 6-6 6 6 6" />
                  </svg>
                </PanelIcon>
                <p className="font-black text-gray-950">Skills & Expertise</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {expertise.map((skill) => (
                  <Tag key={skill}>{skill}</Tag>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[210px_1fr] sm:items-start">
              <div className="flex items-center gap-4">
                <PanelIcon>
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M3 17 9 11l4 4 8-8" />
                    <path d="M14 7h7v7" />
                  </svg>
                </PanelIcon>
                <p className="font-black text-gray-950">Growth Stage</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Tag tone="green">{titleCase(profile.inferredStage)}</Tag>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[210px_1fr] sm:items-start">
              <div className="flex items-center gap-4">
                <PanelIcon>
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <rect width="20" height="14" x="2" y="7" rx="2" />
                    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                  </svg>
                </PanelIcon>
                <p className="font-black text-gray-950">Possible Roles</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {signals.map((signal) => (
                  <Tag key={signal} tone="violet">
                    {signal}
                  </Tag>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.35rem] border border-slate-100 bg-white p-7 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-8">
          <div className="mb-8 flex items-center gap-4">
            <PanelIcon>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect width="20" height="14" x="2" y="7" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              </svg>
            </PanelIcon>
            <h2 className="text-xl font-black text-gray-950">
              Recent Contextual Roles
            </h2>
          </div>

          <div className="grid grid-cols-[1fr_120px_160px] gap-4 border-b border-slate-100 px-1 pb-5 text-sm font-black text-slate-500 max-sm:hidden">
            <span>Context</span>
            <span>Type</span>
            <span>Role</span>
          </div>

          {invitesLoading || linksLoading ? (
            <div className="space-y-5 py-6">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : recentRoles.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {recentRoles.map((role) => (
                <div
                  key={role.id}
                  className="grid gap-4 py-6 sm:grid-cols-[1fr_120px_160px] sm:items-center"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <RoleAccentIcon accent={role.accent} />
                    <p className="truncate font-black text-gray-950">
                      {role.context}
                    </p>
                  </div>
                  <div>
                    <Tag tone={role.accent === 'green' ? 'green' : 'blue'}>
                      {role.type}
                    </Tag>
                  </div>
                  <p className="font-medium text-slate-700">{role.role}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <p className="font-black text-gray-950">No contextual roles yet</p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                Roles will appear here after you receive invites or create
                confirmed ecosystem links.
              </p>
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <Link
              to="/ecosystem-links"
              className="inline-flex items-center gap-3 text-base font-black text-blue-600"
            >
              View all roles
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
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
