/**
 * Thin, reusable wrapper around Gemini Flash.
 *
 * The GEMINI_API_KEY secret is injected into process.env only at function
 * invocation time, so the SDK is initialized lazily inside getModel() — never
 * at module load. callGemini accepts either a plain text prompt or an ordered
 * list of multimodal parts (text + inline files), strips markdown fences,
 * parses JSON and retries once on a parse failure. It does NOT validate the
 * response shape; that is the caller's responsibility.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Part } from '@google/generative-ai';
import { HttpsError } from 'firebase-functions/v2/https';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEPRECATED_MODELS = new Set(['gemini-1.5-flash']);

/** A prompt is either plain text or an ordered list of multimodal parts. */
export type GeminiPrompt = string | Array<string | Part>;

const STRICT_JSON_HINT = '\nIMPORTANT: return only raw JSON, no markdown.';

/**
 * Builds the Gemini model at invocation time, when the secret is guaranteed
 * to be present on process.env. Never call this at module load.
 */
function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpsError('internal', 'GEMINI_API_KEY secret is not set');
  }
  const configuredModel = process.env.GEMINI_MODEL?.trim();
  const model =
    configuredModel && !DEPRECATED_MODELS.has(configuredModel)
      ? configuredModel
      : DEFAULT_MODEL;

  if (configuredModel && configuredModel !== model) {
    console.warn(
      `GEMINI_MODEL=${configuredModel} is deprecated; using ${model} instead.`,
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model,
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  });
}

/**
 * Calls Gemini and returns the parsed JSON response.
 *
 * On a JSON parse failure it retries exactly once with a stricter instruction,
 * then throws HttpsError('internal') if the response is still malformed. The
 * parsed object is returned as-is — shape validation is the caller's job.
 */
export async function callGemini(
  prompt: GeminiPrompt,
  attempt = 0,
): Promise<any> {
  const result = await getModel().generateContent(prompt);
  const raw = result.response.text();
  const cleaned = raw
    .replace(/```json?\n?/g, '')
    .replace(/```/g, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error(`callGemini: JSON parse failed on attempt ${attempt}`, err);
    if (attempt === 0) {
      const retry: GeminiPrompt =
        typeof prompt === 'string'
          ? prompt + STRICT_JSON_HINT
          : [...prompt, STRICT_JSON_HINT];
      return callGemini(retry, 1);
    }
    throw new HttpsError(
      'internal',
      'Gemini returned malformed JSON after retry',
    );
  }
}
