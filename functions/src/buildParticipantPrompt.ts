/**
 * Pure function: builds the Gemini prompt string for the participant
 * matching engine. No I/O, no side effects — easy to unit test.
 */
import type { Event, RelationshipNeed } from './types';

type PromptEvent = Pick<Event, 'name' | 'type' | 'field' | 'description'>;

/**
 * A token-efficient candidate sent to Gemini: just an id plus a one-line
 * summary string. The raw User object is never sent.
 */
export interface PromptCandidate {
  id: string;
  summary: string;
}

export function buildParticipantPrompt(
  event: PromptEvent,
  needs: RelationshipNeed[],
  candidates: PromptCandidate[],
): string {
  // RELATIONSHIP NEEDS — one block per need: Requirements then optional Keywords.
  const needLines = needs.length
    ? needs
        .map((n, i) => {
          const keywords = Array.isArray(n.keywords) ? n.keywords : [];
          const lines = [
            `${i + 1}. Role "${n.role}" (relationshipType: ${n.relationshipType}) — need ${n.count}.`,
            `   Requirements: ${n.requirements}`,
          ];
          if (keywords.length > 0) {
            lines.push(`   Keywords: ${keywords.join(', ')}`);
          }
          return lines.join('\n');
        })
        .join('\n')
    : '(no explicit role requirements — infer sensible roles from the context)';

  // REQUIRED SLOT QUOTAS — every need must be filled before bonus candidates.
  const quotaLines = needs.length
    ? needs
        .map(
          (n) =>
            `- ${n.role} (${n.relationshipType}): ${n.count} candidate(s) required`,
        )
        .join('\n')
    : '- (no quotas — infer sensible roles from the context)';

  const candidateLines = candidates
    .map((c) => `- id: ${c.id} | ${c.summary}`)
    .join('\n');

  return [
    'You are EcoGraph AI, an ecosystem relationship matching engine.',
    'You match people to the relationship needs of a context based on evidence.',
    '',
    `Context: "${event.name}" — type: ${event.type}, field: ${event.field}.`,
    `Description: ${event.description}`,
    '',
    'RELATIONSHIP NEEDS:',
    needLines,
    '',
    'REQUIRED SLOT QUOTAS — THIS IS MANDATORY:',
    'You MUST return exactly the number of candidates specified for each role.',
    'If you cannot find a perfect match, return the best available candidate for that slot anyway.',
    'It is better to return a lower-confidence candidate with honest riskFlags than to leave a slot empty.',
    'Leaving a slot empty is a failure. Returning a lower-confidence candidate is acceptable.',
    '',
    'Quotas:',
    quotaLines,
    '',
    'After satisfying all quotas, you MAY add up to 2 bonus candidates. Bonus ' +
      'candidates must have confidence >= 60 and must be marked with "bonus": ' +
      'true in the JSON. Do not add bonus candidates if quotas cannot be filled.',
    '',
    'CANDIDATE PEOPLE:',
    candidateLines || '(no candidates supplied)',
    '',
    'RULES:',
    '1. You MUST fill every slot quota. If no strong match exists, return the closest available candidate with a reduced confidence score and appropriate riskFlags. Never leave a required slot empty.',
    '2. Rank the strongest candidates for the relationship needs above.',
    '3. Only use the candidate ids provided. Never invent people.',
    '4. Satisfy every REQUIRED SLOT QUOTA before adding any bonus candidate.',
    '5. suggestedRole must be one of the need roles; relationshipType must be ' +
      'the relationshipType of the matched need.',
    '6. reason must be one concise sentence grounded ONLY in the candidate data.',
    '7. confidence is an integer from 0 to 100.',
    '8. riskFlags is an array of short strings; use an empty array when there ' +
      'is no concern.',
    '9. suggestedNextAction is a short imperative string (e.g. "Send intro invite").',
    '10. If keywords are provided for a role, treat them as high-priority ' +
      'signals. Candidates who match more keywords should rank higher for ' +
      'that role. Mention matched keywords in the reason field where relevant.',
    '',
    'Return ONLY raw JSON of this exact shape:',
    '{',
    '  "participants": [',
    '    {',
    '      "userId": "string",',
    '      "suggestedRole": "Mentor|Partner|Startup/Company|Service Provider|Programme Admin",',
    '      "relationshipType": "mentor_match|partner_linkage|service_support|programme_fit|participant_orchestration",',
    '      "reason": "string",',
    '      "confidence": 0,',
    '      "riskFlags": ["string"],',
    '      "suggestedNextAction": "string",',
    '      "bonus": false',
    '    }',
    '  ]',
    '}',
  ].join('\n');
}
