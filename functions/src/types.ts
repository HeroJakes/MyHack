/**
 * Shared backend data model for PoyoLink.
 *
 * Firestore timestamp fields are written as `Timestamp` or `FieldValue`
 * (e.g. server timestamps) and always read back as `Timestamp`.
 */
import type { FieldValue, Timestamp } from 'firebase-admin/firestore';

export type TimestampValue = Timestamp | FieldValue;

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

/** A person in the ecosystem. There is intentionally NO permanent role field. */
export interface User {
  id: string;
  name: string;
  email: string;
  photoURL: string;
  headline: string;
  linkedinId?: string;
  inferredSector: string[];
  inferredExpertise: string[];
  inferredStage: InferredStage;
  contributionSignals: string[];
  bio: string;
  profileCompleteness: number;
  /** Cached one-line summary string sent to Gemini (token-efficiency cache). */
  geminiSummary?: string;
  createdAt: TimestampValue;
  updatedAt: TimestampValue;
}

/** A relationship the organizer needs to fill for a context. */
export interface RelationshipNeed {
  role: RelationshipRole;
  count: number;
  relationshipType: RelationshipType;
  requirements: string;
  /** Optional free-text keyword hints to sharpen AI matching for this role. */
  keywords?: string[];
}

/**
 * An Event is the first concrete "context". `contextType` is kept on the
 * document so future context types (programmes, cohorts) stay backward
 * compatible with everything keyed on `contextId` / `contextType`.
 */
export interface Event {
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

/** An AI-ranked candidate for one of a context's relationship needs. */
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
  /** True when the candidate is an extra match beyond the required quotas. */
  bonus?: boolean;
  generatedAt: TimestampValue;
}

/** The structured envelope returned by the `generateParticipants` function. */
export interface GenerateParticipantsResult {
  success: boolean;
  suggestions: ParticipantSuggestion[];
  quotaSummary: {
    role: string;
    relationshipType: string;
    needed: number;
    filled: number;
  }[];
  warnings: string[];
  error?: string;
  fallback?: boolean;
}

/** An invitation sent to a person for a specific context + role. */
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

/** A reusable ecosystem relationship created from a confirmed match. */
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
