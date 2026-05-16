/**
 * onCall: extracts a structured ecosystem profile from whatever the user
 * pastes during onboarding — a LinkedIn URL, a website URL and/or a free-text
 * bio. Gemini 1.5 Flash does the inference in a single call.
 *
 * This function is read-only: it returns the extracted profile to the client
 * and does NOT write to Firestore. The client persists the confirmed profile
 * onto `users/{uid}` after the user reviews it on onboarding step 3.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { callGemini } from './callGemini';
import type { InferredStage } from './types';

const REGION = 'asia-southeast1';

interface ExtractUserProfileInput {
  linkedinUrl?: string;
  websiteUrl?: string;
  bio?: string;
}

interface ExtractedProfile {
  headline: string;
  bio: string;
  inferredSector: string[];
  inferredExpertise: string[];
  inferredStage: InferredStage;
  contributionSignals: string[];
  profileCompleteness: number;
}

const VALID_STAGES: InferredStage[] = [
  'pre-seed',
  'seed',
  'series-a',
  'growth',
  'established',
  'ecosystem',
];

/** Coerces an unknown value into a trimmed, de-duplicated string array. */
function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const cleaned = value
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);
  return [...new Set(cleaned)];
}

/** Builds the single Gemini prompt used for profile extraction. */
function buildPrompt(input: ExtractUserProfileInput): string {
  const linkedinUrl = input.linkedinUrl || 'not provided';
  const websiteUrl = input.websiteUrl || 'not provided';
  const bio = input.bio || 'not provided';

  return `You are an AI profile analyst for an innovation ecosystem platform called EcoGraph AI.
Your job is to extract structured profile data from the user's input.

USER INPUT:
LinkedIn URL: ${linkedinUrl}
Website URL: ${websiteUrl}
Bio / Description: ${bio}

RULES:
1. Infer all fields from available information only. Do not invent details.
2. If evidence is insufficient for a field, return an empty array or the lowest confidence stage.
3. headline must be a single short sentence (max 12 words).
4. bio must be 2-3 plain English sentences summarising who the person is and what they offer.
5. inferredSector: choose from FinTech, HealthTech, AgriTech, SaaS, EdTech, Cybersecurity, Supply Chain, Government, Deep Tech, CleanTech, PropTech, Retail, Other.
6. inferredExpertise: free-form skill tags (max 6).
7. inferredStage: one of pre-seed, seed, series-a, growth, established, ecosystem.
8. contributionSignals: what the person can offer (max 5). Examples: Mentorship, Investment, Partnership, Market Access, Technical Advisory, Policy, B2B Sales, Regulatory Guidance.
9. profileCompleteness: integer 0-100. Score based on how much you could infer. 80+ = strong profile.
10. Return only valid JSON. No markdown.

Return this exact JSON:
{
  "headline": "string",
  "bio": "string",
  "inferredSector": ["string"],
  "inferredExpertise": ["string"],
  "inferredStage": "pre-seed|seed|series-a|growth|established|ecosystem",
  "contributionSignals": ["string"],
  "profileCompleteness": 0
}`;
}

/** True when the parsed payload carries every field the client expects. */
function hasProfileShape(parsed: any): boolean {
  return (
    !!parsed &&
    typeof parsed === 'object' &&
    typeof parsed.headline === 'string' &&
    typeof parsed.bio === 'string' &&
    Array.isArray(parsed.inferredSector) &&
    Array.isArray(parsed.inferredExpertise) &&
    typeof parsed.inferredStage === 'string' &&
    Array.isArray(parsed.contributionSignals)
  );
}

/** Clamps and normalizes the raw Gemini payload into an ExtractedProfile. */
function normalizeProfile(parsed: any): ExtractedProfile {
  const stage = String(parsed.inferredStage) as InferredStage;
  const completeness = Number(parsed.profileCompleteness ?? 0);
  return {
    headline: String(parsed.headline ?? '').trim(),
    bio: String(parsed.bio ?? '').trim(),
    inferredSector: asStringArray(parsed.inferredSector).slice(0, 6),
    inferredExpertise: asStringArray(parsed.inferredExpertise).slice(0, 6),
    inferredStage: VALID_STAGES.includes(stage) ? stage : 'pre-seed',
    contributionSignals: asStringArray(parsed.contributionSignals).slice(0, 5),
    profileCompleteness: Number.isFinite(completeness)
      ? Math.max(0, Math.min(100, Math.round(completeness)))
      : 0,
  };
}

export const extractUserProfile = onCall(
  { region: REGION, secrets: ['GEMINI_API_KEY'] },
  async (request): Promise<ExtractedProfile> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.');
    }

    const data = (request.data ?? {}) as ExtractUserProfileInput;
    const linkedinUrl =
      typeof data.linkedinUrl === 'string' ? data.linkedinUrl.trim() : '';
    const websiteUrl =
      typeof data.websiteUrl === 'string' ? data.websiteUrl.trim() : '';
    const bio = typeof data.bio === 'string' ? data.bio.trim() : '';

    if (!linkedinUrl && !websiteUrl && !bio) {
      throw new HttpsError(
        'invalid-argument',
        'Provide at least one of: linkedinUrl, websiteUrl or bio.',
      );
    }

    const prompt = buildPrompt({ linkedinUrl, websiteUrl, bio });

    // callGemini already retries once on a JSON parse failure. Here we retry
    // once more for a response that is valid JSON but structurally wrong.
    let parsed = await callGemini(prompt);
    if (!hasProfileShape(parsed)) {
      console.error('extractUserProfile: unexpected response shape, retrying');
      parsed = await callGemini(
        `${prompt}\nIMPORTANT: return only raw JSON, no markdown.`,
      );
    }
    if (!hasProfileShape(parsed)) {
      throw new HttpsError(
        'internal',
        'Gemini returned an unexpected profile shape.',
      );
    }

    return normalizeProfile(parsed);
  },
);
