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
import type { Event, ParticipantSuggestion, User } from './types';

const REGION = 'asia-southeast1';

/** Splits the event field into lowercase tokens used for the pre-filter. */
function tokenize(field: string): string[] {
  return field
    .toLowerCase()
    .split(/[\s/,&]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

export const generateParticipants = onCall(
  { region: REGION, secrets: ['GEMINI_API_KEY'] },
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

    if (!eventSnap.exists) {
      throw new HttpsError('not-found', `Event ${contextId} was not found.`);
    }
    const event = { id: eventSnap.id, ...eventSnap.data() } as Event;
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
    const needs = event.roleRequirements ?? [];

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

    const prompt = buildParticipantPrompt(event, needs, candidates);
    const parsed = await callGemini(prompt);
    if (!parsed.participants || !Array.isArray(parsed.participants)) {
      throw new HttpsError(
        'internal',
        'Unexpected Gemini response shape for participants',
      );
    }

    const generatedAt = Timestamp.now();
    const suggestions: ParticipantSuggestion[] = parsed.participants.map(
      (p: any, idx: number) => {
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
          reason: String(p.reason ?? ''),
          confidence: Math.max(0, Math.min(100, Number(p.confidence ?? 0))),
          riskFlags: Array.isArray(p.riskFlags)
            ? p.riskFlags.map((r: any) => String(r))
            : [],
          suggestedNextAction: String(p.suggestedNextAction ?? 'Review candidate'),
          rank: Number(p.rank ?? idx + 1),
          generatedAt,
        };
      },
    );

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
