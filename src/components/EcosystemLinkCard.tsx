/**
 * EcosystemLinkCard — renders one reusable ecosystem relationship.
 *
 * Shows the source actor, target actor, relationship type, context, status,
 * confidence and the reusable tags carried by the link.
 */
import type { EcosystemLink, EcosystemLinkStatus } from '../types'

interface EcosystemLinkCardProps {
  link: EcosystemLink
}

const STATUS_STYLES: Record<EcosystemLinkStatus, string> = {
  suggested: 'bg-gray-100 text-gray-600 border-gray-200',
  invited: 'bg-blue-100 text-blue-700 border-blue-200',
  active: 'bg-green-100 text-green-800 border-green-200',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  declined: 'bg-red-100 text-red-700 border-red-200',
  archived: 'bg-gray-100 text-gray-500 border-gray-200',
}

/** Confidence badge tone: green >= 80, yellow >= 60, red < 60. */
function confidenceClasses(value: number): string {
  if (value >= 80) return 'bg-green-100 text-green-800 border-green-200'
  if (value >= 60) return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-red-100 text-red-700 border-red-200'
}

function shortActor(id: string): string {
  return id.length > 14 ? `${id.slice(0, 12)}…` : id
}

export default function EcosystemLinkCard({ link }: EcosystemLinkCardProps) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
            STATUS_STYLES[link.status] ?? STATUS_STYLES.suggested
          }`}
        >
          {link.status}
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${confidenceClasses(
            link.confidence,
          )}`}
        >
          {link.confidence}% confidence
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm">
        <span className="rounded-lg bg-blue-50 px-2.5 py-1 font-medium text-blue-700">
          {shortActor(link.sourceUserId)}
          <span className="ml-1 text-xs text-blue-400">({link.sourceType})</span>
        </span>
        <span className="text-gray-400">→</span>
        <span className="rounded-lg bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700">
          {shortActor(link.targetUserId)}
          <span className="ml-1 text-xs text-indigo-400">
            ({link.targetType})
          </span>
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-gray-400">Relationship</dt>
          <dd className="font-medium text-gray-700">{link.relationshipType}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Context</dt>
          <dd className="font-medium text-gray-700">
            {link.contextName}{' '}
            <span className="text-gray-400">({link.contextType})</span>
          </dd>
        </div>
      </dl>

      {link.aiReason && (
        <p className="mt-3 text-sm text-gray-600">{link.aiReason}</p>
      )}

      {typeof link.outcomeScore === 'number' && (
        <p className="mt-2 text-xs font-medium text-emerald-700">
          Outcome score: {link.outcomeScore}
        </p>
      )}

      {link.reusableTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {link.reusableTags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}
