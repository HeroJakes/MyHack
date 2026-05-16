/**
 * ParticipantCard — renders one AI participant suggestion.
 *
 * Shows name, headline, suggested role, relationship type, confidence badge,
 * reason, risk flags, suggested next action and a select checkbox so the
 * organizer can pick who to invite.
 */
import type { ParticipantSuggestion } from '../types'

interface ParticipantCardProps {
  suggestion: ParticipantSuggestion
  selected: boolean
  onToggle: (id: string) => void
}

/** Confidence badge tone: green >= 80, yellow >= 60, red < 60. */
function confidenceClasses(value: number): string {
  if (value >= 80) return 'bg-green-100 text-green-800 border-green-200'
  if (value >= 60) return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-red-100 text-red-700 border-red-200'
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function ParticipantCard({
  suggestion,
  selected,
  onToggle,
}: ParticipantCardProps) {
  return (
    <article
      className={`relative rounded-2xl border bg-white p-4 shadow-sm transition-colors ${
        selected ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start gap-3">
        {suggestion.photoURL ? (
          <img
            src={suggestion.photoURL}
            alt={suggestion.name}
            className="h-11 w-11 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
            {initials(suggestion.name) || '?'}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-base font-semibold text-gray-900">
              {suggestion.name}
            </h3>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${confidenceClasses(
                suggestion.confidence,
              )}`}
            >
              {suggestion.confidence}% match
            </span>
          </div>
          <p className="truncate text-sm text-gray-500">
            {suggestion.headline || 'No headline'}
          </p>
        </div>

        <label className="flex shrink-0 cursor-pointer items-center">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(suggestion.id)}
            className="h-5 w-5 accent-blue-600"
            aria-label={`Select ${suggestion.name}`}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
          {suggestion.suggestedRole}
        </span>
        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {suggestion.relationshipType}
        </span>
        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
          Rank #{suggestion.rank}
        </span>
      </div>

      <p className="mt-3 text-sm text-gray-700">{suggestion.reason}</p>

      {suggestion.riskFlags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestion.riskFlags.map((flag) => (
            <span
              key={flag}
              className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
            >
              ⚠ {flag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
        <span className="font-semibold text-gray-700">Next action:</span>{' '}
        {suggestion.suggestedNextAction}
      </div>
    </article>
  )
}
