/**
 * onCall: creates an `ecosystemContexts/{contextId}` document.
 *
 * This is the generalized successor to `createEvent` — it accepts the full
 * context schema (location, dates, banner image, target outcomes) and keeps
 * `contextType` on the document so every downstream feature keyed on
 * contextId/contextType stays backward compatible.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import type {
  ContextType,
  EcosystemContext,
  EventStatus,
  LocationType,
  RelationshipNeed,
  RelationshipRole,
  RelationshipType,
} from './types';

const REGION = 'asia-southeast1';

const CONTEXT_TYPES: ContextType[] = [
  'Event',
  'Programme',
  'Initiative',
  'Cohort',
  'CountryExpansion',
];

const LOCATION_TYPES: LocationType[] = ['Physical', 'Virtual', 'Hybrid'];

const NAME_MAX = 100;
const DESCRIPTION_MIN = 20;
const DESCRIPTION_MAX = 1000;
const OUTCOMES_MAX = 10;
const OUTCOME_LENGTH_MAX = 100;
const REQUIREMENTS_MAX = 500;
const COUNT_MIN = 1;
const COUNT_MAX = 20;
const KEYWORDS_MAX = 10;
const KEYWORD_LENGTH_MAX = 50;

/** Throws an `invalid-argument` HttpsError; typed `never` so it narrows. */
function invalid(message: string): never {
  throw new HttpsError('invalid-argument', message);
}

interface NeedInput {
  role?: unknown;
  count?: unknown;
  relationshipType?: unknown;
  requirements?: unknown;
  keywords?: unknown;
}

