/** Small pill that renders an invite's status: pending / confirmed / declined. */
import type { InviteStatus } from '../types'

const STYLES: Record<InviteStatus, { label: string; classes: string }> = {
  pending: {
    label: 'Pending',
    classes: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  confirmed: {
    label: 'Confirmed',
    classes: 'bg-green-100 text-green-800 border-green-200',
  },
  declined: {
    label: 'Declined',
    classes: 'bg-red-100 text-red-700 border-red-200',
  },
}

interface InviteStatusBadgeProps {
  status: InviteStatus
}

export default function InviteStatusBadge({ status }: InviteStatusBadgeProps) {
  const style = STYLES[status] ?? STYLES.pending
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.classes}`}
    >
      {style.label}
    </span>
  )
}
