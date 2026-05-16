/**
 * ContextSummaryPanel — the fixed 320px right rail of the context detail page.
 *
 * Stacks three sections: an "Edit Context Details" action, an invite-status
 * summary, and a preview of the strongest ecosystem links. Purely
 * presentational — all counts and links are computed by the parent from live
 * Firestore listeners.
 */
import { confidenceColor } from '../lib/confidence'
import type { EcosystemLink, EcosystemLinkStatus, User } from '../types'

interface ContextSummaryPanelProps {
  pending: number
  confirmed: number
  declined: number
  totalInvites: number
  /** Strongest ecosystem links, already sorted by confidence descending. */
  topLinks: EcosystemLink[]
  userMap: Map<string, User>
  onEditContext: () => void
  onViewAllLinks: () => void
}

/** Pill classes per ecosystem-link status (same family as invite statuses). */
const LINK_STATUS_CLASSES: Record<EcosystemLinkStatus, string> = {
  suggested: 'bg-gray-100 text-gray-600',
  invited: 'bg-amber-100 text-amber-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-700',
  declined: 'bg-red-100 text-red-700',
  archived: 'bg-gray-100 text-gray-500',
}

function linkStatusClass(status: EcosystemLinkStatus): string {
  return LINK_STATUS_CLASSES[status] ?? 'bg-gray-100 text-gray-600'
}

export default function ContextSummaryPanel({
  pending,
  confirmed,
  declined,
  totalInvites,
  topLinks,
  userMap,
  onEditContext,
  onViewAllLinks,
}: ContextSummaryPanelProps) {
  return (
    <aside className="space-y-4 lg:w-80 lg:shrink-0">
      {/* Section 1 — Edit action */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <button
          type="button"
          onClick={onEditContext}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          Edit Context Details
        </button>
      </section>

      {/* Section 2 — Invite Tracking Summary */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-950">
          Invite Tracking Summary
        </h3>
        <ul className="mt-3 space-y-2 text-sm">
          <SummaryRow color="bg-amber-400" label="Pending" count={pending} />
          <SummaryRow color="bg-green-500" label="Confirmed" count={confirmed} />
          <SummaryRow color="bg-red-500" label="Declined" count={declined} />
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
          <span className="text-sm font-semibold text-gray-700">
            Total Invites Sent
          </span>
          <span className="text-sm font-black text-gray-950">
            {totalInvites}
          </span>
        </div>
      </section>

      {/* Section 3 — Ecosystem Links Preview */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-950">
          Ecosystem Links Preview
        </h3>
        {topLinks.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500">
            No ecosystem links yet.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  <th className="pb-1.5 pr-2 font-bold">Target Actor</th>
                  <th className="pb-1.5 pr-2 font-bold">Type</th>
                  <th className="pb-1.5 pr-2 font-bold">Status</th>
                  <th className="pb-1.5 font-bold">Conf.</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {topLinks.map((link) => {
                  const target = userMap.get(link.targetUserId)
                  return (
                    <tr key={link.id} className="border-t border-gray-50">
                      <td className="py-1.5 pr-2 font-semibold text-gray-900">
                        {target?.name ?? 'Unknown'}
                      </td>
                      <td className="py-1.5 pr-2">
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                          {link.relationshipType}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize ${linkStatusClass(
                            link.status,
                          )}`}
                        >
                          {link.status}
                        </span>
                      </td>
                      <td
                        className={`py-1.5 font-bold ${confidenceColor(
                          link.confidence,
                        )}`}
                      >
                        {link.confidence}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <button
          type="button"
          onClick={onViewAllLinks}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          View all ecosystem links
          <span aria-hidden>→</span>
        </button>
      </section>
    </aside>
  )
}

function SummaryRow({
  color,
  label,
  count,
}: {
  color: string
  label: string
  count: number
}) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-gray-600">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} aria-hidden />
        {label}
      </span>
      <span className="font-semibold text-gray-900">{count}</span>
    </li>
  )
}
