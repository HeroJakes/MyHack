/**
 * Seed script for EcoGraph AI.
 *
 * Populates the Firestore emulator with a deterministic demo dataset:
 *   - 10 users
 *   -  2 events
 *   -  2 ecosystem links
 *
 * Every document is written with `set()` and a fixed id, so the script is
 * idempotent — run it as often as you like.
 *
 * Usage:
 *   1. firebase emulators:start          (in another terminal)
 *   2. npm run seed
 */
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

// Route the Admin SDK at the local Firestore emulator unless told otherwise.
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
}
const projectId =
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  'myhack-c753f'

initializeApp({ projectId })
const db = getFirestore()
const now = Timestamp.now()

interface SeedUser {
  id: string
  name: string
  inferredSector: string[]
  inferredExpertise: string[]
  inferredStage:
    | 'pre-seed'
    | 'seed'
    | 'series-a'
    | 'growth'
    | 'established'
    | 'ecosystem'
  headline: string
  bio: string
  contributionSignals: string[]
  profileCompleteness: number
}

const SEED_USERS: SeedUser[] = [
  {
    id: 'user-001',
    name: 'Sarah Lim',
    inferredSector: ['FinTech'],
    inferredExpertise: ['Fundraising', 'Venture Capital'],
    inferredStage: 'seed',
    headline: 'Founder & CEO, payments startup',
    bio: 'Building a cross-border payments startup. Closed a seed round and now mentors first-time founders on fundraising.',
    contributionSignals: ['Raised seed round', 'Mentors 3 founders'],
    profileCompleteness: 88,
  },
  {
    id: 'user-002',
    name: 'Ahmad Razif',
    inferredSector: ['HealthTech'],
    inferredExpertise: ['Regulatory Affairs', 'Compliance'],
    inferredStage: 'series-a',
    headline: 'Head of Regulatory, digital health platform',
    bio: 'Leads regulatory strategy for a Series A digital health platform. Deep experience with medical device approvals.',
    contributionSignals: ['Cleared 5 device approvals', 'Speaks at health summits'],
    profileCompleteness: 84,
  },
  {
    id: 'user-003',
    name: 'Priya Nair',
    inferredSector: ['AgriTech'],
    inferredExpertise: ['Supply Chain', 'Logistics'],
    inferredStage: 'seed',
    headline: 'Co-founder, farm-to-market logistics',
    bio: 'Co-founded an AgriTech startup optimising farm-to-market supply chains across Southeast Asia.',
    contributionSignals: ['Onboarded 200 farms', 'Pilot with grocery chain'],
    profileCompleteness: 76,
  },
  {
    id: 'user-004',
    name: 'Jason Wong',
    inferredSector: ['SaaS'],
    inferredExpertise: ['Enterprise Sales', 'Go-To-Market'],
    inferredStage: 'growth',
    headline: 'VP Sales, B2B SaaS scale-up',
    bio: 'Scaled enterprise sales at a growth-stage B2B SaaS company from $1M to $20M ARR.',
    contributionSignals: ['Built 12-person sales team', 'Closed 40 enterprise logos'],
    profileCompleteness: 81,
  },
  {
    id: 'user-005',
    name: 'Nurul Ain',
    inferredSector: ['EdTech'],
    inferredExpertise: ['Curriculum Design', 'Pedagogy'],
    inferredStage: 'pre-seed',
    headline: 'Founder, adaptive learning startup',
    bio: 'Designing adaptive learning curricula for secondary schools. Pre-seed, validating with three pilot schools.',
    contributionSignals: ['3 pilot schools', 'Former teacher of 8 years'],
    profileCompleteness: 64,
  },
  {
    id: 'user-006',
    name: 'David Tan',
    inferredSector: ['FinTech', 'Venture Capital'],
    inferredExpertise: ['Investment', 'Due Diligence'],
    inferredStage: 'ecosystem',
    headline: 'Partner, early-stage VC fund',
    bio: 'Partner at an early-stage VC fund focused on FinTech. Invests at pre-seed and seed across the region.',
    contributionSignals: ['Led 18 investments', 'Sits on 6 boards'],
    profileCompleteness: 92,
  },
  {
    id: 'user-007',
    name: 'Siti Aminah',
    inferredSector: ['Government'],
    inferredExpertise: ['Policy', 'Regulation'],
    inferredStage: 'ecosystem',
    headline: 'Senior Policy Advisor, digital economy',
    bio: 'Senior policy advisor shaping digital economy and innovation policy. Connects startups to government programmes.',
    contributionSignals: ['Drafted 2 innovation frameworks', 'Runs a grant programme'],
    profileCompleteness: 79,
  },
  {
    id: 'user-008',
    name: 'Rajan Kumar',
    inferredSector: ['Cybersecurity'],
    inferredExpertise: ['Cloud Security', 'DevSecOps'],
    inferredStage: 'established',
    headline: 'CTO, cloud security company',
    bio: 'CTO of an established cloud security company. Advises startups on security architecture and DevSecOps.',
    contributionSignals: ['Holds 4 patents', 'Mentors at 2 accelerators'],
    profileCompleteness: 87,
  },
  {
    id: 'user-009',
    name: 'Mei Lin',
    inferredSector: ['HealthTech', 'AgriTech'],
    inferredExpertise: ['Go-To-Market', 'Growth'],
    inferredStage: 'growth',
    headline: 'Growth Lead, cross-sector operator',
    bio: 'Growth operator who has launched products across HealthTech and AgriTech. Strong go-to-market playbooks.',
    contributionSignals: ['Launched 5 products', 'Mentored HealthTech cohort'],
    profileCompleteness: 90,
  },
  {
    id: 'user-010',
    name: 'Hafiz Zain',
    inferredSector: ['Supply Chain', 'SaaS'],
    inferredExpertise: ['B2B SaaS', 'Operations'],
    inferredStage: 'seed',
    headline: 'Founder, supply chain SaaS',
    bio: 'Founder of a seed-stage B2B SaaS company digitising supply chain operations for SMEs.',
    contributionSignals: ['50 paying customers', 'Bootstrapped to seed'],
    profileCompleteness: 73,
  },
]

