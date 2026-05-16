/**
 * demoEcosystemLinks — seeded data + display config for the Ecosystem Links
 * page.
 *
 * The page is a hardcoded demo. `DemoEcosystemLink` is a self-contained view
 * model that intentionally differs from the Firestore-backed `EcosystemLink`
 * in `src/types.ts`: it carries denormalised actor names/roles and uses plain
 * `Date` values so the page renders without a backend. Swap `MOCK_LINKS` for a
 * Firestore `onSnapshot` listener when wiring this up for real.
 */
import type { RelationshipType, EcosystemLinkStatus } from '../types'

/** Status union, aliased to the name used throughout this feature. */
export type LinkStatus = EcosystemLinkStatus

export interface DemoEcosystemLink {
  id: string
  sourceUserId: string
  sourceUserName: string
  sourceUserRole: string
  sourceUserPhoto?: string
  targetUserId: string
  targetUserName: string
  targetUserRole: string
  targetUserPhoto?: string
  contextId: string
  contextName: string
  contextType: 'Event' | 'Programme' | 'Initiative' | 'Cohort' | 'CountryExpansion'
  field: string
  sourceType: 'ProgrammeAdmin' | 'Company' | 'Mentor' | 'Partner' | 'ServiceProvider'
  targetType: 'Company' | 'Mentor' | 'Partner' | 'ServiceProvider' | 'ProgrammeAdmin'
  relationshipType: RelationshipType
  assignedRole: string
  aiReason: string
  confidence: number
  riskFlags: string[]
  status: LinkStatus
  outcomeScore?: number
  feedbackSummary?: string
  reusableTags: string[]
  createdFromInviteId: string
  createdAt: Date
  updatedAt: Date
}

export const MOCK_LINKS: DemoEcosystemLink[] = [
  {
    id: 'link-001',
    sourceUserId: 'user-admin-001',
    sourceUserName: 'Alex Tan',
    sourceUserRole: 'Programme Admin',
    targetUserId: 'user-001',
    targetUserName: 'Sarah Lim',
    targetUserRole: 'Startup Mentor',
    contextId: 'event-001',
    contextName: 'FinTech Summit 2026',
    contextType: 'Event',
    field: 'FinTech',
    sourceType: 'ProgrammeAdmin',
    targetType: 'Mentor',
    relationshipType: 'mentor_match',
    assignedRole: 'Mentor',
    aiReason:
      "Sarah has strong FinTech and fundraising experience, making her ideal to support GreenPay's seed-stage growth and investor readiness.",
    confidence: 92,
    riskFlags: [],
    status: 'active',
    reusableTags: ['FinTech', 'Fundraising', 'Seed', 'Banking', 'Growth Strategy'],
    createdFromInviteId: 'invite-001',
    createdAt: new Date('2026-05-16'),
    updatedAt: new Date('2026-05-16'),
  },
  {
    id: 'link-002',
    sourceUserId: 'user-006',
    sourceUserName: 'David Tan',
    sourceUserRole: 'Partner Manager',
    targetUserId: 'user-panempay',
    targetUserName: 'PanempayX Sdn Bhd',
    targetUserRole: 'FinTech Startup',
    contextId: 'event-001',
    contextName: 'FinTech Summit 2026',
    contextType: 'Event',
    field: 'FinTech',
    sourceType: 'Partner',
    targetType: 'Company',
    relationshipType: 'partner_linkage',
    assignedRole: 'Partner',
    aiReason:
      "David brings deep VC and FinTech network ideal for PanempayX's growth stage.",
    confidence: 91,
    riskFlags: [],
    status: 'active',
    reusableTags: ['FinTech', 'VC', 'Partnership'],
    createdFromInviteId: 'invite-002',
    createdAt: new Date('2026-05-15'),
    updatedAt: new Date('2026-05-15'),
  },
  {
    id: 'link-003',
    sourceUserId: 'user-009',
    sourceUserName: 'Mei Lin',
    sourceUserRole: 'Startup Mentor',
    targetUserId: 'user-healthtech',
    targetUserName: 'HealthTech Labs',
    targetUserRole: 'HealthTech Startup',
    contextId: 'event-002',
    contextName: 'HealthTech Demo Day',
    contextType: 'Event',
    field: 'HealthTech',
    sourceType: 'Mentor',
    targetType: 'Company',
    relationshipType: 'mentor_match',
    assignedRole: 'Mentor',
    aiReason:
      "Mei Lin's go-to-market and fundraising track record in HealthTech strongly aligns with HealthTech Labs' current needs.",
    confidence: 88,
    riskFlags: [],
    status: 'completed',
    outcomeScore: 88,
    reusableTags: ['HealthTech', 'GTM', 'Fundraising'],
    createdFromInviteId: 'invite-003',
    createdAt: new Date('2026-05-02'),
    updatedAt: new Date('2026-05-02'),
  },
  {
    id: 'link-004',
    sourceUserId: 'user-lex',
    sourceUserName: 'LexBridge Consulting',
    sourceUserRole: 'Legal Advisor',
    targetUserId: 'user-greenpay',
    targetUserName: 'GreenPay Sdn Bhd',
    targetUserRole: 'FinTech Startup',
    contextId: 'event-003',
    contextName: 'FinTech Accelerator Cohort 3',
    contextType: 'Cohort',
    field: 'FinTech',
    sourceType: 'ServiceProvider',
    targetType: 'Company',
    relationshipType: 'service_support',
    assignedRole: 'Service Provider',
    aiReason:
      "LexBridge provides regulatory and legal support critical for GreenPay's compliance requirements.",
    confidence: 84,
    riskFlags: ['Limited shared context history'],
    status: 'active',
    reusableTags: ['FinTech', 'Legal', 'Compliance'],
    createdFromInviteId: 'invite-004',
    createdAt: new Date('2026-04-30'),
    updatedAt: new Date('2026-04-30'),
  },
]

export const GRAPH_STATS = {
  activeLinks: 24,
  completedLinks: 12,
  avgConfidence: 87,
  reusedLinks: 8,
  mentors: 42,
  partners: 28,
  startups: 86,
  serviceProviders: 31,
  programmeAdmins: 15,
}

export const RELATIONSHIP_TYPE_CONFIG: Record<
  RelationshipType,
  { label: string; color: string }
> = {
  mentor_match: { label: 'Mentor Match', color: 'bg-blue-100 text-blue-700' },
  partner_linkage: { label: 'Partner Linkage', color: 'bg-orange-100 text-orange-700' },
  service_support: { label: 'Service Support', color: 'bg-purple-100 text-purple-700' },
  programme_fit: { label: 'Programme Fit', color: 'bg-green-100 text-green-700' },
  participant_orchestration: { label: 'Participant', color: 'bg-gray-100 text-gray-700' },
}

export const STATUS_CONFIG: Record<
  LinkStatus,
  { label: string; color: string }
> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700' },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-600' },
  invited: { label: 'Invited', color: 'bg-yellow-100 text-yellow-700' },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-700' },
  archived: { label: 'Archived', color: 'bg-gray-100 text-gray-400' },
  suggested: { label: 'Suggested', color: 'bg-indigo-100 text-indigo-700' },
}

/** Tailwind text color for a confidence score: green >= 80, yellow >= 60, red. */
export function confidenceColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  return 'text-red-500'
}

/** Formats a link date as e.g. "16 May 2026". */
export function formatLinkDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
