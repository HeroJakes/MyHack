/**
 * ContextStatCards — the five live stat cards shown on the context detail
 * page (Invites Sent, Confirmed, Pending, AI Recommendations, Average
 * Confidence). Purely presentational: every count is computed by the parent
 * from live Firestore listeners and passed down as props.
 */
import type { ReactNode } from 'react'

interface ContextStatCardsProps {
  invitesSent: number
  confirmed: number
  pending: number
  aiRecommendations: number
  /** Average confidence across all suggestions, or null when there are none. */
  averageConfidence: number | null
}

interface StatItem {
  key: string
  label: string
  value: string
  tone: string
  icon: ReactNode
}

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export default function ContextStatCards({
  invitesSent,
  confirmed,
  pending,
  aiRecommendations,
  averageConfidence,
}: ContextStatCardsProps) {
  const items: StatItem[] = [
    {
      key: 'sent',
      label: 'Invites Sent',
      value: String(invitesSent),
      tone: 'bg-blue-50 text-blue-600',
      icon: (
        <svg className="h-4 w-4" {...ICON_PROPS}>
          <path d="M22 2 11 13" />
          <path d="M22 2 15 22l-4-9-9-4Z" />
        </svg>
      ),
    },
    {
      key: 'confirmed',
      label: 'Confirmed',
      value: String(confirmed),
      tone: 'bg-green-50 text-green-600',
      icon: (
        <svg className="h-4 w-4" {...ICON_PROPS}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <path d="m9 11 3 3L22 4" />
        </svg>
      ),
    },
    {
      key: 'pending',
      label: 'Pending',
      value: String(pending),
      tone: 'bg-amber-50 text-amber-600',
      icon: (
        <svg className="h-4 w-4" {...ICON_PROPS}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
      ),
    },
    {
      key: 'ai',
      label: 'AI Recommendations',
      value: String(aiRecommendations),
      tone: 'bg-purple-50 text-purple-600',
      icon: (
        <svg className="h-4 w-4" {...ICON_PROPS}>
          <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
        </svg>
      ),
    },
    {
      key: 'confidence',
      label: 'Average Confidence',
      value: averageConfidence === null ? '—' : `${averageConfidence}%`,
      tone: 'bg-emerald-50 text-emerald-600',
      icon: (
        <svg className="h-4 w-4" {...ICON_PROPS}>
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M17 7h4v4" />
        </svg>
      ),
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.key}
          className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
        >
          <span
            className={`grid h-8 w-8 place-items-center rounded-full ${item.tone}`}
          >
            {item.icon}
          </span>
          <p className="mt-2 text-xl font-black tracking-tight text-slate-950">
            {item.value}
          </p>
          <p className="text-[11px] font-bold text-slate-500">{item.label}</p>
        </div>
      ))}
    </div>
  )
}
