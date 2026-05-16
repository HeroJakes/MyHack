/**
 * onCall: the invitee accepts or declines an invite.
 *
 * accepted -> invite.status = 'confirmed', respondedAt = now,
 *             create an EcosystemLink and set its status to 'active'.
 * declined -> invite.status = 'declined', store declineReason,
 *             NO EcosystemLink is created.
 *
 * Both branches commit atomically with a batch write.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createEcosystemLinkFromInvite } from './createEcosystemLinkFromInvite';
import type { Event, Invite } from './types';

const REGION = 'asia-southeast1';

export const respondToInvite = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const uid = request.auth.uid;

  const { inviteId, response, declineReason } = request.data ?? {};
  if (!inviteId || typeof inviteId !== 'string') {
    throw new HttpsError('invalid-argument', 'An "inviteId" string is required.');
  }
  if (response !== 'accepted' && response !== 'declined') {
    throw new HttpsError(
      'invalid-argument',
      'A "response" of "accepted" or "declined" is required.',
    );
  }

  const db = getFirestore();
  const inviteRef = db.collection('invites').doc(inviteId);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) {
    throw new HttpsError('not-found', `Invite ${inviteId} was not found.`);
  }
  const invite = { id: inviteSnap.id, ...inviteSnap.data() } as Invite;

  if (invite.invitedUserId !== uid) {
    throw new HttpsError(
      'permission-denied',
      'You can only respond to invites addressed to you.',
    );
  }
  if (invite.status !== 'pending') {
    throw new HttpsError(
      'failed-precondition',
      `This invite was already ${invite.status}.`,
    );
  }

  const now = Timestamp.now();
  const batch = db.batch();

  // --- Declined --------------------------------------------------------
  if (response === 'declined') {
    batch.update(inviteRef, {
      status: 'declined',
      respondedAt: now,
      declineReason: String(declineReason ?? ''),
    });
    await batch.commit();
    return { inviteId, status: 'declined' as const, linkId: null };
  }

  // --- Accepted --------------------------------------------------------
  batch.update(inviteRef, { status: 'confirmed', respondedAt: now });

  // Look up the context field for the link record.
  const eventSnap = await db.collection('events').doc(invite.contextId).get();
  const field = eventSnap.exists
    ? (eventSnap.data() as Event).field ?? ''
    : '';

  const linkRef = db.collection('ecosystemLinks').doc();
  const link = createEcosystemLinkFromInvite(invite, { id: linkRef.id, field });
  // Step 3: a confirmed invite produces an active relationship.
  link.status = 'active';
  link.updatedAt = now;
  batch.set(linkRef, link);

  await batch.commit();
  return { inviteId, status: 'confirmed' as const, linkId: linkRef.id, link };
});
