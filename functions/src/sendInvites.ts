/**
 * onCall: batch-writes invite documents for a context.
 *
 * Only the organizer of the context may send invites. Each selected
 * participant suggestion becomes a pending `invites/{inviteId}` document.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { Event, Invite } from './types';

const REGION = 'asia-southeast1';

export const sendInvites = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const uid = request.auth.uid;

  const { contextId, invites } = request.data ?? {};
  if (!contextId || typeof contextId !== 'string') {
    throw new HttpsError('invalid-argument', 'A "contextId" string is required.');
  }
  if (!Array.isArray(invites) || invites.length === 0) {
    throw new HttpsError('invalid-argument', 'A non-empty "invites" array is required.');
  }

  const db = getFirestore();
  let contextRef = db.collection('events').doc(contextId);
  let contextSnap = await contextRef.get();
  let isEcosystemContext = false;
  if (!contextSnap.exists) {
    contextRef = db.collection('ecosystemContexts').doc(contextId);
    contextSnap = await contextRef.get();
    isEcosystemContext = true;
  }
  if (!contextSnap.exists) {
    throw new HttpsError('not-found', `Context ${contextId} was not found.`);
  }
  const event = { id: contextSnap.id, ...contextSnap.data() } as Event;
  if (event.createdBy !== uid) {
    throw new HttpsError(
      'permission-denied',
      'Only the organizer can send invites for this context.',
    );
  }

  const sentAt = Timestamp.now();
  const batch = db.batch();

  const created: Invite[] = invites.map((raw: Record<string, unknown>) => {
    const ref = db.collection('invites').doc();
    const invitedUserId = String(raw.invitedUserId ?? raw.userId ?? '');
    if (!invitedUserId) {
      throw new HttpsError(
        'invalid-argument',
        'Every invite needs an "invitedUserId".',
      );
    }
    const invite: Invite = {
      id: ref.id,
      contextId,
      contextName: event.name,
      contextType: event.contextType,
      invitedUserId,
      invitedBy: uid,
      assignedRole: (raw.assignedRole ?? raw.suggestedRole) as Invite['assignedRole'],
      relationshipType: raw.relationshipType as Invite['relationshipType'],
      aiReason: String(raw.aiReason ?? raw.reason ?? ''),
      confidence: Math.max(0, Math.min(100, Number(raw.confidence ?? 0))),
      status: 'pending',
      sentAt,
    };
    batch.set(ref, invite);
    return invite;
  });

  batch.update(contextRef, {
    status: 'open',
    ...(isEcosystemContext ? { updatedAt: sentAt } : {}),
  });

  await batch.commit();
  return { contextId, count: created.length, invites: created };
});
