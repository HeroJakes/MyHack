/**
 * onCall: the AI match engine.
 *
 * 1. Reads the event, all users and existing invites (parallel reads).
 * 2. Rule pre-filter — scores every candidate (field overlap, profile
 *    completeness and per-need keyword hints), drops the organizer and
 *    already-invited people, and keeps the strongest 30 for Gemini.
 * 3. Gemini ranks the shortlist, enforcing per-role slot quotas.
 * 4. A post-parse validator checks quotas, separates bonus candidates and
 *    ranks the result. On any Gemini failure it returns rule-based fallbacks.
 * 5. Persists the suggestions under `suggestions/{contextId}/participants`
 *    and always returns a structured GenerateParticipantsResult.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { buildParticipantPrompt } from './buildParticipantPrompt';
import type { PromptCandidate } from './buildParticipantPrompt';
import { callGemini } from './callGemini';
import type {
  Event,
  GenerateParticipantsResult,
  ParticipantSuggestion,
  RelationshipNeed,
  RelationshipRole,
  RelationshipType,
  User,
} from './types';

const REGION = 'asia-southeast1';

/** Largest shortlist sent to Gemini after the rule pre-filter. */
const MAX_CANDIDATES = 30;
/** Profiles at or above this completeness get a pre-filter boost. */
const COMPLETENESS_FLOOR = 40;
/** Bonus candidates allowed beyond the required slot quotas. */
const MAX_BONUS = 2;
/** Minimum confidence for a bonus candidate to survive validation. */
const BONUS_MIN_CONFIDENCE = 60;
/** Confidence assigned to every rule-based backfill candidate. */
const BACKFILL_CONFIDENCE = 45;
/** riskFlag stamped on every rule-based backfill candidate. */
const BACKFILL_RISK_FLAG =
  'Added by rule-based backfill — review before sending invite';

/** Default relationshipType per role — used by the rule-based backfill. */
const ROLE_TO_RELATIONSHIP: Record<RelationshipRole, RelationshipType> = {
  Mentor: 'mentor_match',
  Partner: 'partner_linkage',
  'Service Provider': 'service_support',
  'Startup/Company': 'programme_fit',
  'Programme Admin': 'participant_orchestration',
};

type QuotaSummary = GenerateParticipantsResult['quotaSummary'];

/** A Gemini participant normalized into known-typed fields. */
interface NormalizedSuggestion {
  userId: string;
  suggestedRole: RelationshipRole;
  relationshipType: RelationshipType;
  reason: string;
  confidence: number;
  riskFlags: string[];
  suggestedNextAction: string;
  bonus: boolean;
}

