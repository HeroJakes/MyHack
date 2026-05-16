/**
 * Seed script — populates `users`, `ecosystemContexts` and `ecosystemLinks`
 * with EcoGraph AI demo data.
 *
 * Run:  npm run seed
 *
 * Targets the Firestore emulator when FIRESTORE_EMULATOR_HOST is set
 * (e.g. "127.0.0.1:8080"); otherwise the live project, which needs
 * application-default credentials (GOOGLE_APPLICATION_CREDENTIALS).
 *
 * Seeds 10 users (no permanent role field — roles are per-relationship), 2
 * ecosystem contexts and 4 ecosystem links. Every link carries an
 * `outcomeScore` so `generateParticipants` can use past engagement data to
 * improve future matching. All writes are idempotent.
 */
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'myhack-c753f'

initializeApp({ projectId: PROJECT_ID })
const db = getFirestore()

const now = Timestamp.now()
/** Builds a Firestore Timestamp from an ISO date string. */
const date = (iso: string) => Timestamp.fromDate(new Date(iso))

// ─── Users — 10 ecosystem actors, no permanent role field ───────────────────

const USERS = [
  {
    id: 'user-001',
    name: 'Sarah Lim Hui Ying',
    email: 'sarah.lim@greenpay.my',
    photoURL: 'https://api.dicebear.com/7.x/initials/svg?seed=SarahLim',
    headline: 'Co-Founder & CEO, GreenPay Technologies',
    bio: "Building Malaysia's next-gen digital payment infrastructure for SMEs. Previously raised RM4M from angel investors and MDEC Digital Grant.",
    inferredSector: ['FinTech'],
    inferredExpertise: ['Fundraising', 'Angel Networks', 'Digital Payments', 'SME Banking'],
    inferredStage: 'seed',
    contributionSignals: ['fundraising-experience', 'startup-founder', 'fintech-operator'],
    profileCompleteness: 85,
  },
  {
    id: 'user-002',
    name: 'Dr. Ahmad Razif bin Othman',
    email: 'ahmad.razif@meditrack.asia',
    photoURL: 'https://api.dicebear.com/7.x/initials/svg?seed=AhmadRazif',
    headline: 'Medical Director & Co-Founder, MediTrack Asia',
    bio: 'Physician-turned-entrepreneur building AI diagnostic tools for KKM-certified hospitals. Led MOH regulatory submission for two digital health products.',
    inferredSector: ['HealthTech'],
    inferredExpertise: ['MOH Regulatory', 'Clinical Validation', 'Hospital Procurement', 'Digital Diagnostics'],
    inferredStage: 'growth',
    contributionSignals: ['regulatory-expert', 'clinical-operator', 'healthtech-founder'],
    profileCompleteness: 88,
  },
  {
    id: 'user-003',
    name: 'Priya Nair',
    email: 'priya.nair@farmlink.my',
    photoURL: 'https://api.dicebear.com/7.x/initials/svg?seed=PriyaNair',
    headline: 'Head of Operations, FarmLink Sdn Bhd',
    bio: 'Scaling agri-supply chain across Peninsular Malaysia. Manages relationships with 200+ smallholder farmers and 15 corporate buyers.',
    inferredSector: ['AgriTech'],
    inferredExpertise: ['Supply Chain', 'B2B Sales', 'Cold Chain Logistics', 'Smallholder Programmes'],
    inferredStage: 'seed',
    contributionSignals: ['operations-lead', 'b2b-sales', 'agritech-operator'],
    profileCompleteness: 72,
  },
  {
    id: 'user-004',
    name: 'Jason Wong Kah Wai',
    email: 'jason.wong@clouddesk.co',
    photoURL: 'https://api.dicebear.com/7.x/initials/svg?seed=JasonWong',
    headline: 'VP of Product, CloudDesk APAC',
    bio: 'Led PLG-driven growth from 0 to 8,000 SME customers across Malaysia, Singapore, and Thailand. Expert in enterprise sales motion for SaaS.',
    inferredSector: ['SaaS'],
    inferredExpertise: ['Enterprise Sales', 'Product-Led Growth', 'APAC Expansion', 'SaaS Metrics'],
    inferredStage: 'series-a',
    contributionSignals: ['product-leader', 'saas-growth', 'apac-expansion'],
    profileCompleteness: 80,
  },
  {
    id: 'user-005',
    name: 'Nurul Ain binti Hashim',
    email: 'nurulain@learnpath.my',
    photoURL: 'https://api.dicebear.com/7.x/initials/svg?seed=NurulAin',
    headline: 'Founder & CEO, LearnPath Sdn Bhd',
    bio: 'Building adaptive learning platform for secondary school students with active pilots in 12 MOE schools. Finalist, MDEC GAIN 2025.',
    inferredSector: ['EdTech'],
    inferredExpertise: ['Curriculum Design', 'B2G Sales', 'MOE Procurement', 'Adaptive Learning'],
    inferredStage: 'pre-seed',
    contributionSignals: ['edtech-founder', 'government-sales', 'education-innovation'],
    profileCompleteness: 65,
  },
  {
    id: 'user-006',
    name: 'David Tan Chee Seng',
    email: 'david.tan@vertexgrowth.vc',
    photoURL: 'https://api.dicebear.com/7.x/initials/svg?seed=DavidTan',
    headline: 'Partner, Vertex Growth Partners',
    bio: 'Early-stage VC with 12 portfolio companies across FinTech and SaaS in SEA. Led Series A for two Malaysian unicorn candidates. Active Cradle co-investor.',
    inferredSector: ['FinTech', 'SaaS'],
    inferredExpertise: ['Venture Capital', 'Series A Investment', 'LP Relations', 'Term Sheets', 'Portfolio Support'],
    inferredStage: 'ecosystem',
    contributionSignals: ['investor', 'board-member', 'ecosystem-builder'],
    profileCompleteness: 92,
  },
  {
    id: 'user-007',
    name: 'Siti Aminah binti Kamarudin',
    email: 'siti.aminah@mdec.my',
    photoURL: 'https://api.dicebear.com/7.x/initials/svg?seed=SitiAminah',
    headline: 'Director of Digital Economy, MDEC',
    bio: 'Leads Malaysia digital economy programme portfolio including GAIN, Global Accelerator, and Digital Export Blueprint. 14 years in public sector innovation.',
    inferredSector: ['Government'],
    inferredExpertise: ['Digital Economy Policy', 'Ecosystem Development', 'Grant Administration', 'Public-Private Partnerships'],
    inferredStage: 'ecosystem',
    contributionSignals: ['government-partner', 'grant-administrator', 'ecosystem-owner'],
    profileCompleteness: 90,
  },
  {
    id: 'user-008',
    name: 'Rajan Kumar a/l Selvam',
    email: 'rajan.kumar@cybershield.my',
    photoURL: 'https://api.dicebear.com/7.x/initials/svg?seed=RajanKumar',
    headline: 'CTO & Co-Founder, CyberShield Solutions',
    bio: 'Building managed security services for Malaysian financial institutions. Certified CISO with 10 years in cloud security and zero-trust architecture.',
    inferredSector: ['Cybersecurity'],
    inferredExpertise: ['Cloud Architecture', 'Zero Trust Security', 'SOC2 Compliance', 'Financial Services Security'],
    inferredStage: 'growth',
    contributionSignals: ['technical-founder', 'cybersecurity-expert', 'enterprise-sales'],
    profileCompleteness: 78,
  },
  {
    id: 'user-009',
    name: 'Mei Lin Chua',
    email: 'meilin.chua@cradlealumni.my',
    photoURL: 'https://api.dicebear.com/7.x/initials/svg?seed=MeiLin',
    headline: 'Senior Ecosystem Mentor, Cradle Fund Alumni Network',
    bio: 'Former CEO of two HealthTech and AgriTech exits. Mentors Cradle portfolio companies on go-to-market, regional expansion, and Series A fundraising. Mentored 30+ companies in the past 5 years.',
    inferredSector: ['HealthTech', 'AgriTech'],
    inferredExpertise: ['Go-to-Market Strategy', 'Fundraising', 'Regional Expansion', 'Series A Preparation', 'Board Advisory'],
    inferredStage: 'ecosystem',
    contributionSignals: ['mentor', 'serial-founder', 'investor-relations'],
    profileCompleteness: 95,
  },
  {
    id: 'user-010',
    name: 'Hafiz Zain bin Mohd Noor',
    email: 'hafiz.zain@logistream.my',
    photoURL: 'https://api.dicebear.com/7.x/initials/svg?seed=HafizZain',
    headline: 'CEO & Co-Founder, LogiStream Technologies',
    bio: 'Building last-mile logistics SaaS for Malaysian e-commerce and F&B sectors. Series A closed with Vertex Growth Partners. Expanding to Indonesia Q3 2026.',
    inferredSector: ['Supply Chain', 'SaaS'],
    inferredExpertise: ['B2B SaaS', 'Southeast Asia Logistics', 'Last-Mile Delivery', 'E-Commerce Integration'],
    inferredStage: 'series-a',
    contributionSignals: ['startup-founder', 'logistics-operator', 'b2b-saas'],
    profileCompleteness: 83,
  },
]

