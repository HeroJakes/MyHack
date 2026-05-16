/**
 * onCall: the AI match engine.
 *
 * 1. Reads the event + all users (independent reads run in parallel).
 * 2. Rule pre-filter — keeps only candidates whose sector/expertise overlaps
 *    the event field, so Gemini ranks a focused shortlist.
 * 3. Gemini ranks the shortlist into ParticipantSuggestion[].
 * 4. Persists the suggestions under `suggestions/{contextId}/participants`.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { buildParticipantPrompt } from './buildParticipantPrompt';
import { callGemini } from './callGemini';
import type { Event, ParticipantSuggestion, RelationshipNeed, User } from './types';

const REGION = 'asia-southeast1';
const AI_TIMEOUT_MS = 45_000;

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
      const confidence = Math.max(
        35,
        Math.min(85, Math.round(scoreCandidate(user, tokens))),
      );
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
      });
    }
  }

  return suggestions;
}

export const generateParticipants = onCall(
  { region: REGION, cors: true, timeoutSeconds: 180 },
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

    // Independent reads run in parallel.
    const [eventSnap, usersSnap] = await Promise.all([
      db.collection('events').doc(contextId).get(),
      db.collection('users').get(),
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
    const rawNeeds =
      event.roleRequirements ??
      ((event as unknown as { relationshipNeeds?: RelationshipNeed[] })
        .relationshipNeeds ??
        []);
    const needs = rawNeeds;

    // Rule pre-filter: candidates whose sector/expertise overlaps the field.
    const tokens = tokenize(event.field ?? '');
    const others = allUsers.filter((u) => u.id !== event.createdBy);
    const preFiltered = others.filter((u) => {
      if (tokens.length === 0) return true;
      const haystack = [
        ...(u.inferredSector ?? []),
        ...(u.inferredExpertise ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return tokens.some((t) => haystack.includes(t));
    });
    // Fall back to the full pool if the pre-filter is too aggressive.
    const candidates = preFiltered.length > 0 ? preFiltered : others;
    const promptCandidates = candidates.map((u) => ({
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

    const generatedAt = Timestamp.now();
    const prompt = buildParticipantPrompt(event, needs, promptCandidates);
    let suggestions: ParticipantSuggestion[];
    try {
      const parsed = await withTimeout(callGemini(prompt), AI_TIMEOUT_MS);
      if (!parsed.participants || !Array.isArray(parsed.participants)) {
        throw new HttpsError(
          'internal',
          'Unexpected Gemini response shape for participants',
        );
      }

      suggestions = parsed.participants.map((p: any, idx: number) => {
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
          confidence: Math.max(0, Math.min(100, Number(p.confidence ?? 0))),
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
    suggestions.forEach((s) => batch.set(participantsCol.doc(s.id), s));
    batch.set(
      contextRef,
      {
        contextId,
        contextName: event.name,
        count: suggestions.length,
        generatedAt,
      },
      { merge: true },
    );
    await batch.commit();

    return { contextId, count: suggestions.length, suggestions };
  },
);
