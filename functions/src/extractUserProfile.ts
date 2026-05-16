/**
 * onCall: extracts a structured ecosystem profile from the user's onboarding
 * input — an uploaded CV / resume (PDF or image) and/or a free-text bio.
 * Gemini 1.5 Flash reads the file directly (multimodal) in a single call.
 *
 * This function is read-only: it returns the extracted profile to the client
 * and does NOT write to Firestore. The client persists the confirmed profile
 * onto `users/{uid}` after the user reviews it on onboarding step 3.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { Part } from '@google/genai';
import { callGemini } from './callGemini';
import type { InferredStage } from './types';

const REGION = 'asia-southeast1';

/** A résumé / CV uploaded by the user, carried as base64 inline data. */
interface CvFile {
  mimeType: string;
  data: string;
}

interface ExtractUserProfileInput {
  cvFile?: CvFile;
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

/** MIME types Gemini 1.5 Flash can read directly as inline data. */
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];

/** ~10 MB cap on the decoded file — generous for any résumé. */
const MAX_CV_BYTES = 10 * 1024 * 1024;

/** Coerces an unknown value into a trimmed, de-duplicated string array. */
function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const cleaned = value
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);
  return [...new Set(cleaned)];
}

/** Approximate decoded byte length of a base64 string. */
function base64Bytes(data: string): number {
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return Math.floor((data.length * 3) / 4) - padding;
}

/** Builds the text portion of the Gemini prompt. */
function buildPrompt(bio: string, hasCv: boolean): string {
  const sourceLine = hasCv
    ? "The user's resume / CV is attached as a file. Read the whole document carefully and base your answer on it."
    : 'Base your answer on the notes below.';
  const bioBlock = bio
    ? `Notes provided by the user:\n"""\n${bio}\n"""`
    : 'The user did not provide any additional notes.';

  return `You are an AI profile analyst for an innovation ecosystem platform called PoyoLink.
Your job is to extract structured profile data from the user's resume / CV and notes.

${sourceLine}

${bioBlock}

RULES:
1. Infer all fields from the resume and notes only. Do not invent details.
2. If evidence is insufficient for a field, return an empty array, an empty string, or the lowest confidence stage.
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

/** Assembles the multimodal prompt parts (text, then the CV file if present). */
function buildParts(
  bio: string,
  cvFile: CvFile | null,
  strict: boolean,
): Array<string | Part> {
  const text =
    buildPrompt(bio, !!cvFile) +
    (strict ? '\nIMPORTANT: return only raw JSON, no markdown.' : '');
  const parts: Array<string | Part> = [text];
  if (cvFile) {
    const filePart: Part = {
      inlineData: { mimeType: cvFile.mimeType, data: cvFile.data },
    };
    parts.push(filePart);
  }
  return parts;
}

/**
 * True when the parsed payload is structurally usable. headline, bio and stage
 * are normalized with safe defaults, so the real contract is just an object
 * carrying the three tag arrays.
 */
function hasProfileShape(parsed: any): boolean {
  return (
    !!parsed &&
    typeof parsed === 'object' &&
    Array.isArray(parsed.inferredSector) &&
    Array.isArray(parsed.inferredExpertise) &&
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
  { region: REGION },
  async (request): Promise<ExtractedProfile> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.');
    }

    const data = (request.data ?? {}) as ExtractUserProfileInput;
    const bio = typeof data.bio === 'string' ? data.bio.trim() : '';

    let cvFile: CvFile | null = null;
    if (data.cvFile && typeof data.cvFile === 'object') {
      const { mimeType, data: fileData } = data.cvFile;
      if (
        typeof mimeType !== 'string' ||
        typeof fileData !== 'string' ||
        !fileData
      ) {
        throw new HttpsError(
          'invalid-argument',
          'The uploaded CV file is malformed.',
        );
      }
      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        throw new HttpsError(
          'invalid-argument',
          'Unsupported file type. Upload a PDF, PNG or JPG.',
        );
      }
      if (base64Bytes(fileData) > MAX_CV_BYTES) {
        throw new HttpsError(
          'invalid-argument',
          'That file is too large. Please upload a CV under 10 MB.',
        );
      }
      cvFile = { mimeType, data: fileData };
    }

    if (!cvFile && !bio) {
      throw new HttpsError(
        'invalid-argument',
        'Upload a CV or provide a bio.',
      );
    }

    // callGemini retries once on a JSON parse failure. Here we retry once more
    // for a response that is valid JSON but structurally wrong.
    let parsed = await callGemini(buildParts(bio, cvFile, false));
    if (!hasProfileShape(parsed)) {
      console.error('extractUserProfile: unexpected response shape, retrying');
      parsed = await callGemini(buildParts(bio, cvFile, true));
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