// ─── Contexts — 2 ecosystem contexts ─────────────────────────────────────────

const CONTEXTS = [
  {
    id: 'context-001',
    name: 'Tech Summit KL 2026',
    contextType: 'Event',
    field: 'FinTech',
    description:
      'Annual summit connecting Malaysian FinTech founders with regional investors, government partners, and banking institutions. Focused on enabling pilots, funding access, and regulatory navigation for FinTech companies at seed to series-A stage. Organised by MDEC in partnership with BNM FinTech Lab.',
    locationType: 'Physical',
    location: 'Kuala Lumpur Convention Centre',
    startDate: date('2026-06-20'),
    endDate: date('2026-06-21'),
    status: 'open',
    targetOutcomes: [
      'Connect FinTech founders with regional investors',
      'Enable regulatory navigation for seed-stage startups',
      'Facilitate banking pilot partnerships',
    ],
    relationshipNeeds: [
      {
        role: 'Mentor',
        count: 2,
        relationshipType: 'mentor_match',
        requirements:
          'Senior FinTech practitioners with fundraising, compliance, or banking partnership experience. Must have led at least one company through a funding round or regulatory approval in Southeast Asia.',
      },
      {
        role: 'Partner',
        count: 1,
        relationshipType: 'partner_linkage',
        requirements:
          'Banking institution, government agency, or enterprise with active FinTech pilot programme. Preference for organisations with existing MoU track record with Malaysian startups.',
      },
      {
        role: 'Startup/Company',
        count: 3,
        relationshipType: 'participant_orchestration',
        requirements:
          'FinTech startups at seed or series-A stage seeking investor introductions, pilot partners, or regulatory guidance. Must be Malaysia-incorporated or have active Malaysian operations.',
      },
    ],
    createdBy: 'user-007',
  },
  {
    id: 'context-002',
    name: 'HealthTech Demo Day KL',
    contextType: 'Event',
    field: 'HealthTech',
    description:
      'Demo day for Malaysian HealthTech startups presenting solutions to hospital procurement teams, MOH officials, and regional health investors. Designed to accelerate clinical validation partnerships and public health procurement conversations. Co-organised by MDEC and KKM Digital Health Unit.',
    locationType: 'Physical',
    location: 'Cyberview Innovation Hub, Cyberjaya',
    startDate: date('2026-07-10'),
    endDate: date('2026-07-10'),
    status: 'open',
    targetOutcomes: [
      'Accelerate clinical validation partnerships',
      'Open hospital and MOH procurement conversations',
      'Connect HealthTech startups with regional health investors',
    ],
    relationshipNeeds: [
      {
        role: 'Mentor',
        count: 3,
        relationshipType: 'mentor_match',
        requirements:
          'Experienced HealthTech operators with clinical, regulatory, or go-to-market expertise. Familiarity with MOH procurement cycles and hospital decision-making processes is highly valued.',
      },
      {
        role: 'Partner',
        count: 2,
        relationshipType: 'partner_linkage',
        requirements:
          'Hospital groups, insurance providers, or MOH-affiliated bodies actively seeking HealthTech pilot partners. Must have procurement authority or a clear referral pathway to decision-makers.',
      },
      {
        role: 'Startup/Company',
        count: 4,
        relationshipType: 'participant_orchestration',
        requirements:
          'HealthTech startups with working prototypes or early clinical data. Primary target customer must be hospital, insurance, or government.',
      },
    ],
    createdBy: 'user-007',
  },
]

