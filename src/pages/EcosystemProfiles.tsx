/**
 * EcosystemProfiles — live directory of ecosystem members.
 *
 * Reads the `users` collection and the current user's sent `invites` via
 * real-time `onSnapshot` listeners (no mock data). Invites are created through
 * the `sendInvites` Cloud Function. All search / filtering is client-side.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { useSendInvites } from '../hooks/useSendInvites'
import type { User } from '../types'
import {
  deriveRole,
  derivePossibleRoles,
  colorForName,
  initials,
  strengthInfo,
  toDateSafe,
} from '../lib/profileHelpers'
import ProfileCard, { InviteButton } from '../components/ProfileCard'
import type { InviteState } from '../components/ProfileCard'
import ProfileDrawer from '../components/ProfileDrawer'
import {
  Bell,
  Filter,
  HelpCircle,
  LayoutGrid,
  List,
  Search,
  Users,
  X,
} from '../components/icons'

type SortBy = 'relevant' | 'name' | 'strength' | 'newest'
type ViewMode = 'grid' | 'table'

const ROLE_OPTIONS = ['Mentor', 'Partner', 'Startup', 'Service Provider']

const SORT_LABELS: Record<SortBy, string> = {
  relevant: 'Most relevant',
  name: 'Name A-Z',
  strength: 'Profile Strength',
  newest: 'Newest member',
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value]
}

/** A toggleable filter chip. */
function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex gap-3">
        <div className="h-12 w-12 animate-pulse rounded-full bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-2/3 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
        </div>
      </div>
      <div className="mt-4 h-3 w-1/2 animate-pulse rounded bg-gray-100" />
      <div className="mt-3 h-6 w-full animate-pulse rounded bg-gray-100" />
      <div className="mt-4 h-8 w-full animate-pulse rounded bg-gray-100" />
    </div>
  )
}

