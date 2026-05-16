/**
 * profileHelpers — role derivation + display helpers for Ecosystem Profiles.
 *
 * `users` documents carry no explicit role, so a likely role is derived from
 * `contributionSignals` and `inferredStage`. The derived `RoleInfo` also
 * supplies the `RelationshipRole` / `RelationshipType` needed to send invites.
 */
import type { RelationshipRole, RelationshipType, User } from '../types'

export interface RoleInfo {
  key: 'mentor' | 'partner' | 'startup' | 'service'
  label: string
  relationshipRole: RelationshipRole
  relationshipType: RelationshipType
  /** Badge styling (card corner / drawer header). */
  badgeClass: string
  /** Chip styling ("Possible Roles"). */
  chipClass: string
  /** Hex dot used in the table view. */
  dot: string
}

export const ROLE_INFO: Record<RoleInfo['key'], RoleInfo> = {
  mentor: {
    key: 'mentor',
    label: 'Mentor',
    relationshipRole: 'Mentor',
    relationshipType: 'mentor_match',
    badgeClass: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    chipClass: 'bg-blue-50 text-blue-700',
    dot: '#2563eb',
  },
  partner: {
    key: 'partner',
    label: 'Partner',
    relationshipRole: 'Partner',
    relationshipType: 'partner_linkage',
    badgeClass: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    chipClass: 'bg-amber-50 text-amber-700',
    dot: '#d97706',
  },
  startup: {
    key: 'startup',
    label: 'Startup',
    relationshipRole: 'Startup/Company',
    relationshipType: 'participant_orchestration',
    badgeClass: 'bg-green-50 text-green-700 ring-1 ring-green-200',
    chipClass: 'bg-green-50 text-green-700',
    dot: '#16a34a',
  },
  service: {
    key: 'service',
    label: 'Service Provider',
    relationshipRole: 'Service Provider',
    relationshipType: 'service_support',
    badgeClass: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
    chipClass: 'bg-purple-50 text-purple-700',
    dot: '#9333ea',
  },
}

function signalsOf(user: User): string[] {
  return (user.contributionSignals ?? []).map((s) => s.toLowerCase())
}

/** The single most likely role for a user (used for the badge). */
export function deriveRole(user: User): RoleInfo {
  const signals = signalsOf(user)
  const has = (keyword: string) => signals.some((s) => s.includes(keyword))
  if (has('mentor')) return ROLE_INFO.mentor
  if (has('partner') || has('corporate')) return ROLE_INFO.partner
  if (user.inferredStage === 'pre-seed' || user.inferredStage === 'seed') {
    return ROLE_INFO.startup
  }
  return ROLE_INFO.service
}

/** Up to three roles a user could plausibly fill. */
export function derivePossibleRoles(user: User): RoleInfo[] {
  const signals = signalsOf(user)
  const has = (keyword: string) => signals.some((s) => s.includes(keyword))
  const roles: RoleInfo[] = []
  if (has('mentor') || has('advisor')) roles.push(ROLE_INFO.mentor)
  if (has('partner') || has('corporate') || has('invest')) {
    roles.push(ROLE_INFO.partner)
  }
  if (
    user.inferredStage === 'pre-seed' ||
    user.inferredStage === 'seed' ||
    has('founder')
  ) {
    roles.push(ROLE_INFO.startup)
  }
  if (has('service') || has('legal') || has('consult') || has('develop')) {
    roles.push(ROLE_INFO.service)
  }
  if (roles.length === 0) roles.push(deriveRole(user))
  const seen = new Set<string>()
  return roles.filter((r) => !seen.has(r.key) && seen.add(r.key)).slice(0, 3)
}

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-blue-100 text-blue-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
]

/** Up-to-two-letter initials from a name. */
export function initials(name: string): string {
  const parts = (name || '').split(/\s+/).filter(Boolean).slice(0, 2)
  const result = parts.map((p) => p[0]?.toUpperCase() ?? '').join('')
  return result || '?'
}

/** Deterministic avatar tint for a name. */
export function colorForName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export interface StrengthInfo {
  label: 'High' | 'Medium' | 'Low'
  bar: string
  text: string
  dot: string
}

/** Profile-strength banding: >= 85 High, >= 65 Medium, else Low. */
export function strengthInfo(score: number): StrengthInfo {
  if (score >= 85) {
    return { label: 'High', bar: 'bg-green-500', text: 'text-green-600', dot: 'bg-green-500' }
  }
  if (score >= 65) {
    return { label: 'Medium', bar: 'bg-amber-500', text: 'text-amber-600', dot: 'bg-amber-500' }
  }
  return { label: 'Low', bar: 'bg-red-500', text: 'text-red-500', dot: 'bg-red-500' }
}

/** Coerces a Firestore Timestamp / Date / plain value to a Date. */
export function toDateSafe(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  const ts = value as { toDate?: () => Date; seconds?: number }
  if (typeof ts.toDate === 'function') {
    try {
      return ts.toDate()
    } catch {
      return null
    }
  }
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000)
  return null
}

/** e.g. "Mar 2026" — used for "Member since". */
export function formatMemberSince(value: unknown): string {
  const date = toDateSafe(value)
  return date
    ? date.toLocaleDateString('en-MY', { month: 'short', year: 'numeric' })
    : 'Unknown'
}

/** e.g. "16 May 2026". */
export function formatShortDate(value: unknown): string {
  const date = toDateSafe(value)
  return date
    ? date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'
}
