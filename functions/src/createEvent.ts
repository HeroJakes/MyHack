/**
 * onCall: creates an `events/{eventId}` document. Events are the first
 * concrete "context" — the document carries `contextType: 'Event'` so every
 * downstream feature keyed on contextId/contextType stays backward compatible.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { Event, LocationType, RelationshipNeed } from './types';

const REGION = 'asia-southeast1';

export const createEvent = onCall({ region: REGION, cors: true, invoker: 'public' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const {
    name,
    type,
    field,
    description,
    locationType,
    location,
    imageUrl,
    targetOutcomes,
    roleRequirements,
    eventDate,
  } =
    request.data ?? {};

  if (!name || typeof name !== 'string') {
    throw new HttpsError('invalid-argument', 'A non-empty "name" is required.');
  }
  if (!field || typeof field !== 'string') {
    throw new HttpsError('invalid-argument', 'A non-empty "field" is required.');
  }

  const db = getFirestore();
  const ref = db.collection('events').doc();
  const now = Timestamp.now();

  const event: Event = {
    id: ref.id,
    name: name.trim(),
    contextType: 'Event',
    type: typeof type === 'string' && type.trim() ? type.trim() : 'General',
    field: field.trim(),
    description: typeof description === 'string' ? description.trim() : '',
    locationType:
      locationType === 'Virtual' || locationType === 'Hybrid'
        ? (locationType as LocationType)
        : 'Physical',
    location: typeof location === 'string' ? location.trim() : '',
    imageUrl: typeof imageUrl === 'string' ? imageUrl : '',
    targetOutcomes: Array.isArray(targetOutcomes)
      ? targetOutcomes.filter((item): item is string => typeof item === 'string')
      : [],
    createdBy: request.auth.uid,
    roleRequirements: Array.isArray(roleRequirements)
      ? (roleRequirements as RelationshipNeed[])
      : [],
    status: 'draft',
    createdAt: now,
    ...(eventDate
      ? { eventDate: Timestamp.fromMillis(Number(eventDate)) }
      : {}),
  };

  await ref.set(event);
  return { eventId: ref.id, event };
});
