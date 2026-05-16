/**
 * onCall: an actor in a confirmed ecosystem link records its outcome.
 *
 * Writes `outcomeScore` / `feedbackSummary` back onto the link (and marks it
 * `completed`), and appends a `linkFeedback` document. The outcomeScore is the
 * exact signal `generateParticipants` reads to improve future matching —
 * closing the AI feedback loop.
 *
 * Both writes commit atomically with a batch write.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { EcosystemLink, LinkFeedback } from './types';

const REGION = 'asia-southeast1';

export const submitLinkFeedback = onCall(
  { region: REGION },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required');
    }

    const { linkId, outcomeScore, feedbackSummary, rating, outcome, comment } =
      request.data ?? {};

    if (!linkId || typeof linkId !== 'string') {
      throw new HttpsError('invalid-argument', 'A "linkId" string is required');
    }
    if (
      typeof outcomeScore !== 'number' ||
      outcomeScore < 0 ||
      outcomeScore > 100
    ) {
      throw new HttpsError(
        'invalid-argument',
        'outcomeScore must be a number between 0 and 100',
      );
    }

    const db = getFirestore();
    const linkRef = db.collection('ecosystemLinks').doc(linkId);
    const linkSnap = await linkRef.get();

    if (!linkSnap.exists) {
      throw new HttpsError('not-found', 'Ecosystem link not found');
    }

    const link = linkSnap.data() as EcosystemLink;

    if (
      link.sourceUserId !== request.auth.uid &&
      link.targetUserId !== request.auth.uid
    ) {
      throw new HttpsError(
        'permission-denied',
        'Only actors in this link can submit feedback',
      );
    }

    const batch = db.batch();

    batch.update(linkRef, {
      outcomeScore,
      feedbackSummary: feedbackSummary ?? '',
      status: 'completed',
      updatedAt: FieldValue.serverTimestamp(),
    });

    const feedbackRef = db.collection('linkFeedback').doc();
    const feedbackDoc: LinkFeedback = {
      id: feedbackRef.id,
      linkId,
      givenBy: request.auth.uid,
      rating: typeof rating === 'number' ? rating : 0,
      outcome: outcome ?? 'neutral',
      comment: comment ?? '',
      createdAt: FieldValue.serverTimestamp(),
    };
    batch.set(feedbackRef, feedbackDoc);

    await batch.commit();

    return { success: true, linkId, outcomeScore };
  },
);
