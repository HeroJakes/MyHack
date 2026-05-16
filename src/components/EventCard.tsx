/** EventCard — compact summary of an event/context, links to its detail page. */
import { Link } from 'react-router-dom'
import type { EcoEvent, EventStatus } from '../types'

interface EventCardProps {
  event: EcoEvent
}

const STATUS_STYLES: Record<EventStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  open: 'bg-green-100 text-green-700',
  closed: 'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700',
}

export default function EventCard({ event }: EventCardProps) {
  const totalNeeded = event.roleRequirements.reduce(
    (sum, need) => sum + need.count,
    0,
  )

  return (
    <Link
      to={`/events/${event.id}`}
      className="block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900">{event.name}</h3>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
            STATUS_STYLES[event.status] ?? STATUS_STYLES.draft
          }`}
        >
          {event.status}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className="rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
          {event.field}
        </span>
        <span className="rounded-md bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
          {event.type}
        </span>
        <span className="rounded-md bg-gray-100 px-2 py-0.5 font-medium text-gray-500">
          {event.contextType}
        </span>
      </div>

      {event.description && (
        <p className="mt-2 line-clamp-2 text-sm text-gray-600">
          {event.description}
        </p>
      )}

      <p className="mt-3 text-xs text-gray-500">
        {event.roleRequirements.length} relationship need
        {event.roleRequirements.length === 1 ? '' : 's'} · {totalNeeded} role
        {totalNeeded === 1 ? '' : 's'} to fill
      </p>
    </Link>
  )
}
