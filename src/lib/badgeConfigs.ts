/**
 * badgeConfigs — shared display config for ecosystem-link badges.
 *
 * Used by the live Ecosystem Links page and its components. Kept separate
 * from `demoEcosystemLinks.ts` (which now only backs the seed script).
 */

export const RELATIONSHIP_TYPE_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  mentor_match: { label: 'Mentor Match', className: 'bg-blue-100 text-blue-700' },
  partner_linkage: {
    label: 'Partner Linkage',
    className: 'bg-orange-100 text-orange-700',
  },
  service_support: {
    label: 'Service Support',
    className: 'bg-purple-100 text-purple-700',
  },
  programme_fit: {
    label: 'Programme Fit',
    className: 'bg-green-100 text-green-700',
  },
  participant_orchestration: {
    label: 'Participant',
    className: 'bg-gray-100 text-gray-700',
  },
}

export const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  active: { label: 'Active', className: 'bg-green-100 text-green-700' },
  completed: { label: 'Completed', className: 'bg-gray-100 text-gray-600' },
  invited: { label: 'Invited', className: 'bg-yellow-100 text-yellow-700' },
  declined: { label: 'Declined', className: 'bg-red-100 text-red-700' },
  archived: { label: 'Archived', className: 'bg-gray-100 text-gray-400' },
  suggested: { label: 'Suggested', className: 'bg-indigo-100 text-indigo-700' },
}

/** Fallback used when a relationship type / status is unknown. */
export const UNKNOWN_BADGE = { label: 'Unknown', className: 'bg-gray-100 text-gray-500' }

/** Tailwind text color for a confidence score: green >= 80, yellow >= 60, red. */
export function confidenceColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  return 'text-red-500'
}

/** Formats a date as e.g. "16 May 2026". */
export function formatLinkDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