export const createContext = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }

  const data = request.data ?? {};
  const {
    name,
    contextType,
    field,
    description,
    locationType,
    location,
    startDate,
    endDate,
    status,
    imageUrl,
    targetOutcomes,
    relationshipNeeds,
  } = data;

  // name — required, non-empty, max 100 chars.
  if (typeof name !== 'string' || name.trim().length === 0) {
    invalid('A non-empty "name" is required.');
  }
  const nameValue = name.trim();
  if (nameValue.length > NAME_MAX) {
    invalid(`"name" must be ${NAME_MAX} characters or fewer.`);
  }

  // contextType — one of the five allowed values.
  if (!CONTEXT_TYPES.includes(contextType)) {
    invalid(`"contextType" must be one of: ${CONTEXT_TYPES.join(', ')}.`);
  }

  // field — required, non-empty.
  if (typeof field !== 'string' || field.trim().length === 0) {
    invalid('A non-empty "field" is required.');
  }

  // description — required, 20–1000 chars.
  if (typeof description !== 'string' || description.trim().length < DESCRIPTION_MIN) {
    invalid(`"description" must be at least ${DESCRIPTION_MIN} characters.`);
  }
  const descriptionValue = description.trim();
  if (descriptionValue.length > DESCRIPTION_MAX) {
    invalid(`"description" must be ${DESCRIPTION_MAX} characters or fewer.`);
  }

  // locationType — one of Physical, Virtual, Hybrid.
  if (!LOCATION_TYPES.includes(locationType)) {
    invalid(`"locationType" must be one of: ${LOCATION_TYPES.join(', ')}.`);
  }

  // location — required for Physical/Hybrid, optional for Virtual.
  const locationValue =
    typeof location === 'string' ? location.trim() : '';
  if (
    (locationType === 'Physical' || locationType === 'Hybrid') &&
    locationValue.length === 0
  ) {
    invalid('"location" is required for Physical or Hybrid contexts.');
  }

  // startDate / endDate — valid ISO strings, endDate >= startDate.
  if (typeof startDate !== 'string' || Number.isNaN(Date.parse(startDate))) {
    invalid('"startDate" must be a valid ISO date string.');
  }
  if (typeof endDate !== 'string' || Number.isNaN(Date.parse(endDate))) {
    invalid('"endDate" must be a valid ISO date string.');
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end.getTime() < start.getTime()) {
    invalid('"endDate" must be after or equal to "startDate".');
  }

  // status — draft or open.
  if (status !== 'draft' && status !== 'open') {
    invalid('"status" must be "draft" or "open".');
  }

  // targetOutcomes — array, max 10, each item max 100 chars.
  if (!Array.isArray(targetOutcomes)) {
    invalid('"targetOutcomes" must be an array.');
  }
  if (targetOutcomes.length > OUTCOMES_MAX) {
    invalid(`"targetOutcomes" may contain at most ${OUTCOMES_MAX} items.`);
  }
  const outcomes: string[] = [];
  for (const item of targetOutcomes) {
    if (typeof item !== 'string') {
      invalid('Every target outcome must be a string.');
    }
    const trimmed = item.trim();
    if (trimmed.length > OUTCOME_LENGTH_MAX) {
      invalid(
        `Each target outcome must be ${OUTCOME_LENGTH_MAX} characters or fewer.`,
      );
    }
    if (trimmed.length > 0) outcomes.push(trimmed);
  }

  // relationshipNeeds — array, at least one item.
  if (!Array.isArray(relationshipNeeds) || relationshipNeeds.length < 1) {
    invalid('At least one relationship need is required.');
  }
  const needs: RelationshipNeed[] = relationshipNeeds.map((raw: NeedInput) => {
    if (typeof raw?.role !== 'string' || raw.role.trim().length === 0) {
      invalid('Every relationship need must have a "role".');
    }
    const count = Number(raw.count);
    if (!Number.isInteger(count) || count < COUNT_MIN || count > COUNT_MAX) {
      invalid(
        `Every relationship need "count" must be an integer between ${COUNT_MIN} and ${COUNT_MAX}.`,
      );
    }
    if (
      typeof raw.relationshipType !== 'string' ||
      raw.relationshipType.trim().length === 0
    ) {
      invalid('Every relationship need must have a "relationshipType".');
    }
    const requirements =
      typeof raw.requirements === 'string' ? raw.requirements.trim() : '';
    if (requirements.length > REQUIREMENTS_MAX) {
      invalid(
        `"requirements" must be ${REQUIREMENTS_MAX} characters or fewer.`,
      );
    }

    const need: RelationshipNeed = {
      role: raw.role.trim() as RelationshipRole,
      count,
      relationshipType: raw.relationshipType.trim() as RelationshipType,
      requirements,
    };

    if (raw.keywords !== undefined) {
      if (!Array.isArray(raw.keywords)) {
        invalid('"keywords" must be an array.');
      }
      if (raw.keywords.length > KEYWORDS_MAX) {
        invalid(
          `A relationship need may have at most ${KEYWORDS_MAX} keywords.`,
        );
      }
      const keywords: string[] = [];
      for (const keyword of raw.keywords) {
        if (typeof keyword !== 'string') {
          invalid('Every keyword must be a string.');
        }
        const trimmed = keyword.trim();
        if (trimmed.length > KEYWORD_LENGTH_MAX) {
          invalid(
            `Each keyword must be ${KEYWORD_LENGTH_MAX} characters or fewer.`,
          );
        }
        if (trimmed.length > 0) keywords.push(trimmed);
      }
      if (keywords.length > 0) need.keywords = keywords;
    }

    return need;
  });

  const db = getFirestore();
  const ref = db.collection('ecosystemContexts').doc();

  const context: EcosystemContext = {
    id: ref.id,
    name: nameValue,
    contextType: contextType as ContextType,
    field: field.trim(),
    description: descriptionValue,
    locationType: locationType as LocationType,
    location: locationValue,
    startDate: Timestamp.fromDate(start),
    endDate: Timestamp.fromDate(end),
    status: status as EventStatus,
    targetOutcomes: outcomes,
    relationshipNeeds: needs,
    createdBy: request.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (typeof imageUrl === 'string' && imageUrl.length > 0) {
    context.imageUrl = imageUrl;
  }

  await ref.set(context);
  return { contextId: ref.id };
});