// ─── Ecosystem links — 4 confirmed links, every one with an outcomeScore ─────

const LINKS = [
  {
    id: 'link-001',
    sourceUserId: 'user-009',
    targetUserId: 'user-002',
    contextId: 'context-002',
    contextName: 'HealthTech Demo Day KL',
    contextType: 'Event',
    field: 'HealthTech',
    sourceType: 'Mentor',
    targetType: 'Company',
    relationshipType: 'mentor_match',
    assignedRole: 'Mentor',
    aiReason:
      "Mei Lin's proven GTM and fundraising expertise across two HealthTech exits aligns precisely with Ahmad Razif's need to navigate hospital procurement and prepare for a Series A raise. Her Cradle alumni network adds immediate value for investor introductions.",
    confidence: 91,
    riskFlags: [],
    status: 'completed',
    outcomeScore: 91,
    feedbackSummary:
      'Excellent match. Mei Lin connected Ahmad directly with two Cradle co-investors and helped refine the MOH regulatory submission strategy.',
    reusableTags: ['HealthTech', 'MOH', 'Clinical Validation', 'Fundraising', 'Cradle Network'],
    createdFromInviteId: 'invite-seed-001',
    createdAt: date('2026-03-15'),
    updatedAt: date('2026-04-28'),
  },
  {
    id: 'link-002',
    sourceUserId: 'user-006',
    targetUserId: 'user-001',
    contextId: 'context-001',
    contextName: 'Tech Summit KL 2026',
    contextType: 'Event',
    field: 'FinTech',
    sourceType: 'Partner',
    targetType: 'Company',
    relationshipType: 'partner_linkage',
    assignedRole: 'Partner',
    aiReason:
      "David Tan's active FinTech portfolio and Cradle co-investment history make him the strongest partner anchor for GreenPay's upcoming Series A. Previous co-investment track record reduces onboarding friction significantly.",
    confidence: 88,
    riskFlags: [],
    status: 'active',
    outcomeScore: 88,
    feedbackSummary:
      'Strong fit. David opened two LP introductions for GreenPay and is tracking towards a term sheet within the quarter.',
    reusableTags: ['FinTech', 'Investment', 'Series A', 'Cradle Network', 'Angel Networks'],
    createdFromInviteId: 'invite-seed-002',
    createdAt: date('2026-04-25'),
    updatedAt: date('2026-05-10'),
  },
  {
    id: 'link-003',
    sourceUserId: 'user-007',
    targetUserId: 'user-003',
    contextId: 'context-001',
    contextName: 'Tech Summit KL 2026',
    contextType: 'Event',
    field: 'FinTech',
    sourceType: 'ProgrammeAdmin',
    targetType: 'Company',
    relationshipType: 'programme_fit',
    assignedRole: 'Programme Admin',
    aiReason:
      "Siti Aminah's MDEC grant administration remit includes agri-supply chain digitisation. FarmLink's B2B model and existing corporate buyer relationships position them as a strong GAIN programme candidate.",
    confidence: 76,
    riskFlags: [
      'Sector adjacency — AgriTech in FinTech context; relevance depends on digital payments integration angle',
    ],
    status: 'completed',
    outcomeScore: 76,
    feedbackSummary:
      'Adequate fit. FarmLink was referred to the MDEC GAIN programme and completed onboarding. Digital payments integration angle validated the cross-sector placement.',
    reusableTags: ['AgriTech', 'Government', 'Grant', 'MDEC', 'GAIN Programme'],
    createdFromInviteId: 'invite-seed-003',
    createdAt: date('2026-04-02'),
    updatedAt: date('2026-05-01'),
  },
  {
    id: 'link-004',
    sourceUserId: 'user-009',
    targetUserId: 'user-005',
    contextId: 'context-002',
    contextName: 'HealthTech Demo Day KL',
    contextType: 'Event',
    field: 'HealthTech',
    sourceType: 'Mentor',
    targetType: 'Company',
    relationshipType: 'mentor_match',
    assignedRole: 'Mentor',
    aiReason:
      "Mei Lin's experience with B2G sales cycles and government procurement is directly applicable to LearnPath's MOE pilot expansion strategy. Her regional expansion playbook can accelerate LearnPath's path to national scale.",
    confidence: 82,
    riskFlags: [
      'EdTech in HealthTech context — B2G procurement pattern transferable but sector knowledge gap exists',
    ],
    status: 'active',
    outcomeScore: 82,
    feedbackSummary:
      'Good match. Mei Lin helped LearnPath refine their MOE pitch deck and introduced them to two state education department contacts.',
    reusableTags: ['EdTech', 'GTM', 'B2G', 'Government Procurement', 'MOE'],
    createdFromInviteId: 'invite-seed-004',
    createdAt: date('2026-05-05'),
    updatedAt: date('2026-05-12'),
  },
]

async function main() {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST
  console.log(
    `Seeding project "${PROJECT_ID}" — ${
      emulatorHost ? `emulator @ ${emulatorHost}` : 'LIVE Firestore'
    }`,
  )

  const batch = db.batch()

  for (const user of USERS) {
    batch.set(db.collection('users').doc(user.id), {
      ...user,
      onboardingComplete: true,
      createdAt: now,
      updatedAt: now,
    })
  }

  for (const context of CONTEXTS) {
    batch.set(db.collection('ecosystemContexts').doc(context.id), {
      ...context,
      createdAt: now,
      updatedAt: now,
    })
  }

  for (const link of LINKS) {
    batch.set(db.collection('ecosystemLinks').doc(link.id), link)
  }

  await batch.commit()

  console.log(`✓ Seeded ${USERS.length} users (no permanent role field).`)
  console.log(`✓ Seeded ${CONTEXTS.length} ecosystem contexts.`)
  console.log(
    `✓ Seeded ${LINKS.length} ecosystem links (all with outcomeScore).`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
