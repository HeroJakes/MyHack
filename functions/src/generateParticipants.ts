/**
 * onCall: the AI match engine.
 *
 * 1. Reads the context, all users, this context's invites and previous
 *    ecosystem links in the same field (independent reads run in parallel).
 * 2. Pre-filters + scores candidates — drops the organizer and already-invited
 *    users, then ranks by profile fit AND past link outcomeScores, keeping the
 *    top 30 so Gemini ranks a focused, history-aware shortlist.
 * 3. Gemini ranks the shortlist into ParticipantSuggestion[]; invented userIds
 *    are dropped by a code-level hallucination guard.
 * 4. Persists the suggestions under `suggestions/{contextId}/participants`.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { buildParticipantPrompt } from './buildParticipantPrompt';
import { callGemini, getGeminiModelName } from './callGemini';
import type {
  EcosystemLink,
  Event,
  Invite,
  ParticipantSuggestion,
  RelationshipNeed,
  User,
} from './types';

const REGION = 'asia-southeast1';
const AI_TIMEOUT_MS = 90_000;
const MAX_AI_CANDIDATES = 15;
const PARTICIPANT_RESPONSE_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
  required: ['participants'],
  properties: {
    participants: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'userId',
          'suggestedRole',
          'relationshipType',
          'reason',
          'confidence',
          'riskFlags',
          'suggestedNextAction',
          'rank',
        ],
        properties: {
          userId: { type: 'string' },
          suggestedRole: { type: 'string' },
          relationshipType: { type: 'string' },
          reason: { type: 'string' },
          confidence: { type: 'integer', minimum: 0, maximum: 100 },
          riskFlags: { type: 'array', items: { type: 'string' } },
          suggestedNextAction: { type: 'string' },
          rank: { type: 'integer', minimum: 1 },
        },
      },
    },
  },
};

/** Splits the event field into lowercase tokens used for the pre-filter. */
function tokenize(field: string): string[] {
  return field
    .toLowerCase()
    .split(/[\s/,&]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeout = setTimeout(
      () =>
        reject(
          new HttpsError(
            'deadline-exceeded',
            'Gemini participant generation timed out.',
          ),
        ),
      ms,
    );
  });
  return Promise.race([promise, timeoutPromise]).finally(() =>
    clearTimeout(timeout),
  );
}

function scoreCandidate(user: User, tokens: string[]): number {
  const haystack = [
    user.headline,
    user.bio,
    ...(user.inferredSector ?? []),
    ...(user.inferredExpertise ?? []),
    ...(user.contributionSignals ?? []),
  ]
    .join(' ')
    .toLowerCase();
  const matches = tokens.filter((token) => haystack.includes(token)).length;
  return matches * 20 + Number(user.profileCompleteness ?? 0);
}

function fallbackConfidence(user: User, tokens: string[]): number {
  const haystack = [
    user.headline,
    user.bio,
    ...(user.inferredSector ?? []),
    ...(user.inferredExpertise ?? []),
    ...(user.contributionSignals ?? []),
  ]
    .join(' ')
    .toLowerCase();
  const matches = tokens.filter((token) => haystack.includes(token)).length;
  const profileCompleteness = Math.max(
    0,
    Math.min(100, Number(user.profileCompleteness ?? 0)),
  );
  const signalCount = [
    ...(user.inferredSector ?? []),
    ...(user.inferredExpertise ?? []),
    ...(user.contributionSignals ?? []),
  ].filter(Boolean).length;
  const tokenScore =
    tokens.length === 0 ? 18 : Math.round((matches / tokens.length) * 34);
  const profileScore = Math.round(profileCompleteness * 0.28);
  const signalScore = Math.min(18, signalCount * 3);
  return Math.max(25, Math.min(74, 20 + tokenScore + profileScore + signalScore));
}

function normalizeParticipantsPayload(parsed: any): any[] {
  if (Array.isArray(parsed?.participants)) return parsed.participants;
  if (Array.isArray(parsed?.recommendations)) return parsed.recommendations;
  if (Array.isArray(parsed?.candidates)) return parsed.candidates;
  if (Array.isArray(parsed)) return parsed;
  throw new HttpsError(
    'internal',
    'Unexpected Gemini response shape for participants',
  );
}

function normalizeConfidence(value: unknown): number {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) {
    throw new HttpsError(
      'internal',
      'Gemini returned a participant without a numeric confidence score.',
    );
  }
  return Math.max(0, Math.min(100, Math.round(confidence)));
}