/** Splits the event field into lowercase tokens used for the pre-filter. */
function tokenize(field: string): string[] {
  return field
    .toLowerCase()
    .split(/[\s/,&]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

/**
 * Token-efficient candidate summary: the cached `geminiSummary` when present,
 * otherwise a one-line string built from the user's existing fields.
 */
function buildUserSummary(user: User): string {
  const cached = user.geminiSummary?.trim();
  if (cached) return cached;
  const sectors = (user.inferredSector ?? []).join(', ');
  const expertise = (user.inferredExpertise ?? []).join(', ');
  return `${user.name} | ${user.headline} | ${sectors} | ${expertise} | ${user.inferredStage} | completeness:${user.profileCompleteness}`;
}

/**
 * Per-need keyword scoring: +2 for each keyword token found on the candidate,
 * capped at +10 per need. Needs without keywords contribute 0.
 */
function keywordScore(user: User, needs: RelationshipNeed[]): number {
  const haystack = [
    ...(user.inferredSector ?? []),
    ...(user.inferredExpertise ?? []),
    user.headline ?? '',
    user.geminiSummary ?? '',
  ]
    .join(' ')
    .toLowerCase();

  let total = 0;
  for (const need of needs) {
    const keywords = Array.isArray(need.keywords) ? need.keywords : [];
    if (keywords.length === 0) continue;
    const tokens = keywords
      .flatMap((k) => String(k).toLowerCase().split(/[\s,]+/))
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    let needScore = 0;
    for (const token of tokens) {
      if (haystack.includes(token)) needScore += 2;
    }
    total += Math.min(needScore, 10);
  }
  return total;
}

/**
 * Rule pre-filter: removes the organizer and already-invited people, scores
 * the rest (field overlap + completeness + keyword hints) and returns the
 * strongest MAX_CANDIDATES. Falls back to the full scored pool if the overlap
 * filter would otherwise leave nobody.
 */
function prefilterCandidates(
  users: User[],
  event: Event,
  needs: RelationshipNeed[],
  invitedUserIds: Set<string>,
): User[] {
  const tokens = tokenize(event.field ?? '');

  const scored = users
    .filter((u) => u.id !== event.createdBy && !invitedUserIds.has(u.id))
    .map((u) => {
      const haystack = [
        ...(u.inferredSector ?? []),
        ...(u.inferredExpertise ?? []),
      ]
        .join(' ')
        .toLowerCase();

      // Sector / expertise overlap with the event field.
      let score = tokens.reduce(
        (acc, t) => (haystack.includes(t) ? acc + 3 : acc),
        0,
      );
      const overlap = score > 0;

      // Prefer reasonably complete profiles.
      if ((u.profileCompleteness ?? 0) >= COMPLETENESS_FLOOR) score += 2;

      // Per-need keyword hints (added on top of overlap scoring).
      score += keywordScore(u, needs);

      return { user: u, score, overlap };
    });

  // Keep candidates that overlap the field; fall back to the full pool when
  // the overlap filter is too aggressive (preserves the original behaviour).
  const overlapping = scored.filter((s) => s.overlap);
  const pool = overlapping.length > 0 ? overlapping : scored;

  return pool
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES)
    .map((s) => s.user);
}

/** Clamps an unknown confidence value to an integer in the 0-100 range. */
function clampConfidence(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Coerces one raw Gemini participant into a typed NormalizedSuggestion. */
function normalizeSuggestion(raw: unknown): NormalizedSuggestion {
  const p = (raw ?? {}) as Record<string, unknown>;
  return {
    userId: String(p.userId ?? ''),
    suggestedRole: p.suggestedRole as RelationshipRole,
    relationshipType: p.relationshipType as RelationshipType,
    reason: String(p.reason ?? ''),
    confidence: clampConfidence(p.confidence),
    riskFlags: Array.isArray(p.riskFlags)
      ? p.riskFlags.map((r: unknown) => String(r))
      : [],
    suggestedNextAction: String(p.suggestedNextAction ?? 'Review candidate'),
    bonus: p.bonus === true,
  };
}

/** Builds a persisted ParticipantSuggestion from a normalized Gemini result. */
function toSuggestion(
  s: NormalizedSuggestion,
  userMap: Map<string, User>,
  contextId: string,
  rank: number,
  generatedAt: Timestamp,
): ParticipantSuggestion {
  const matched = userMap.get(s.userId);
  return {
    id: `${contextId}_${s.userId}`,
    userId: s.userId,
    name: matched?.name ?? '',
    photoURL: matched?.photoURL ?? '',
    headline: matched?.headline ?? '',
    suggestedRole: s.suggestedRole,
    relationshipType: s.relationshipType,
    reason: s.reason,
    confidence: s.confidence,
    riskFlags: s.riskFlags,
    suggestedNextAction: s.suggestedNextAction,
    rank,
    bonus: s.bonus,
    generatedAt,
  };
}

/**
 * Post-parse slot validator: drops unknown userIds, enforces per-role quotas,
 * separates and caps bonus candidates, ranks the result and reports warnings
 * for any underfilled quota.
 */
function validateAndRank(
  rawParticipants: unknown[],
  needs: RelationshipNeed[],
  candidateIds: Set<string>,
  userMap: Map<string, User>,
  contextId: string,
  generatedAt: Timestamp,
): GenerateParticipantsResult {
  // 1. Normalize + drop userIds that were never in the candidate list.
  const normalized = rawParticipants
    .map(normalizeSuggestion)
    .filter((s) => s.userId !== '' && candidateIds.has(s.userId));

  // 4-5. Separate bonus candidates; keep confidence >= 60, at most MAX_BONUS.
  const required = normalized.filter((s) => !s.bonus);
  const bonus = normalized
    .filter((s) => s.bonus && s.confidence >= BONUS_MIN_CONFIDENCE)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_BONUS);

  // 2-3. quotaSummary — filled = required candidates matching each need's role.
  const quotaSummary: QuotaSummary = needs.map((need) => ({
    role: need.role,
    relationshipType: need.relationshipType,
    needed: need.count,
    filled: required.filter((s) => s.suggestedRole === need.role).length,
  }));

  // 6. Warn for every underfilled quota.
  const warnings: string[] = [];
  for (const quota of quotaSummary) {
    if (quota.filled < quota.needed) {
      warnings.push(
        `Only ${quota.filled} of ${quota.needed} ${quota.role} candidates ` +
          `could be found. Consider broadening requirements.`,
      );
    }
  }

  // 7. Order required candidates by role group, confidence desc within group.
  const ordered: NormalizedSuggestion[] = [];
  const placed = new Set<NormalizedSuggestion>();
  for (const need of needs) {
    required
      .filter((s) => s.suggestedRole === need.role && !placed.has(s))
      .sort((a, b) => b.confidence - a.confidence)
      .forEach((s) => {
        placed.add(s);
        ordered.push(s);
      });
  }
  // Required candidates whose role matched no quota still ship, after the rest.
  required
    .filter((s) => !placed.has(s))
    .sort((a, b) => b.confidence - a.confidence)
    .forEach((s) => ordered.push(s));

  // 8. Rank required candidates from 1, then append bonus candidates.
  let rank = 1;
  const suggestions: ParticipantSuggestion[] = [
    ...ordered.map((s) =>
      toSuggestion(s, userMap, contextId, rank++, generatedAt),
    ),
    ...bonus.map((s) => toSuggestion(s, userMap, contextId, rank++, generatedAt)),
  ];

  // success is always true here; warnings carry any partial-fill feedback.
  return {
    success: true,
    suggestions,
    quotaSummary,
    warnings,
    fallback: false,
  };
}

/**
 * Rule-based fallback used when Gemini is unavailable. Distributes the top
 * pre-filter candidates across the role quotas and flags them for review.
 */
function buildFallbackResult(
  contextId: string,
  needs: RelationshipNeed[],
  prefiltered: User[],
  generatedAt: Timestamp,
): GenerateParticipantsResult {
  const suggestions: ParticipantSuggestion[] = [];
  const quotaSummary: QuotaSummary = [];
  let cursor = 0;
  let rank = 1;

  for (const need of needs) {
    const count = Math.max(0, need.count);
    let filled = 0;
    for (let i = 0; i < count && cursor < prefiltered.length; i += 1) {
      const user = prefiltered[cursor];
      cursor += 1;
      suggestions.push({
        id: `${contextId}_${user.id}`,
        userId: user.id,
        name: user.name,
        photoURL: user.photoURL,
        headline: user.headline,
        suggestedRole: need.role,
        relationshipType: need.relationshipType,
        reason: 'Rule-based fallback — AI matching was unavailable.',
        confidence: 50,
        riskFlags: ['AI scoring unavailable — manual review recommended'],
        suggestedNextAction: 'Review candidate',
        rank,
        bonus: false,
        generatedAt,
      });
      rank += 1;
      filled += 1;
    }
    quotaSummary.push({
      role: need.role,
      relationshipType: need.relationshipType,
      needed: need.count,
      filled,
    });
  }

  return {
    success: false,
    suggestions,
    quotaSummary,
    warnings: [
      'AI matching failed. These are rule-based fallback candidates. ' +
        'Review carefully before sending invites.',
    ],
    error: 'AI matching failed after retry. Showing rule-based candidates.',
    fallback: true,
  };
}

/**
 * Last-resort result used only when the quota validator itself throws — ships
 * the raw Gemini suggestions with an explanatory warning so the function can
 * still return something to the client.
 */
function buildRawResult(
  rawParticipants: unknown[],
  needs: RelationshipNeed[],
  userMap: Map<string, User>,
  contextId: string,
  generatedAt: Timestamp,
): GenerateParticipantsResult {
  let rank = 1;
  const suggestions = rawParticipants
    .map(normalizeSuggestion)
    .filter((s) => s.userId !== '')
    .map((s) => toSuggestion(s, userMap, contextId, rank++, generatedAt));

  const quotaSummary: QuotaSummary = needs.map((need) => ({
    role: need.role,
    relationshipType: need.relationshipType,
    needed: need.count,
    filled: suggestions.filter((s) => s.suggestedRole === need.role).length,
  }));

  return {
    success: true,
    suggestions,
    quotaSummary,
    warnings: ['Quota validation failed — results may be incomplete.'],
    fallback: false,
  };
}

/**
 * Quota adjustment pass — runs after the validator, before the Firestore
 * write. Backfills underfilled slots with the strongest unused pre-filter
 * candidates so the total always meets the quota, then trims any required
 * over-fill back down to the quota. Re-ranks the result and refreshes the
 * quota summary. Pure data transform — no I/O, no re-query.
 */
function applyQuotaAdjustments(
  result: GenerateParticipantsResult,
  needs: RelationshipNeed[],
  prefiltered: User[],
  contextId: string,
  generatedAt: Timestamp,
): GenerateParticipantsResult {
  const totalNeeded = needs.reduce((sum, n) => sum + Math.max(0, n.count), 0);
  // No quotas means there is nothing to backfill or trim.
  if (totalNeeded <= 0) return result;

  const geminiRequired = result.suggestions.filter((s) => s.bonus !== true);
  const bonus = result.suggestions.filter((s) => s.bonus === true);
  const warnings = [...result.warnings];

  // Mutable quota counters, used to pick the neediest slot during backfill.
  const quota: QuotaSummary = result.quotaSummary.map((q) => ({ ...q }));

  // ---- FIX 2: backfill underfilled slots from spare pre-filter people ----
  const backfill: ParticipantSuggestion[] = [];
  const totalFilled = geminiRequired.length;
  if (totalFilled < totalNeeded) {
    const gap = totalNeeded - totalFilled;
    const usedIds = new Set(result.suggestions.map((s) => s.userId));
    // `prefiltered` is already ordered by pre-filter score (highest first).
    const spare = prefiltered
      .filter((u) => !usedIds.has(u.id))
      .slice(0, gap);

    const backfilledRoles = new Set<string>();
    for (const user of spare) {
      // Pick the most underfilled slot (largest needed - filled).
      let target: QuotaSummary[number] | null = null;
      for (const q of quota) {
        if (q.needed - q.filled <= 0) continue;
        if (
          target === null ||
          q.needed - q.filled > target.needed - target.filled
        ) {
          target = q;
        }
      }
      if (target === null) break; // every slot is already full

      const role = target.role as RelationshipRole;
      const relationshipType: RelationshipType =
        ROLE_TO_RELATIONSHIP[role] ??
        (target.relationshipType as RelationshipType);

      backfill.push({
        id: `${contextId}_${user.id}`,
        userId: user.id,
        name: user.name,
        photoURL: user.photoURL,
        headline: user.headline,
        suggestedRole: role,
        relationshipType,
        reason:
          'Rule-based backfill — added to satisfy slot quota. AI matching ' +
          'did not return enough candidates for this role.',
        confidence: BACKFILL_CONFIDENCE,
        riskFlags: [BACKFILL_RISK_FLAG],
        suggestedNextAction: 'Review candidate',
        rank: 0, // re-ranked below
        bonus: false,
        generatedAt,
      });
      target.filled += 1;
      backfilledRoles.add(target.role);
    }

    // One warning per role slot that received a backfill candidate.
    for (const role of backfilledRoles) {
      warnings.push(
        `Slot for ${role} was partially filled by rule-based backfill. ` +
          `Review these candidates carefully.`,
      );
    }
  }

  // ---- FIX 3: over-fill guard — trim required back down to the quota -----
  let keptGemini = geminiRequired;
  let keptBackfill = backfill;
  let keptBonus = bonus;
  if (geminiRequired.length + backfill.length > totalNeeded) {
    // Bonus candidates are trimmed before any required candidate.
    keptBonus = [];
    // Trim required to the quota, dropping the lowest-confidence first and
    // never going below totalNeeded.
    const rankedRequired = [...geminiRequired, ...backfill].sort(
      (a, b) => b.confidence - a.confidence,
    );
    const keptIds = new Set(
      rankedRequired.slice(0, totalNeeded).map((s) => s.id),
    );
    keptGemini = geminiRequired.filter((s) => keptIds.has(s.id));
    keptBackfill = backfill.filter((s) => keptIds.has(s.id));
  }

  // ---- Re-rank: Gemini required, then backfill, then bonus --------------
  let rank = 1;
  const suggestions: ParticipantSuggestion[] = [
    ...[...keptGemini].sort((a, b) => b.confidence - a.confidence),
    ...keptBackfill,
    ...keptBonus,
  ].map((s) => ({ ...s, rank: rank++ }));

  // Refresh quota.filled to include backfill (and reflect any over-fill trim).
  const finalRequired = suggestions.filter((s) => s.bonus !== true);
  const quotaSummary: QuotaSummary = result.quotaSummary.map((q) => ({
    role: q.role,
    relationshipType: q.relationshipType,
    needed: q.needed,
    filled: finalRequired.filter((s) => s.suggestedRole === q.role).length,
  }));

  return { ...result, suggestions, quotaSummary, warnings };
}

/** Batch-writes the suggestions plus a summary doc on the context. */
async function persistSuggestions(
  db: Firestore,
  contextId: string,
  contextName: string,
  suggestions: ParticipantSuggestion[],
  generatedAt: Timestamp,
): Promise<void> {
  const batch = db.batch();
  const contextRef = db.collection('suggestions').doc(contextId);
  const participantsCol = contextRef.collection('participants');
  suggestions.forEach((s) => batch.set(participantsCol.doc(s.id), s));
  batch.set(
    contextRef,
    {
      contextId,
      contextName,
      count: suggestions.length,
      generatedAt,
    },
    { merge: true },
  );
  await batch.commit();
}

export const generateParticipants = onCall(
  { region: REGION, secrets: ['GEMINI_API_KEY'] },
  async (request): Promise<GenerateParticipantsResult> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.');
    }
    const uid = request.auth.uid;

    const contextId: unknown = request.data?.contextId ?? request.data?.eventId;
    if (!contextId || typeof contextId !== 'string') {
      throw new HttpsError('invalid-argument', 'A "contextId" string is required.');
    }

    const db = getFirestore();

    // Independent reads run in parallel.
    const [eventSnap, usersSnap, invitesSnap] = await Promise.all([
      db.collection('events').doc(contextId).get(),
      db.collection('users').get(),
      db.collection('invites').where('contextId', '==', contextId).get(),
    ]);

    // A context can live in `events` (createEvent) or `ecosystemContexts`
    // (createContext). Fall back to ecosystemContexts when `events` has no
    // matching document, and use whichever collection holds the context.
    let contextSnap = eventSnap;
    if (!contextSnap.exists) {
      contextSnap = await db
        .collection('ecosystemContexts')
        .doc(contextId)
        .get();
    }
    if (!contextSnap.exists) {
      throw new HttpsError('not-found', `Event ${contextId} was not found.`);
    }
    const event = { id: contextSnap.id, ...contextSnap.data() } as Event;
    if (event.createdBy !== uid) {
      throw new HttpsError(
        'permission-denied',
        'Only the organizer can generate participants for this context.',
      );
    }

    const allUsers = usersSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as User,
    );
    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const needs: RelationshipNeed[] = event.roleRequirements ?? [];
    const invitedUserIds = new Set(
      invitesSnap.docs.map((d) => String(d.data().invitedUserId ?? '')),
    );

    // Rule pre-filter: scored shortlist, organizer + invitees removed.
    const candidates = prefilterCandidates(allUsers, event, needs, invitedUserIds);
    const candidateIds = new Set(candidates.map((c) => c.id));

    // Token-efficient candidate list — summary strings only, never raw users.
    const promptCandidates: PromptCandidate[] = candidates.map((c) => ({
      id: c.id,
      summary: buildUserSummary(c),
    }));

    const generatedAt = Timestamp.now();

    // Call Gemini; any failure (including a malformed retry) falls back to
    // rule-based candidates rather than throwing to the client.
    let participants: unknown[];
    try {
      const prompt = buildParticipantPrompt(event, needs, promptCandidates);
      const parsed = await callGemini(prompt);
      if (!parsed || !Array.isArray(parsed.participants)) {
        throw new Error('Unexpected Gemini response shape for participants');
      }
      participants = parsed.participants;
    } catch (err) {
      console.error('generateParticipants: Gemini matching failed', err);
      const fallback = buildFallbackResult(
        contextId,
        needs,
        candidates,
        generatedAt,
      );
      await persistSuggestions(
        db,
        contextId,
        event.name,
        fallback.suggestions,
        generatedAt,
      );
      return fallback;
    }

    // Quota validation must never block the function from returning.
    let result: GenerateParticipantsResult;
    try {
      result = validateAndRank(
        participants,
        needs,
        candidateIds,
        userMap,
        contextId,
        generatedAt,
      );
    } catch (err) {
      console.error('generateParticipants: quota validation failed', err);
      result = buildRawResult(
        participants,
        needs,
        userMap,
        contextId,
        generatedAt,
      );
    }

    // Backfill underfilled slots, then guard against over-fill. Wrapped so a
    // failure here can never block the function from returning.
    try {
      result = applyQuotaAdjustments(
        result,
        needs,
        candidates,
        contextId,
        generatedAt,
      );
    } catch (err) {
      console.error('generateParticipants: backfill failed', err);
      result = {
        ...result,
        warnings: [
          ...result.warnings,
          'Backfill failed — some slots may be empty.',
        ],
      };
    }

    await persistSuggestions(
      db,
      contextId,
      event.name,
      result.suggestions,
      generatedAt,
    );
    return result;
  },
);
