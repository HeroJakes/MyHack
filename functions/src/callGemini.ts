/**
 * Thin, reusable wrapper around Gemini 1.5 Flash.
 *
 * The GEMINI_API_KEY secret is injected into process.env only at function
 * invocation time, so the SDK is initialized lazily inside getModel() — never
 * at module load. callGemini strips markdown fences, parses JSON and retries
 * once on a parse failure. It does NOT validate the response shape; deciding
 * whether `participants` / `relationshipNeeds` / `profile` is present is the
 * caller's responsibility.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { HttpsError } from 'firebase-functions/v2/https';

const MODEL = 'gemini-1.5-flash';

/**
 * Builds the Gemini model at invocation time, when the secret is guaranteed
 * to be present on process.env. Never call this at module load.
 */
function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpsError('internal', 'GEMINI_API_KEY secret is not set');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: MODEL,
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
export async function callGemini(prompt: string, attempt = 0): Promise<any> {
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
      return callGemini(
        `${prompt}\nIMPORTANT: return only raw JSON, no markdown.`,
        1,
      );
    }
    throw new HttpsError(
      'internal',
      'Gemini returned malformed JSON after retry',
    );
  }
}
