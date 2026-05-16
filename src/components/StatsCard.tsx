/**
 * StatsCard — one stat tile in the Ecosystem Links stats row.
 *
 * Purely presentational: the icon, tone and copy are supplied by the parent.
 */
import type { ReactNode } from 'react'

interface StatsCardProps {
  /** Icon node, sized by the caller (e.g. `className="h-5 w-5"`). */
  icon: ReactNode
  /** Tailwind classes for the icon chip, e.g. `bg-purple-100 text-purple-600`. */
  iconTone: string
  /** Headline figure, e.g. `24` or `87%`. */
  value: string
  /** Short bold label below the figure. */
  label: string
  /** Muted one-line description. */
  description: string
}

export default function StatsCard({
  icon,
  iconTone,
  value,
  label,
  description,
}: StatsCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <span
        className={`grid h-9 w-9 place-items-center rounded-lg ${iconTone}`}
      >
        {icon}
      </span>
      <p className="mt-2.5 text-2xl font-black tracking-tight text-gray-950">
        {value}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-gray-800">{label}</p>
      <p className="text-xs text-gray-400">{description}</p>
    </div>
  )
}