const SEED_EVENTS = [
  {
    id: 'event-001',
    name: 'Tech Summit KL 2026',
    contextType: 'Event' as const,
    type: 'Summit',
    field: 'FinTech',
    description:
      'The flagship FinTech summit in Kuala Lumpur connecting founders, mentors and investors.',
    createdBy: 'user-001',
    status: 'open' as const,
    eventDate: Timestamp.fromDate(new Date('2026-08-15T09:00:00+08:00')),
    roleRequirements: [
      {
        role: 'Mentor' as const,
        count: 2,
        relationshipType: 'mentor_match' as const,
        requirements:
          'Experienced FinTech operators who can mentor early-stage founders on fundraising and product.',
      },
      {
        role: 'Partner' as const,
        count: 1,
        relationshipType: 'partner_linkage' as const,
        requirements:
          'A FinTech-focused investor or corporate partner open to pilots and partnerships.',
      },
      {
        role: 'Startup/Company' as const,
        count: 3,
        relationshipType: 'participant_orchestration' as const,
        requirements: 'Early-stage FinTech startups ready to pitch on the main stage.',
      },
    ],
  },
  {
    id: 'event-002',
    name: 'HealthTech Demo Day',
    contextType: 'Event' as const,
    type: 'Demo Day',
    field: 'HealthTech',
    description:
      'A demo day spotlighting HealthTech startups with working products in front of mentors and partners.',
    createdBy: 'user-002',
    status: 'open' as const,
    eventDate: Timestamp.fromDate(new Date('2026-09-20T10:00:00+08:00')),
    roleRequirements: [
      {
        role: 'Mentor' as const,
        count: 3,
        relationshipType: 'mentor_match' as const,
        requirements:
          'HealthTech mentors with regulatory, clinical or commercialisation experience.',
      },
      {
        role: 'Partner' as const,
        count: 2,
        relationshipType: 'partner_linkage' as const,
        requirements:
          'Healthcare providers or investors open to partnerships with HealthTech startups.',
      },
      {
        role: 'Startup/Company' as const,
        count: 4,
        relationshipType: 'participant_orchestration' as const,
        requirements: 'HealthTech startups with a working demo to showcase.',
      },
    ],
  },
]

const SEED_LINKS = [
  {
    id: 'link-001',
    sourceUserId: 'user-009',
    targetUserId: 'user-002',
    contextId: 'event-002',
    contextName: 'HealthTech Demo Day',
    contextType: 'Event',
    field: 'HealthTech',
    sourceType: 'Mentor',
    targetType: 'Programme Admin',
    relationshipType: 'mentor_match' as const,
    assignedRole: 'Mentor' as const,
    aiReason:
      'Mei Lin has launched HealthTech products and previously mentored a HealthTech cohort.',
    confidence: 86,
    riskFlags: [] as string[],
    status: 'completed' as const,
    outcomeScore: 88,
    feedbackSummary: 'Mentee progressed from prototype to a clinical pilot.',
    reusableTags: ['mentor_match', 'HealthTech'],
    createdFromInviteId: 'seed-invite-001',
  },
  {
    id: 'link-002',
    sourceUserId: 'user-006',
    targetUserId: 'user-001',
    contextId: 'event-001',
    contextName: 'Tech Summit KL 2026',
    contextType: 'Event',
    field: 'FinTech',
    sourceType: 'Partner',
    targetType: 'Programme Admin',
    relationshipType: 'partner_linkage' as const,
    assignedRole: 'Partner' as const,
    aiReason:
      'David Tan is a FinTech-focused VC partner and a strong investor linkage for the summit.',
    confidence: 91,
    riskFlags: [] as string[],
    status: 'active' as const,
    reusableTags: ['partner_linkage', 'FinTech'],
    createdFromInviteId: 'seed-invite-002',
  },
]

async function seed(): Promise<void> {
  // Users
  for (const u of SEED_USERS) {
    await db
      .collection('users')
      .doc(u.id)
      .set({
        id: u.id,
        name: u.name,
        email: `${u.id}@ecograph.demo`,
        photoURL: `https://i.pravatar.cc/150?u=${u.id}`,
        headline: u.headline,
        linkedinId: u.id,
        inferredSector: u.inferredSector,
        inferredExpertise: u.inferredExpertise,
        inferredStage: u.inferredStage,
        contributionSignals: u.contributionSignals,
        bio: u.bio,
        profileCompleteness: u.profileCompleteness,
        createdAt: now,
        updatedAt: now,
      })
    console.log(`  user  ✓ ${u.id} (${u.name})`)
  }

  // Events
  for (const e of SEED_EVENTS) {
    await db.collection('events').doc(e.id).set({ ...e, createdAt: now })
    console.log(`  event ✓ ${e.id} (${e.name})`)
  }

  // Ecosystem links
  for (const l of SEED_LINKS) {
    await db
      .collection('ecosystemLinks')
      .doc(l.id)
      .set({ ...l, createdAt: now, updatedAt: now })
    console.log(`  link  ✓ ${l.id} (${l.relationshipType}, ${l.status})`)
  }
}

seed()
  .then(() => {
    console.log(
      `\nSeed complete: ${SEED_USERS.length} users, ${SEED_EVENTS.length} events, ${SEED_LINKS.length} ecosystem links.`,
    )
    process.exit(0)
  })
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
