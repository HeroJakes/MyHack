/**
 * onCall: infers a structured profile (sector, expertise, stage, contribution
 * signals) from a free-text bio using Gemini, then merges it onto the caller's
 * user document.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { callGemini } from './callGemini';
import type { InferredStage } from './types';

const REGION = 'asia-southeast1';

interface ProfilePayload {
  profile?: {
    inferredSector?: unknown;
    inferredExpertise?: unknown;
    inferredStage?: unknown;
    contributionSignals?: unknown;
    profileCompleteness?: unknown;
  };
}

const VALID_STAGES: InferredStage[] = [
  'pre-seed',
  'seed',
  'series-a',
  'growth',
  'established',
  'ecosystem',
];

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}

export const extractUserProfile = onCall(
  { region: REGION, secrets: ['GEMINI_API_KEY'] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.');
    }

    const bio = request.data?.bio;
    if (!bio || typeof bio !== 'string') {
      throw new HttpsError('invalid-argument', 'A non-empty "bio" string is required.');
    }

    const prompt = [
      'You are EcoGraph AI. Infer a structured ecosystem profile from the bio below.',
      `Bio: """${bio}"""`,
      '',
      'Return ONLY raw JSON of this exact shape:',
      '{ "profile": {',
      '  "inferredSector": string[],',
      '  "inferredExpertise": string[],',
      '  "inferredStage": "pre-seed"|"seed"|"series-a"|"growth"|"established"|"ecosystem",',
      '  "contributionSignals": string[],',
      '  "profileCompleteness": number  // 0-100, how complete the bio is',
      '} }',
    ].join('\n');

    const parsed = await callGemini<ProfilePayload>(
      prompt,
      (p) => !!p && typeof p === 'object' && !!(p as ProfilePayload).profile,
    );
    const profile = parsed.profile ?? {};

    const stage = String(profile.inferredStage ?? 'seed') as InferredStage;
    const update = {
      inferredSector: asStringArray(profile.inferredSector),
      inferredExpertise: asStringArray(profile.inferredExpertise),
      inferredStage: VALID_STAGES.includes(stage) ? stage : 'seed',
      contributionSignals: asStringArray(profile.contributionSignals),
      profileCompleteness: Math.max(
        0,
        Math.min(100, Number(profile.profileCompleteness ?? 0)),
      ),
      bio,
      updatedAt: Timestamp.now(),
    };

    await getFirestore()
      .collection('users')
      .doc(request.auth.uid)
      .set(update, { merge: true });

    return { profile: update };
  },
);