export default function EcosystemProfiles() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const activeContextId = searchParams.get('contextId')

  const { sendInvites } = useSendInvites()

  // ── Live data ──────────────────────────────────────────────────────────
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invitedUserIds, setInvitedUserIds] = useState<Set<string>>(new Set())

  // ── UI state ───────────────────────────────────────────────────────────
  const [inviting, setInviting] = useState<Record<string, 'loading' | 'error'>>(
    {},
  )
  const [locallyInvited, setLocallyInvited] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [selectedStage, setSelectedStage] = useState('')
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([])
  const [selectedExpertise, setSelectedExpertise] = useState<string[]>([])
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [view, setView] = useState<ViewMode>('grid')
  const [sortBy, setSortBy] = useState<SortBy>('relevant')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Listener 1: all users. Listener 2: invites sent by the current user.
  useEffect(() => {
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        setAllUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as User))
        setError(null)
        setLoading(false)
      },
      (err) => {
        console.error('EcosystemProfiles users listener error:', err)
        setError(err.message)
        setLoading(false)
      },
    )

    if (!user) return () => unsubUsers()

    const unsubInvites = onSnapshot(
      query(collection(db, 'invites'), where('invitedBy', '==', user.uid)),
      (snap) => {
        setInvitedUserIds(
          new Set(snap.docs.map((d) => d.data().invitedUserId as string)),
        )
      },
      (err) => console.error('EcosystemProfiles invites listener error:', err),
    )

    return () => {
      unsubUsers()
      unsubInvites()
    }
  }, [user])

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(id)
  }, [toast])

  // ── Derived data ───────────────────────────────────────────────────────
  const industryOptions = useMemo(
    () => uniqueSorted(allUsers.flatMap((u) => u.inferredSector ?? [])),
    [allUsers],
  )
  const expertiseOptions = useMemo(
    () => uniqueSorted(allUsers.flatMap((u) => u.inferredExpertise ?? [])),
    [allUsers],
  )
  const locationOptions = useMemo(
    () => uniqueSorted(allUsers.map((u) => u.location ?? '')),
    [allUsers],
  )
  const stageOptions = useMemo(
    () => uniqueSorted(allUsers.map((u) => u.inferredStage ?? '')),
    [allUsers],
  )

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return allUsers.filter((u) => {
      if (user && u.id === user.uid) return false

      const matchesSearch =
        !q ||
        u.name?.toLowerCase().includes(q) ||
        u.headline?.toLowerCase().includes(q) ||
        (u.inferredSector ?? []).some((s) => s.toLowerCase().includes(q)) ||
        (u.inferredExpertise ?? []).some((e) => e.toLowerCase().includes(q))

      const matchesRole =
        !selectedRole ||
        derivePossibleRoles(u).some((r) => r.label === selectedRole)

      const matchesIndustry =
        selectedIndustries.length === 0 ||
        (u.inferredSector ?? []).some((s) => selectedIndustries.includes(s))

      const matchesExpertise =
        selectedExpertise.length === 0 ||
        (u.inferredExpertise ?? []).some((e) => selectedExpertise.includes(e))

      const matchesLocation =
        selectedLocations.length === 0 ||
        (u.location ? selectedLocations.includes(u.location) : false)

      const matchesStage = !selectedStage || u.inferredStage === selectedStage

      return (
        matchesSearch &&
        matchesRole &&
        matchesIndustry &&
        matchesExpertise &&
        matchesLocation &&
        matchesStage
      )
    })
  }, [
    allUsers,
    user,
    searchQuery,
    selectedRole,
    selectedIndustries,
    selectedExpertise,
    selectedLocations,
    selectedStage,
  ])

  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      if (sortBy === 'name') return (a.name ?? '').localeCompare(b.name ?? '')
      if (sortBy === 'newest') {
        return (
          (toDateSafe(b.createdAt)?.getTime() ?? 0) -
          (toDateSafe(a.createdAt)?.getTime() ?? 0)
        )
      }
      return (b.profileCompleteness ?? 0) - (a.profileCompleteness ?? 0)
    })
  }, [filteredUsers, sortBy])

  const selectedUser = allUsers.find((u) => u.id === selectedUserId) ?? null

  // Active filters, flattened into removable pills.
  const activeFilters = useMemo(() => {
    const pills: { key: string; label: string; remove: () => void }[] = []
    if (selectedRole) {
      pills.push({
        key: 'role',
        label: selectedRole,
        remove: () => setSelectedRole(''),
      })
    }
    if (selectedStage) {
      pills.push({
        key: 'stage',
        label: selectedStage,
        remove: () => setSelectedStage(''),
      })
    }
    for (const value of selectedIndustries) {
      pills.push({
        key: `ind-${value}`,
        label: value,
        remove: () =>
          setSelectedIndustries((prev) => prev.filter((v) => v !== value)),
      })
    }
    for (const value of selectedExpertise) {
      pills.push({
        key: `exp-${value}`,
        label: value,
        remove: () =>
          setSelectedExpertise((prev) => prev.filter((v) => v !== value)),
      })
    }
    for (const value of selectedLocations) {
      pills.push({
        key: `loc-${value}`,
        label: value,
        remove: () =>
          setSelectedLocations((prev) => prev.filter((v) => v !== value)),
      })
    }
    return pills
  }, [
    selectedRole,
    selectedStage,
    selectedIndustries,
    selectedExpertise,
    selectedLocations,
  ])

  const hasActiveFilters = activeFilters.length > 0 || searchQuery.trim() !== ''

  function clearAll() {
    setSearchQuery('')
    setSelectedRole('')
    setSelectedStage('')
    setSelectedIndustries([])
    setSelectedExpertise([])
    setSelectedLocations([])
  }

  // ── Actions ────────────────────────────────────────────────────────────
  const canInvite = Boolean(activeContextId)

  function inviteStateFor(id: string): InviteState {
    return inviting[id] ?? 'idle'
  }
  function invitedFor(id: string): boolean {
    return invitedUserIds.has(id) || locallyInvited.has(id)
  }

  async function handleInvite(target: User) {
    if (!activeContextId) return
    setInviting((prev) => ({ ...prev, [target.id]: 'loading' }))
    const role = deriveRole(target)
    try {
      await sendInvites(activeContextId, [
        {
          userId: target.id,
          invitedUserId: target.id,
          suggestedRole: role.relationshipRole,
          relationshipType: role.relationshipType,
          reason: `Invited from the Ecosystem Profiles directory as a ${role.label}.`,
          confidence: Math.round(target.profileCompleteness ?? 0),
        },
      ])
      setInviting((prev) => {
        const next = { ...prev }
        delete next[target.id]
        return next
      })
      setLocallyInvited((prev) => new Set(prev).add(target.id))
      setToast(`Invite sent to ${target.name}.`)
    } catch (err) {
      console.error('sendInvites failed:', err)
      setInviting((prev) => ({ ...prev, [target.id]: 'error' }))
      setToast('Could not send invite. Try again.')
    }
  }

  return (
    <div
      className="relative min-h-[80vh]"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="hidden h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/30 sm:grid">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-950">
              Ecosystem Profiles
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Explore AI-generated profiles of people and organisations
              available for ecosystem matching.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
            aria-label="Help"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── Banners ────────────────────────────────────────────────────── */}
      {!activeContextId && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Select a context from{' '}
          <Link to="/contexts" className="font-semibold underline">
            My Contexts
          </Link>{' '}
          to enable invites.
        </div>
      )}
      {error && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
          <p className="text-sm font-medium text-red-700">
            Failed to load profiles. Check your connection.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search profiles by name, company or keyword..."
            aria-label="Search ecosystem profiles"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersExpanded((open) => !open)}
          aria-expanded={filtersExpanded}
          aria-label="Toggle filters"
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
            filtersExpanded
              ? 'border-blue-200 bg-blue-50 text-blue-700'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFilters.length > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-blue-600 px-1 text-[11px] font-bold text-white">
              {activeFilters.length}
            </span>
          )}
        </button>
        <div className="hidden h-6 w-px bg-gray-200 sm:block" />
        <label className="text-xs font-medium text-gray-500">
          <span className="sr-only sm:not-sr-only">Sort</span>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortBy)}
            className="ml-1.5 rounded-lg border border-gray-200 bg-white py-2 pl-2.5 pr-7 text-xs font-semibold text-gray-700 focus:outline-none"
          >
            {(Object.keys(SORT_LABELS) as SortBy[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex overflow-hidden rounded-lg border border-gray-200">
          <button
            type="button"
            onClick={() => setView('grid')}
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
            className={`p-2 transition-colors ${
              view === 'grid'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView('table')}
            aria-label="Table view"
            aria-pressed={view === 'table'}
            className={`p-2 transition-colors ${
              view === 'table'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Active filter pills ────────────────────────────────────────── */}
      {hasActiveFilters && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {activeFilters.map((pill) => (
            <span
              key={pill.key}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 py-1 pl-2.5 pr-1 text-xs font-semibold text-blue-700"
            >
              {pill.label}
              <button
                type="button"
                onClick={pill.remove}
                aria-label={`Remove ${pill.label} filter`}
                className="grid h-4 w-4 place-items-center rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-700"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="rounded-full px-2.5 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── Filter panel ───────────────────────────────────────────────── */}
      {filtersExpanded && (
        <div className="mt-2 space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-4">
            <label className="text-xs font-semibold text-gray-600">
              Role
              <select
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value)}
                className="ml-2 rounded-md border border-gray-200 py-1 pl-2 pr-6 text-xs font-medium text-gray-700 focus:outline-none"
              >
                <option value="">All roles</option>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Stage
              <select
                value={selectedStage}
                onChange={(event) => setSelectedStage(event.target.value)}
                className="ml-2 rounded-md border border-gray-200 py-1 pl-2 pr-6 text-xs font-medium capitalize text-gray-700 focus:outline-none"
              >
                <option value="">All stages</option>
                {stageOptions.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {industryOptions.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-gray-600">
                Industry
              </p>
              <div className="flex flex-wrap gap-1.5">
                {industryOptions.map((industry) => (
                  <FilterChip
                    key={industry}
                    label={industry}
                    active={selectedIndustries.includes(industry)}
                    onClick={() =>
                      setSelectedIndustries((prev) => toggle(prev, industry))
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {expertiseOptions.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-gray-600">
                Expertise
              </p>
              <div className="flex flex-wrap gap-1.5">
                {expertiseOptions.map((skill) => (
                  <FilterChip
                    key={skill}
                    label={skill}
                    active={selectedExpertise.includes(skill)}
                    onClick={() =>
                      setSelectedExpertise((prev) => toggle(prev, skill))
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {locationOptions.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-gray-600">
                Location
              </p>
              <div className="flex flex-wrap gap-1.5">
                {locationOptions.map((place) => (
                  <FilterChip
                    key={place}
                    label={place}
                    active={selectedLocations.includes(place)}
                    onClick={() =>
                      setSelectedLocations((prev) => toggle(prev, place))
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Results count ──────────────────────────────────────────────── */}
      <p className="mt-4 text-sm font-semibold text-gray-700">
        {loading ? 'Loading profiles…' : `${sortedUsers.length} profiles found`}
      </p>

      {/* ── Results ────────────────────────────────────────────────────── */}
      <div className="mt-3">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : sortedUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-gray-100 text-gray-400">
              <Search className="h-7 w-7" />
            </div>
            <p className="text-sm font-medium text-gray-600">
              No profiles match your filters.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAll}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedUsers.map((profile) => (
              <ProfileCard
                key={profile.id}
                user={profile}
                isSelected={profile.id === selectedUserId}
                invited={invitedFor(profile.id)}
                inviteState={inviteStateFor(profile.id)}
                canInvite={canInvite}
                onView={() => setSelectedUserId(profile.id)}
                onInvite={() => handleInvite(profile)}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Industry</th>
                  <th className="px-4 py-3 font-semibold">Expertise</th>
                  <th className="px-4 py-3 font-semibold">Stage</th>
                  <th className="px-4 py-3 font-semibold">Profile Strength</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedUsers.map((profile) => {
                  const strength = strengthInfo(profile.profileCompleteness ?? 0)
                  return (
                    <tr
                      key={profile.id}
                      tabIndex={0}
                      onClick={() => setSelectedUserId(profile.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') setSelectedUserId(profile.id)
                      }}
                      className={`cursor-pointer transition-colors focus:bg-blue-50 focus:outline-none ${
                        profile.id === selectedUserId
                          ? 'bg-blue-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {profile.photoURL ? (
                            <img
                              src={profile.photoURL}
                              alt=""
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div
                              className={`grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold ${colorForName(
                                profile.name,
                              )}`}
                            >
                              {initials(profile.name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {profile.name}
                            </p>
                            <p className="truncate text-xs text-gray-400">
                              {profile.headline}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {profile.inferredSector?.[0] ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(profile.inferredExpertise ?? [])
                            .slice(0, 2)
                            .map((tag) => (
                              <span
                                key={tag}
                                className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600"
                              >
                                {tag}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm capitalize text-gray-600">
                        {profile.inferredStage ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${strength.dot}`}
                          />
                          <span className="text-sm font-semibold text-gray-700">
                            {Math.round(profile.profileCompleteness ?? 0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className="flex items-center justify-end gap-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedUserId(profile.id)}
                            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            View Profile
                          </button>
                          <div className="w-28">
                            <InviteButton
                              invited={invitedFor(profile.id)}
                              inviteState={inviteStateFor(profile.id)}
                              canInvite={canInvite}
                              userName={profile.name}
                              onInvite={() => handleInvite(profile)}
                              full
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Drawer ─────────────────────────────────────────────────────── */}
      {selectedUser && (
        <ProfileDrawer
          key={selectedUser.id}
          user={selectedUser}
          contextId={activeContextId}
          invited={invitedFor(selectedUser.id)}
          inviteState={inviteStateFor(selectedUser.id)}
          canInvite={canInvite}
          onClose={() => setSelectedUserId(null)}
          onInvite={() => handleInvite(selectedUser)}
          onToast={setToast}
        />
      )}

      {/* ── Toast ──────────────────────────────────────────────────────── */}
      {toast && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
