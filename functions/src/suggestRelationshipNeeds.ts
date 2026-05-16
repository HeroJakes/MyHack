/**
 * onCall: uses Gemini to suggest a realistic set of RelationshipNeed[] for a
 * context, given its field and description. The organizer can edit the result
 * before saving it onto an event.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { callGemini } from './callGemini';
import type {
  RelationshipNeed,
  RelationshipRole,
  RelationshipType,
} from './types';

const REGION = 'asia-southeast1';

const VALID_ROLES: RelationshipRole[] = [
  'Mentor',
  'Partner',
  'Startup/Company',
  'Service Provider',
  'Programme Admin',
];

const VALID_TYPES: RelationshipType[] = [
  'mentor_match',
  'partner_linkage',
  'service_support',
  'programme_fit',
  'participant_orchestration',
];

export const suggestRelationshipNeeds = onCall(
  { region: REGION, secrets: ['GEMINI_API_KEY'] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.');
    }

    const { field, description } = request.data ?? {};
    if (!field || typeof field !== 'string') {
      throw new HttpsError('invalid-argument', 'A non-empty "field" is required.');
    }

    const prompt = [
      'You are EcoGraph AI. Suggest the relationship needs for an ecosystem context.',
      `Field: ${field}`,
      `Description: ${typeof description === 'string' && description ? description : '(none provided)'}`,
      '',
      'Return ONLY raw JSON of shape { "relationshipNeeds": RelationshipNeed[] }.',
      'Each RelationshipNeed has exactly:',
      `- role: one of ${VALID_ROLES.join(' | ')}`,
      '- count: positive integer',
      `- relationshipType: one of ${VALID_TYPES.join(' | ')}`,
      '- requirements: one concise sentence describing who fits this role',
      '',
      'Suggest 3 to 5 needs that realistically fit the field and description.',
    ].join('\n');

    const parsed = await callGemini(prompt);
    if (!parsed.relationshipNeeds || !Array.isArray(parsed.relationshipNeeds)) {
      throw new HttpsError(
        'internal',
        'Unexpected Gemini response shape for relationshipNeeds',
      );
    }

    const needs: RelationshipNeed[] = parsed.relationshipNeeds.map((n: any) => {
      const role = String(n.role) as RelationshipRole;
      const relationshipType = String(n.relationshipType) as RelationshipType;
      return {
        role: VALID_ROLES.includes(role) ? role : 'Partner',
        count: Math.max(1, Math.round(Number(n.count ?? 1))),
        relationshipType: VALID_TYPES.includes(relationshipType)
          ? relationshipType
          : 'partner_linkage',
        requirements: String(n.requirements ?? ''),
      };
    });

    return { needs };
  },
);
