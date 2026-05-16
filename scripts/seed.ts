/**
 * Seed script — populates `users` and `ecosystemLinks` with demo data.
 *
 * Run:  npm run seed
 *
 * Targets the Firestore emulator when FIRESTORE_EMULATOR_HOST is set
 * (e.g. "127.0.0.1:8080"); otherwise the live project, which needs
 * application-default credentials (GOOGLE_APPLICATION_CREDENTIALS).
 *
 * Demo data is derived from `src/lib/demoEcosystemLinks.ts` so the seeded
 * documents match the established demo set. Links are written in their real
 * stored shape (actor ids only) — actor names/roles live on `users`, which
 * `useEcosystemLinks` joins back in at read time.
 */
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { MOCK_LINKS } from '../src/lib/demoEcosystemLinks'

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'myhack-c753f'

initializeApp({ projectId: PROJECT_ID })
const db = getFirestore()

async function main() {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST
  console.log(
    `Seeding project "${PROJECT_ID}" — ${
      emulatorHost ? `emulator @ ${emulatorHost}` : 'LIVE Firestore'
    }`,
  )

  const now = Timestamp.now()

  // Collect every unique actor referenced by the demo links.
  const actors = new Map<string, { name: string; role: string }>()
  for (const link of MOCK_LINKS) {
    if (!actors.has(link.sourceUserId)) {
      actors.set(link.sourceUserId, {
        name: link.sourceUserName,
        role: link.sourceUserRole,
      })
    }
    if (!actors.has(link.targetUserId)) {
      actors.set(link.targetUserId, {
        name: link.targetUserName,
        role: link.targetUserRole,
      })
    }
  }

  const batch = db.batch()

  for (const [id, actor] of actors) {
    batch.set(db.collection('users').doc(id), {
      name: actor.name,
      email: `${id}@demo.poyolink.app`,
      photoURL: '',
      headline: actor.role,
      inferredSector: [],
      inferredExpertise: [],
      inferredStage: 'seed',
      contributionSignals: [],
      bio: `${actor.name} — ${actor.role}. Demo seed profile.`,
      profileCompleteness: 80,
      onboardingComplete: true,
      createdAt: now,
      updatedAt: now,
    })
  }

  for (const link of MOCK_LINKS) {
    batch.set(db.collection('ecosystemLinks').doc(link.id), {
      sourceUserId: link.sourceUserId,
      targetUserId: link.targetUserId,
      contextId: link.contextId,
      contextName: link.contextName,
      contextType: link.contextType,
      field: link.field,
      sourceType: link.sourceType,
      targetType: link.targetType,
      relationshipType: link.relationshipType,
      assignedRole: link.assignedRole,
      aiReason: link.aiReason,
      confidence: link.confidence,
      riskFlags: link.riskFlags,
      status: link.status,
      reusableTags: link.reusableTags,
      createdFromInviteId: link.createdFromInviteId,
      createdAt: Timestamp.fromDate(link.createdAt),
      updatedAt: Timestamp.fromDate(link.updatedAt),
      ...(typeof link.outcomeScore === 'number'
        ? { outcomeScore: link.outcomeScore }
        : {}),
      ...(link.feedbackSummary ? { feedbackSummary: link.feedbackSummary } : {}),
    })
  }

  await batch.commit()
  console.log(
    `✓ Seeded ${actors.size} users and ${MOCK_LINKS.length} ecosystem links.`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
