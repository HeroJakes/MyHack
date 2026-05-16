/**
 * Shared frontend data model for PoyoLink.
 *
 * Mirrors `functions/src/types.ts`. The Event interface is named `EcoEvent`
 * here to avoid colliding with the DOM `Event` global.
 */
import type { Timestamp } from 'firebase/firestore';

/** Firestore timestamps are read back on the client as `Timestamp`. */
export type TimestampValue = Timestamp;

/** Status used by every async action: idle -> loading -> success | error. */
export type AsyncStatus = 'idle' | 'loading' | 'error' | 'success';

export type InferredStage =
  | 'pre-seed'
  | 'seed'
  | 'series-a'
  | 'growth'
  | 'established'
  | 'ecosystem';

export type RelationshipRole =
  | 'Mentor'
  | 'Partner'
  | 'Startup/Company'
  | 'Service Provider'
  | 'Programme Admin';

export type RelationshipType =
  | 'mentor_match'
  | 'partner_linkage'
  | 'service_support'
  | 'programme_fit'
  | 'participant_orchestration';

export type EventStatus = 'draft' | 'open' | 'closed' | 'completed';

export type InviteStatus = 'pending' | 'confirmed' | 'declined';

export type EcosystemLinkStatus =
  | 'suggested'
  | 'invited'
  | 'active'
  | 'completed'
  | 'declined'
  | 'archived';

export const RELATIONSHIP_ROLES: RelationshipRole[] = [
  'Mentor',
  'Partner',
  'Startup/Company',
  'Service Provider',
  'Programme Admin',
];

export const RELATIONSHIP_TYPES: RelationshipType[] = [
  'mentor_match',
  'partner_linkage',
  'service_support',
  'programme_fit',
  'participant_orchestration',
];

export interface User {
  id: string;
  name: string;
  email: string;
  photoURL: string;
  image?: string;
  profileImageBase64?: string;
  hasAddedAISignals?: boolean;
  headline: string;
  linkedinId?: string;
  inferredSector: string[];
  inferredExpertise: string[];
  inferredStage: InferredStage;
  contributionSignals: string[];
  bio: string;
  profileCompleteness: number;
  onboardingComplete: boolean;
  createdAt: TimestampValue;
  updatedAt: TimestampValue;
}

/** Structured profile returned by the `extractUserProfile` Cloud Function. */
export interface ExtractedProfile {
  headline: string;
  bio: string;
  inferredSector: string[];
  inferredExpertise: string[];
  inferredStage: InferredStage;
  contributionSignals: string[];
  profileCompleteness: number;
}

export interface RelationshipNeed {
  role: RelationshipRole;
  count: number;
  relationshipType: RelationshipType;
  requirements: string;
}

/** Backward-compatible "context" — the first context type is the Event. */
export interface EcoEvent {
  id: string;
  name: string;
  contextType: 'Event';
  type: string;
  field: string;
  description: string;
  createdBy: string;
  roleRequirements: RelationshipNeed[];
  status: EventStatus;
  createdAt: TimestampValue;
  eventDate?: TimestampValue;
}

export type ContextType =
  | 'Event'
  | 'Programme'
  | 'Initiative'
  | 'Cohort'
  | 'CountryExpansion';

export type LocationType = 'Physical' | 'Virtual' | 'Hybrid';

export interface EcosystemContext {
  id: string;
  name: string;
  contextType: ContextType;
  field: string;
  description: string;
  locationType: LocationType;
  location: string;
  imageUrl?: string;
  startDate: TimestampValue;
  endDate: TimestampValue;
  status: EventStatus;
  targetOutcomes: string[];
  relationshipNeeds: RelationshipNeed[];
  createdBy: string;
  createdAt: TimestampValue;
  updatedAt: TimestampValue;
}

export interface ParticipantSuggestion {
  id: string;
  userId: string;
  name: string;
  photoURL: string;
  headline: string;
  suggestedRole: RelationshipRole;
  relationshipType: RelationshipType;
  reason: string;
  confidence: number;
  riskFlags: string[];
  suggestedNextAction: string;
  rank: number;
  generatedAt: TimestampValue;
}

export interface Invite {
  id: string;
  contextId: string;
  contextName: string;
  contextType: string;
  invitedUserId: string;
  invitedBy: string;
  assignedRole: RelationshipRole;
  relationshipType: RelationshipType;
  aiReason: string;
  confidence: number;
  status: InviteStatus;
  sentAt: TimestampValue;
  respondedAt?: TimestampValue;
  declineReason?: string;
}

export interface EcosystemLink {
  id: string;
  sourceUserId: string;
  targetUserId: string;
  contextId: string;
  contextName: string;
  contextType: string;
  field: string;
  sourceType: string;
  targetType: string;
  relationshipType: RelationshipType;
  assignedRole: RelationshipRole;
  aiReason: string;
  confidence: number;
  riskFlags: string[];
  status: EcosystemLinkStatus;
  outcomeScore?: number;
  feedbackSummary?: string;
  reusableTags: string[];
  createdFromInviteId: string;
  createdAt: TimestampValue;
  updatedAt: TimestampValue;
}
