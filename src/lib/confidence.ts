/**
 * Shared confidence helpers.
 *
 * Confidence is an integer 0-100. The tone thresholds are: green at 80+,
 * amber at 60-79, red below 60 — used across the context detail UI.
 */

/** Tailwind text-color class for a confidence score. */
export function confidenceColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-amber-500'
  return 'text-red-500'
}
