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

function inviteDocId(
  contextId: string,
  invitedUserId: string,
  assignedRole: unknown,
  relationshipType: unknown,
) {
  return [
    contextId,
    invitedUserId,
    String(assignedRole ?? ''),
    String(relationshipType ?? ''),
  ]
    .map((part) => encodeURIComponent(part))
    .join('__');
}

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
    const invitedUserId = String(raw.invitedUserId ?? raw.userId ?? '');
    if (!invitedUserId) {
      throw new HttpsError(
        'invalid-argument',
        'Every invite needs an "invitedUserId".',
      );
    }
    const assignedRole = raw.assignedRole ?? raw.suggestedRole;
    const relationshipType = raw.relationshipType;
    const ref = db
      .collection('invites')
      .doc(inviteDocId(contextId, invitedUserId, assignedRole, relationshipType));
    const invite: Invite = {
      id: ref.id,
      contextId,
      contextName: event.name,
      contextType: event.contextType,
      invitedUserId,
      invitedBy: uid,
      assignedRole: assignedRole as Invite['assignedRole'],
      relationshipType: relationshipType as Invite['relationshipType'],
      aiReason: String(raw.aiReason ?? raw.reason ?? ''),
      confidence: Math.max(0, Math.min(100, Number(raw.confidence ?? 0))),
      riskFlags: Array.isArray(raw.riskFlags)
        ? (raw.riskFlags as unknown[]).map((r) => String(r))
        : [],
      status: 'pending',
      sentAt,
    };
    batch.set(ref, invite, { merge: true });
    return invite;
  });

  batch.update(contextRef, {
    status: 'open',
    ...(isEcosystemContext ? { updatedAt: sentAt } : {}),
  });

  await batch.commit();
  return { contextId, count: created.length, invites: created };
});
