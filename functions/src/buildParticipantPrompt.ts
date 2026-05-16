/**
 * Pure function: builds the Gemini prompt string for the participant
 * matching engine. No I/O, no side effects — easy to unit test.
 */
import type { Event, RelationshipNeed, User } from './types';

type PromptEvent = Pick<Event, 'name' | 'type' | 'field' | 'description'>;

type PromptCandidate = Pick<
  User,
  | 'id'
  | 'name'
  | 'headline'
  | 'photoURL'
  | 'inferredSector'
  | 'inferredExpertise'
  | 'inferredStage'
  | 'contributionSignals'
  | 'bio'
>;

export function buildParticipantPrompt(
  event: PromptEvent,
  needs: RelationshipNeed[],
  candidates: PromptCandidate[],
): string {
  const needLines = needs.length
    ? needs
        .map(
          (n, i) =>
            `${i + 1}. Role "${n.role}" (relationshipType: ${n.relationshipType}) ` +
            `— need ${n.count}. Requirements: ${n.requirements}`,
        )
        .join('\n')
    : '(no explicit role requirements — infer sensible roles from the context)';

  const candidateLines = candidates
    .map(
      (c) =>
        `- id: ${c.id} | name: ${c.name} | headline: ${c.headline} | ` +
        `sectors: ${(c.inferredSector ?? []).join(', ')} | ` +
        `expertise: ${(c.inferredExpertise ?? []).join(', ')} | ` +
        `stage: ${c.inferredStage} | ` +
        `signals: ${(c.contributionSignals ?? []).join(', ')} | ` +
        `bio: ${c.bio}`,
    )
    .join('\n');

  return [
    'You are EcoGraph AI, an ecosystem relationship matching engine.',
    'You match people to the relationship needs of a context based on evidence.',
    '',
    `Context: "${event.name}" — type: ${event.type}, field: ${event.field}.`,
    `Description: ${event.description}`,
    '',
    'Relationship needs to fill:',
    needLines,
    '',
    'Candidate people:',
    candidateLines || '(no candidates supplied)',
    '',
    'Task: rank the strongest candidates for the relationship needs above.',
    'Only use the candidate ids provided. Never invent people.',
    'For every suggestion include exactly these fields:',
    '- userId: the candidate id',
    '- name: the candidate name',
    '- photoURL: the candidate photoURL',
    '- headline: the candidate headline',
    '- suggestedRole: one of the need roles above',
    '- relationshipType: the relationshipType of the matched need',
    '- reason: one concise sentence grounded ONLY in the candidate data',
    '- confidence: integer 0-100',
    '- riskFlags: array of short strings; empty array when there is no concern',
    '- suggestedNextAction: a short imperative string (e.g. "Send intro invite")',
    '- rank: integer, 1 = best match overall',
    '',
    'Return ONLY raw JSON of this exact shape:',
    '{ "participants": ParticipantSuggestion[] }',
  ].join('\n');
}