/**
 * History-aware candidate score: profile completeness + sector/expertise
 * overlap + a boost from the average outcomeScore of the candidate's past
 * ecosystem links. This is what makes the relationship graph an INPUT to
 * matching, not just an output.
 */
function historyAwareScore(
  user: User,
  field: string,
  needs: RelationshipNeed[],
  previousLinks: EcosystemLink[],
): number {
  let score = user.profileCompleteness ?? 0;

  const fieldLower = field.toLowerCase();
  const sectorHit = user.inferredSector?.some((s) =>
    fieldLower.includes(s.toLowerCase()),
  );
  if (sectorHit) score += 20;

  const expertiseHit = user.inferredExpertise?.some((e) =>
    needs.some((n) => n.requirements.toLowerCase().includes(e.toLowerCase())),
  );
  if (expertiseHit) score += 15;

  const pastLinks = previousLinks.filter(
    (l) =>
      (l.sourceUserId === user.id || l.targetUserId === user.id) &&
      l.outcomeScore != null,
  );
  if (pastLinks.length > 0) {
    const avg =
      pastLinks.reduce((sum, l) => sum + (l.outcomeScore ?? 0), 0) /
      pastLinks.length;
    score += avg * 0.3;
  }

  return score;
}

function matchingSignals(user: User, tokens: string[]): string[] {
  const signals = [
    ...(user.inferredSector ?? []),
    ...(user.inferredExpertise ?? []),
    ...(user.contributionSignals ?? []),
  ];
  const seen = new Set<string>();
  const haystackBySignal = signals.map((signal) => ({
    signal,
    text: signal.toLowerCase(),
  }));

  for (const token of tokens) {
    for (const { signal, text } of haystackBySignal) {
      if (text.includes(token) && !seen.has(signal)) {
        seen.add(signal);
      }
    }
  }

  if (seen.size === 0) {
    for (const signal of signals) {
      if (signal && !seen.has(signal)) seen.add(signal);
      if (seen.size >= 3) break;
    }
  }

  return [...seen].slice(0, 3);
}

function fallbackReason(user: User, need: RelationshipNeed, tokens: string[]) {
  const signals = matchingSignals(user, tokens);
  const matchedTokens = tokens.filter((token) =>
    [
      user.headline,
      user.bio,
      ...(user.inferredSector ?? []),
      ...(user.inferredExpertise ?? []),
      ...(user.contributionSignals ?? []),
    ]
      .join(' ')
      .toLowerCase()
      .includes(token),
  );
  const signalText =
    signals.length > 0
      ? signals.join(', ')
      : user.headline || 'their profile background';
  const requirement = need.requirements?.trim();
  const requirementText = requirement
    ? ` and fits the need for ${requirement.charAt(0).toLowerCase()}${requirement.slice(1)}`
    : '';
  const matchText =
    matchedTokens.length > 0
      ? ` The match is tied to ${matchedTokens.slice(0, 3).join(', ')}.`
      : '';

  return `${user.name} is recommended for the ${need.role} role because their profile shows ${signalText}${requirementText}.${matchText}`;
}

function fallbackNextAction(need: RelationshipNeed) {
  if (need.role === 'Mentor') return 'Send intro invite';
  if (need.role === 'Service Provider') return 'Send service provider invite';
  if (need.role === 'Programme Admin') return 'Invite to coordinate';
  if (need.role === 'Startup/Company') return 'Invite as participant';
  return 'Send partnership invite';
}

function timestampMillis(value: unknown): number {
  const timestamp = value as { toMillis?: () => number; seconds?: number };
  if (typeof timestamp?.toMillis === 'function') return timestamp.toMillis();
  if (typeof timestamp?.seconds === 'number') return timestamp.seconds * 1000;
  return 0;
}

