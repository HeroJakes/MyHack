/**
 * PoyoLink — Cloud Functions entry point.
 *
 * Initializes the Admin SDK once, then re-exports every callable function.
 * All functions run in region asia-southeast1.
 */
import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { extractUserProfile } from './extractUserProfile';
export { createEvent } from './createEvent';
export { createContext } from './createContext';
export { suggestRelationshipNeeds } from './suggestRelationshipNeeds';
export { generateParticipants } from './generateParticipants';
export { sendInvites } from './sendInvites';
export { respondToInvite } from './respondToInvite';
export { submitLinkFeedback } from './submitLinkFeedback';
