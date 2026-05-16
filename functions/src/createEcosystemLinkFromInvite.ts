/**
 * Internal helper called by respondToInvite.
 *
 * Builds the EcosystemLink payload for a confirmed invite. It deliberately
 * does NOT persist the document — the caller owns the batch write and the
 * final status transition (suggested -> active).
 */
import { Timestamp } from 'firebase-admin/firestore';
import type { EcosystemLink, Invite } from './types';

interface LinkOptions {
  /** Pre-allocated Firestore document id for the new link. */
  id: string;
  /** Context field, looked up by the caller from the event document. */
  field?: string;
  /** Actor type of the source (organizer). Defaults to Programme Admin. */
  sourceType?: string;
  /** Actor type of the target. Defaults to the invite's assigned role. */
  targetType?: string;
}

export function createEcosystemLinkFromInvite(
  invite: Invite,
  options: LinkOptions,
): EcosystemLink {
  const now = Timestamp.now();

  return {
    id: options.id,
    sourceUserId: invite.invitedBy,
    targetUserId: invite.invitedUserId,
    contextId: invite.contextId,
    contextName: invite.contextName,
    contextType: invite.contextType,
    field: options.field ?? '',
    sourceType: options.sourceType ?? 'Programme Admin',
    targetType: options.targetType ?? invite.assignedRole,
    relationshipType: invite.relationshipType,
    assignedRole: invite.assignedRole,
    aiReason: invite.aiReason,
    confidence: invite.confidence,
    riskFlags: [],
    // Created in the "suggested" state; respondToInvite promotes it to "active".
    status: 'suggested',
    reusableTags: [invite.relationshipType, invite.assignedRole],
    createdFromInviteId: invite.id,
    createdAt: now,
    updatedAt: now,
  };
}