function fallbackSuggestions(
  contextId: string,
  needs: RelationshipNeed[],
  candidates: User[],
  tokens: string[],
  generatedAt: Timestamp,
): ParticipantSuggestion[] {
  const scored = [...candidates].sort(
    (a, b) => scoreCandidate(b, tokens) - scoreCandidate(a, tokens),
  );
  const fallbackNeeds =
    needs.length > 0
      ? needs
      : [
          {
            role: 'Partner',
            count: Math.min(5, scored.length),
            relationshipType: 'partner_linkage',
            requirements: 'Best available fit for this context.',
          } satisfies RelationshipNeed,
        ];

  const used = new Set<string>();
  const suggestions: ParticipantSuggestion[] = [];

  for (const need of fallbackNeeds) {
    const slots = Math.max(1, Math.round(Number(need.count ?? 1)));
    for (let i = 0; i < slots; i++) {
      const user = scored.find((candidate) => !used.has(candidate.id));
      if (!user) break;
      used.add(user.id);
      const confidence = fallbackConfidence(user, tokens);
      suggestions.push({
        id: `${contextId}_${user.id}`,
        userId: user.id,
        name: user.name ?? '',
        photoURL: user.photoURL ?? '',
        headline: user.headline ?? '',
        suggestedRole: need.role,
        relationshipType: need.relationshipType,
        reason: fallbackReason(user, need, tokens),
        confidence,
        riskFlags: confidence < 55 ? ['Review fit manually'] : [],
        suggestedNextAction: fallbackNextAction(need),
        rank: suggestions.length + 1,
        generatedAt,
        confidenceSource: 'fallback',
        recommendationSource: 'fallback',
      });
    }
  }

  return suggestions;
}

