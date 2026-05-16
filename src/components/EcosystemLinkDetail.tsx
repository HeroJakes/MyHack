/**
 * EcosystemLinkDetail — the "Selected Link Details" panel.
 *
 * Renders whichever link is selected in the table; the source actor is the
 * primary profile and the target actor is shown under "Linked with".
 */
import type { ResolvedEcosystemLink } from '../hooks/useEcosystemLinks'
import {
  RELATIONSHIP_TYPE_CONFIG,
  STATUS_CONFIG,
  UNKNOWN_BADGE,
  confidenceColor,
  formatLinkDate,
} from '../lib/badgeConfigs'
import {
  Calendar,
  ExternalLink,
  Info,
  Link2,
  Shield,
  Sparkles,
} from './icons'

interface EcosystemLinkDetailProps {
  link: ResolvedEcosystemLink | null
  onMarkCompleted: (linkId: string) => void
  onViewContext: (contextId: string) => void
}

/** Two-letter initials from the first and last word of a name. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

export default function EcosystemLinkDetail({
  link,
  onMarkCompleted,
  onViewContext,
}: EcosystemLinkDetailProps) {
  if (!link) {
    return (
      <div className="flex min-h-[300px] min-w-0 flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white p-5 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-gray-100 text-gray-400">
          <Link2 className="h-7 w-7" />
        </div>
        <p className="max-w-xs text-sm text-gray-500">
          Select a link from the table to view details.
        </p>
      </div>
    )
  }

  const relationship =
    RELATIONSHIP_TYPE_CONFIG[link.relationshipType] ?? UNKNOWN_BADGE
  const status = STATUS_CONFIG[link.status] ?? UNKNOWN_BADGE
  const isCompleted = link.status === 'completed'

  return (
    <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">
          Selected Link Details
        </h2>
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      {/* Source actor. */}
      <div className="mt-4 flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-purple-100 text-sm font-bold text-purple-700">
          {initials(link.sourceUserName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-gray-900">
            {link.sourceUserName}
          </p>
          <p className="truncate text-sm text-gray-500">{link.sourceUserRole}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${relationship.className}`}
        >
          {relationship.label}
        </span>
      </div>

      {/* Target actor. */}
      <p className="mt-5 text-xs font-bold uppercase tracking-wide text-gray-400">
        Linked with
      </p>
      <div className="mt-2 flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-green-100 text-xs font-bold text-green-700">
          {initials(link.targetUserName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-gray-900">
            {link.targetUserName}
          </p>
          <p className="truncate text-sm text-gray-500">{link.targetUserRole}</p>
        </div>
      </div>

      {/* Metadata grid. */}
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="flex items-start gap-2">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <div className="min-w-0">
            <dt className="text-xs text-gray-400">Context</dt>
            <dd className="truncate text-sm font-semibold text-gray-800">
              {link.contextName}
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <div className="min-w-0">
            <dt className="text-xs text-gray-400">Field</dt>
            <dd className="truncate text-sm font-semibold text-gray-800">
              {link.field || '—'}
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <div className="min-w-0">
            <dt className="text-xs text-gray-400">Confidence Score</dt>
            <dd
              className={`flex items-center gap-1 text-sm font-bold ${confidenceColor(
                link.confidence,
              )}`}
            >
              <Shield className="h-3.5 w-3.5 text-green-600" />
              {link.confidence}%
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <div className="min-w-0">
            <dt className="text-xs text-gray-400">Linked on</dt>
            <dd className="truncate text-sm font-semibold text-gray-800">
              {formatLinkDate(link.createdAt)}
            </dd>
          </div>
        </div>
      </dl>

      {/* AI reason. */}
      <div className="mt-5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <span className="text-xs font-bold uppercase tracking-wide text-gray-400">
            AI Reason
          </span>
        </div>
        <p className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm italic leading-6 text-indigo-900">
          {link.aiReason || 'No AI reasoning recorded for this link.'}
        </p>
      </div>

      {/* Reusable tags. */}
      {link.reusableTags.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
            Reusable Tags
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {link.reusableTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions. */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onViewContext(link.contextId)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          View Context
          <ExternalLink className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={isCompleted}
          onClick={() => onMarkCompleted(link.id)}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isCompleted ? 'Completed' : 'Mark as Completed'}
        </button>
      </div>
    </div>
  )
}
