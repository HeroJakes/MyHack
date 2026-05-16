/**
 * Thin, reusable wrapper around Gemini on Vertex AI.
 *
 * This uses the Cloud Function runtime service account / ADC, so requests are
 * billed through the Google Cloud project instead of the Gemini Developer API
 * free-tier key. callGemini accepts either a plain text prompt or an ordered
 * list of multimodal parts (text + inline files).
 *
 * The model is configured with responseMimeType 'application/json', so Gemini
 * should return raw JSON. callGemini strips any stray markdown fences, parses
 * the JSON and retries once on parse failure. It does NOT validate the response
 * shape; each caller owns that check.
 */
import { GoogleGenAI } from '@google/genai';
import type { ContentListUnion, GenerateContentConfig, Part } from '@google/genai';
import { HttpsError } from 'firebase-functions/v2/https';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_LOCATION = 'global';

/** A prompt is either plain text or an ordered list of multimodal parts. */
export type GeminiPrompt = string | Array<string | Part>;

let client: GoogleGenAI | null = null;

function getProjectId(): string {
  const projectId =
    process.env.VERTEX_AI_PROJECT?.trim() ||
    process.env.GEMINI_PROJECT?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.GCLOUD_PROJECT?.trim() ||
    process.env.GCP_PROJECT?.trim();
  if (!projectId) {
    throw new HttpsError('internal', 'Vertex AI project is not configured.');
  }
  return projectId;
}

/** Builds the Vertex AI Gemini client at invocation time. */
function getClient() {
  if (!client) {
    console.info(
      `callGemini: using Vertex AI project=${getProjectId()} location=${
        process.env.GOOGLE_CLOUD_LOCATION?.trim() || DEFAULT_LOCATION
      }`,
    );
    client = new GoogleGenAI({
      vertexai: true,
      project: getProjectId(),
      location: process.env.GOOGLE_CLOUD_LOCATION?.trim() || DEFAULT_LOCATION,
    });
  }
  return client;
}

function normalizePrompt(prompt: GeminiPrompt): ContentListUnion {
  return typeof prompt === 'string' ? prompt : prompt;
}

export function getGeminiModelName() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

/**
 * Calls Gemini and returns the parsed JSON response.
 *
 * On a JSON parse failure it retries exactly once by resending the original
 * prompt. If the response is still malformed it throws HttpsError('internal').
 * The parsed object is returned as-is; shape validation is the caller's job.
 */
export async function callGemini(
  prompt: GeminiPrompt,
  config: Pick<GenerateContentConfig, 'responseSchema'> = {},
  attempt = 0,
): Promise<any> {
  let result;
  try {
    result = await getClient().models.generateContent({
      model: getGeminiModelName(),
      contents: normalizePrompt(prompt),
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        ...config,
      },
    });
  } catch (err: any) {
    const status = Number(err?.status ?? err?.code);
    if (status === 400 || status === 3) {
      if (config.responseSchema) {
        console.warn(
          'callGemini: Vertex AI rejected responseSchema; retrying without schema.',
        );
        return callGemini(prompt, {}, attempt);
      }
      throw new HttpsError(
        'invalid-argument',
        'Vertex AI rejected the Gemini request configuration.',
      );
    }
    if (status === 429 || status === 8) {
      throw new HttpsError(
        'resource-exhausted',
        'Gemini quota is exhausted. Please try again later or enable billing / increase quota for this Firebase project.',
      );
    }
    if (status === 403 || status === 7) {
      throw new HttpsError(
        'permission-denied',
        'Vertex AI Gemini is not enabled or the function service account lacks access.',
      );
    }
    console.error('callGemini: Gemini request failed', err);
    throw new HttpsError(
      'unavailable',
      'Gemini is currently unavailable. Please try again later.',
    );
  }

  const raw = result.text ?? '';
  const clean = raw
    .replace(/```json\n?/g, '')
    .replace(/```/g, '')
    .trim();

  try {
    return JSON.parse(clean);
  } catch (err) {
    console.error(`callGemini: JSON parse failed on attempt ${attempt}`, err);
    if (attempt === 0) {
      return callGemini(prompt, config, 1);
    }
    throw new HttpsError(
      'internal',
      'Gemini returned malformed JSON after retry',
    );
  }
}