export const generateParticipants = onCall(
  { region: REGION, cors: true, invoker: 'public', timeoutSeconds: 180 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.');
    }
    const uid = request.auth.uid;

    const contextId: unknown = request.data?.contextId ?? request.data?.eventId;
    if (!contextId || typeof contextId !== 'string') {
      throw new HttpsError('invalid-argument', 'A "contextId" string is required.');
    }

    const db = getFirestore();

    // Resolve the context first — it can live in `events` (createEvent) or
    // `ecosystemContexts` (createContext). The ecosystemLinks query below
    // needs the resolved context's `field`.
    let contextSnap = await db.collection('events').doc(contextId).get();
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

    // Independent reads run in parallel: all users, this context's invites,
    // and previous ecosystem links in the same field (the AI feedback loop).
    // Keep the link query index-light; status filtering and sorting happen in
    // memory so recommendation generation still works while Firestore indexes
    // are being created or catching up after deployment.
    const [usersSnap, invitesSnap, linksSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('invites').where('contextId', '==', contextId).get(),
      db
        .collection('ecosystemLinks')
        .where('field', '==', event.field ?? '')
        .limit(100)
        .get(),
    ]);
    const previousLinks: EcosystemLink[] = linksSnap.docs
      .map((d) => d.data() as EcosystemLink)
      .filter((link) => link.status === 'active' || link.status === 'completed')
      .sort(
        (a, b) =>
          timestampMillis(b.createdAt) - timestampMillis(a.createdAt),
      )
      .slice(0, 30);

    const allUsers = usersSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as User,
    );
    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const rawNeeds =
      event.roleRequirements ??
      ((event as unknown as { relationshipNeeds?: RelationshipNeed[] })
        .relationshipNeeds ??
        []);
    const needs = rawNeeds;

    // Pre-filter + history-aware scoring: drop the organizer and anyone
    // already invited, require a usable profile, then rank by the link graph
    // and keep the top 30 candidates.
    const tokens = tokenize(event.field ?? '');
    const invitedUserIds = new Set(
      invitesSnap.docs.map((d) => (d.data() as Invite).invitedUserId),
    );
    const candidates = allUsers
      .filter((u) => u.id !== event.createdBy)
      .filter((u) => !invitedUserIds.has(u.id))
      .filter((u) => (u.profileCompleteness ?? 0) >= 20)
      .map((u) => ({
        user: u,
        score: historyAwareScore(u, event.field ?? '', needs, previousLinks),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map(({ user }) => user);
    const minimumSlots =
      needs.reduce((total, need) => total + Math.max(1, Number(need.count ?? 1)), 0) +
      2;
    const aiCandidates = candidates.slice(
      0,
      Math.max(Math.min(MAX_AI_CANDIDATES, candidates.length), minimumSlots),
    );
    const promptCandidates = aiCandidates.map((u) => ({
      id: u.id,
      summary: [
        u.headline,
        u.bio,
        `Sectors: ${(u.inferredSector ?? []).join(', ') || 'none'}`,
        `Expertise: ${(u.inferredExpertise ?? []).join(', ') || 'none'}`,
        `Signals: ${(u.contributionSignals ?? []).join(', ') || 'none'}`,
        `Stage: ${u.inferredStage ?? 'unknown'}`,
      ]
        .filter(Boolean)
        .join(' | '),
    }));
    console.info(
      `generateParticipants: sending ${promptCandidates.length}/${candidates.length} candidates to Gemini for context ${contextId}.`,
    );

    const generatedAt = Timestamp.now();
    const prompt = buildParticipantPrompt(
      event,
      needs,
      promptCandidates,
      previousLinks,
    );
    let suggestions: ParticipantSuggestion[];
    try {
      const parsed = await withTimeout(
        callGemini(prompt, { responseSchema: PARTICIPANT_RESPONSE_SCHEMA }),
        AI_TIMEOUT_MS,
      );
      const participants = normalizeParticipantsPayload(parsed);

      // Code-level hallucination guard — drop any userId Gemini invented.
      const validUserIds = new Set(aiCandidates.map((u) => u.id));
      const validatedParticipants = participants.filter(
        (p: { userId: string }) => {
          if (!validUserIds.has(p.userId)) {
            console.warn(
              `[generateParticipants] Gemini returned unknown userId: ${p.userId} — dropped`,
            );
            return false;
          }
          return true;
        },
      );

      suggestions = validatedParticipants.map((p: any, idx: number) => {
        const userId = String(p.userId ?? '');
        const matched = userMap.get(userId);
        return {
          id: `${contextId}_${userId || idx}`,
          userId,
          name: matched?.name ?? String(p.name ?? ''),
          photoURL: matched?.photoURL ?? String(p.photoURL ?? ''),
          headline: matched?.headline ?? String(p.headline ?? ''),
          suggestedRole: p.suggestedRole as ParticipantSuggestion['suggestedRole'],
          relationshipType:
            p.relationshipType as ParticipantSuggestion['relationshipType'],
          reason:
            typeof p.reason === 'string' && p.reason.trim()
              ? p.reason.trim()
              : matched
                ? fallbackReason(matched, needs[idx % Math.max(needs.length, 1)] ?? {
                    role: (p.suggestedRole ?? 'Partner') as RelationshipNeed['role'],
                    count: 1,
                    relationshipType:
                      (p.relationshipType ?? 'partner_linkage') as RelationshipNeed['relationshipType'],
                    requirements: '',
                  }, tokens)
                : 'This candidate matches the context needs based on their profile signals.',
          confidence: normalizeConfidence(p.confidence),
          riskFlags: Array.isArray(p.riskFlags)
            ? p.riskFlags.map((r: any) => String(r))
            : [],
          suggestedNextAction:
            typeof p.suggestedNextAction === 'string' &&
            p.suggestedNextAction.trim() &&
            p.suggestedNextAction.trim() !== 'Review candidate'
              ? p.suggestedNextAction.trim()
              : fallbackNextAction(
                  needs[idx % Math.max(needs.length, 1)] ?? {
                    role: (p.suggestedRole ?? 'Partner') as RelationshipNeed['role'],
                    count: 1,
                    relationshipType:
                      (p.relationshipType ?? 'partner_linkage') as RelationshipNeed['relationshipType'],
                    requirements: '',
                  },
                ),
          rank: Number(p.rank ?? idx + 1),
          generatedAt,
          confidenceSource: 'gemini',
          recommendationSource: 'gemini',
          aiModel: getGeminiModelName(),
        };
      });
    } catch (err) {
      console.warn(
        'generateParticipants: AI ranking unavailable; returning fallback suggestions.',
        err,
      );
      suggestions = fallbackSuggestions(
        contextId,
        needs,
        candidates,
        tokens,
        generatedAt,
      );
    }

    // Batch write the suggestions plus a summary doc on the context.
    const batch = db.batch();
    const contextRef = db.collection('suggestions').doc(contextId);
    const participantsCol = contextRef.collection('participants');
    const oldSuggestions = await participantsCol.get();
    oldSuggestions.docs.forEach((doc) => batch.delete(doc.ref));
    suggestions.forEach((s) => batch.set(participantsCol.doc(s.id), s));
    batch.set(
      contextRef,
      {
        contextId,
        contextName: event.name,
        count: suggestions.length,
        generatedAt,
        confidenceSource:
          suggestions.some((s) => s.confidenceSource === 'gemini')
            ? 'gemini'
            : 'fallback',
        aiModel:
          suggestions.find((s) => s.aiModel)?.aiModel ?? null,
      },
      { merge: true },
    );
    await batch.commit();

    return { contextId, count: suggestions.length, suggestions };
  },
);
