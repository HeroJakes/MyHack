/**
 * Thin, reusable wrapper around Gemini 1.5 Flash.
 *
 * Pure helper: it does not touch Firestore or request auth. It strips markdown
 * fences, parses JSON, validates the shape, and retries once with a stricter
 * instruction before giving up.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';

const MODEL = 'gemini-1.5-flash';

/** Removes ```json fences and stray ``` markers from a model response. */
function stripFences(raw: string): string {
  return raw
    .replace(/```json?\n?/g, '')
    .replace(/```/g, '')
    .trim();
}

/** Default validator — the participant matching path expects a participants array. */
function defaultValidator(parsed: unknown): boolean {
  const value = parsed as { participants?: unknown };
  return !!value && Array.isArray(value.participants);
}

async function runModel(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpsError(
      'failed-precondition',
      'GEMINI_API_KEY secret is not configured. Set it before calling AI functions.',
    );
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Calls Gemini, parses the JSON response and validates it.
 *
 * @param prompt   the fully built prompt string.
 * @param validate returns true when the parsed payload has the expected shape.
 *                 Defaults to the participant-matching validator.
 */
export async function callGemini<T = Record<string, unknown>>(
  prompt: string,
  validate: (parsed: unknown) => boolean = defaultValidator,
): Promise<T> {
  const attempts = [
    prompt,
    `${prompt}\nIMPORTANT: return only raw JSON, no markdown.`,
  ];

  let lastError: unknown;
  for (let i = 0; i < attempts.length; i += 1) {
    try {
      const raw = await runModel(attempts[i]);
      const cleaned = stripFences(raw);
      const parsed = JSON.parse(cleaned) as T;
      if (!validate(parsed)) {
        throw new Error('Gemini response did not match the expected schema.');
      }
      return parsed;
    } catch (err) {
      lastError = err;
      logger.warn(`Gemini attempt ${i + 1} failed`, { error: String(err) });
    }
  }

  throw new HttpsError(
    'internal',
    `Gemini call failed after retry: ${(lastError as Error)?.message ?? 'unknown error'}`,
  );
}
