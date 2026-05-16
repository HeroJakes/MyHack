/**
 * EcosystemLinkCard — a single <tr> inside the Recent Ecosystem Links table.
 *
 * The three-dot action menu is rendered via a React portal attached to
 * document.body so it is NEVER clipped by `overflow-x-auto` or any ancestor
 * with `overflow: hidden`. Position is computed from the trigger button's
 * bounding rect so it still visually aligns with the row.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import type { ResolvedEcosystemLink } from '../hooks/useEcosystemLinks'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  link: ResolvedEcosystemLink
  isSelected: boolean
  onClick: (link: ResolvedEcosystemLink) => void
  onMarkCompleted?: (id: string) => void
  onArchive?: (id: string) => void
  onViewDetails?: (id: string) => void
  onRate?: (link: ResolvedEcosystemLink) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function confidenceColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 font-bold'
  if (score >= 60) return 'text-amber-500 font-bold'
  return 'text-red-500 font-bold'
}

function statusBadge(status: string): { bg: string; text: string; dot: string } {
  switch (status) {
    case 'active':
      return {
        bg: 'bg-emerald-50 border border-emerald-200',
        text: 'text-emerald-700',
        dot: 'bg-emerald-500',
      }
    case 'completed':
      return {
        bg: 'bg-blue-50 border border-blue-200',
        text: 'text-blue-700',
        dot: 'bg-blue-500',
      }
    case 'declined':
      return {
        bg: 'bg-red-50 border border-red-200',
        text: 'text-red-700',
        dot: 'bg-red-400',
      }
    case 'archived':
      return {
        bg: 'bg-gray-100 border border-gray-200',
        text: 'text-gray-500',
        dot: 'bg-gray-400',
      }
    case 'invited':
      return {
        bg: 'bg-violet-50 border border-violet-200',
        text: 'text-violet-700',
        dot: 'bg-violet-500',
      }
    default:
      return {
        bg: 'bg-gray-100 border border-gray-200',
        text: 'text-gray-500',
        dot: 'bg-gray-400',
      }
  }
}

function formatRelationshipType(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatDate(ts: { toDate?: () => Date } | Date | undefined): string {
  if (!ts) return '—'
  const date = typeof (ts as any).toDate === 'function'
    ? (ts as any).toDate()
    : ts instanceof Date
    ? ts
    : new Date()
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-blue-100 text-blue-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
]

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
}

function colorForName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'xs' }) {
  const color = colorForName(name)
  const dim = size === 'xs' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs'
  return (
    <div
      className={`${dim} ${color} grid shrink-0 place-items-center rounded-full font-bold`}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  )
}

// ─── Portal dropdown ──────────────────────────────────────────────────────────

interface DropdownItem {
  label: string
  icon: React.ReactNode
  onClick: () => void
  danger?: boolean
}

interface PortalDropdownProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  open: boolean
  onClose: () => void
  items: DropdownItem[]
}

function PortalDropdown({ anchorRef, open, onClose, items }: PortalDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState({ top: 0, left: 0 })

  // Position the dropdown just below + right-aligned to the trigger button.
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const dropdownWidth = 176 // w-44
    setCoords({
      top: rect.bottom + window.scrollY + 6,
      left: rect.right + window.scrollX - dropdownWidth,
    })
  }, [open, anchorRef])

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, onClose, anchorRef])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      ref={dropdownRef}
      role="menu"
      aria-orientation="vertical"
      style={{
        position: 'absolute',
        top: coords.top,
        left: coords.left,
        width: 176,
        zIndex: 9999,
      }}
      className="rounded-xl border border-gray-100 bg-white py-1 shadow-xl shadow-gray-200/80"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={() => {
            item.onClick()
            onClose()
          }}
          className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium transition-colors hover:bg-gray-50 ${
            item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'
          }`}
        >
          <span className={`shrink-0 ${item.danger ? 'text-red-400' : 'text-gray-400'}`}>
            {item.icon}
          </span>
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  )
}

// ─── Three-dot icon ───────────────────────────────────────────────────────────

function DotsIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="currentColor"
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <circle cx="10" cy="4" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="10" cy="16" r="1.5" />
    </svg>
  )
}

// ─── Icon set for dropdown items ──────────────────────────────────────────────

function ViewIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ArchiveIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L11.48 17l-5.2 2.51.99-5.79-4.21-4.1 5.82-.85z" />
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EcosystemLinkCard({
  link,
  isSelected,
  onClick,
  onMarkCompleted,
  onArchive,
  onViewDetails,
  onRate,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  const badge = statusBadge(link.status)

  const dropdownItems: DropdownItem[] = [
    {
      label: 'View Details',
      icon: <ViewIcon />,
      onClick: () => onViewDetails?.(link.id),
    },
    ...(onRate && link.outcomeScore == null
      ? [
          {
            label: 'Rate Relationship',
            icon: <StarIcon />,
            onClick: () => onRate(link),
          },
        ]
      : []),
    ...(link.status !== 'completed'
      ? [
          {
            label: 'Mark as Completed',
            icon: <CheckIcon />,
            onClick: () => onMarkCompleted?.(link.id),
          },
        ]
      : []),
    ...(link.status !== 'archived'
      ? [
          {
            label: 'Archive',
            icon: <ArchiveIcon />,
            onClick: () => onArchive?.(link.id),
            danger: true,
          },
        ]
      : []),
  ]

  return (
    <>
      <tr
        onClick={() => onClick(link)}
        className={`cursor-pointer transition-colors ${
          isSelected
            ? 'bg-blue-50/60'
            : 'hover:bg-gray-50/80'
        }`}
      >
        {/* ── Link cell ── */}
        <td className="px-4 py-3 align-middle">
          <div className="flex min-w-0 items-center gap-2">
            {/* Source: avatar + name side-by-side */}
            <div className="flex min-w-0 items-center gap-1.5">
              <Avatar name={link.sourceUserName} />
              <span className="max-w-[56px] truncate text-xs font-medium text-gray-600">
                {link.sourceUserName.split(' ')[0]}
              </span>
            </div>

            {/* Arrow */}
            <svg
              className="h-3.5 w-3.5 shrink-0 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>

            {/* Target: avatar + name side-by-side */}
            <div className="flex min-w-0 items-center gap-1.5">
              <Avatar name={link.targetUserName} />
              <span className="max-w-[56px] truncate text-xs font-medium text-gray-600">
                {link.targetUserName.split(' ')[0]}
              </span>
            </div>
          </div>
        </td>

        {/* ── Relationship type ── */}
        <td className="px-4 py-3 align-middle">
          <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
            {formatRelationshipType(link.relationshipType)}
          </span>

          {/* reusableTags + cross-context reuse callout */}
          {link.reusableTags && link.reusableTags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {link.reusableTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700"
                >
                  {tag}
                </span>
              ))}
              <span className="w-full text-[10px] font-medium text-emerald-600">
                Tagged for reuse across future {link.field} contexts
              </span>
            </div>
          )}

          {/* riskFlags */}
          {link.riskFlags && link.riskFlags.length > 0 && (
            <div className="mt-1">
              {link.riskFlags.map((flag, i) => (
                <p key={i} className="text-[10px] text-amber-600">
                  Risk: {flag}
                </p>
              ))}
            </div>
          )}
        </td>

        {/* ── Context ── */}
        <td className="px-4 py-3 align-middle">
          <p className="truncate text-sm font-medium text-gray-800">
            {link.contextName}
          </p>
          <p className="mt-0.5 text-xs capitalize text-gray-400">
            {link.contextType}
          </p>
        </td>

        {/* ── Status ── */}
        <td className="px-4 py-3 align-middle">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${badge.bg} ${badge.text}`}
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${badge.dot}`} aria-hidden="true" />
            {link.status}
          </span>
        </td>

        {/* ── Confidence ── */}
        <td className="px-4 py-3 align-middle">
          <span className={`text-sm ${confidenceColor(link.confidence)}`}>
            {link.confidence}%
          </span>
        </td>

        {/* ── Outcome score ── */}
        <td className="px-4 py-3 align-middle">
          {link.outcomeScore != null ? (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{ width: `${link.outcomeScore}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-600">
                {link.outcomeScore}
              </span>
            </div>
          ) : (
            <span className="text-sm text-gray-300">—</span>
          )}
        </td>

        {/* ── Linked on ── */}
        <td className="px-4 py-3 align-middle">
          <span className="text-sm text-gray-600">
            {formatDate(link.createdAt as any)}
          </span>
        </td>

        {/* ── Actions ── */}
        <td
          className="px-4 py-3 align-middle text-right"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            ref={triggerRef}
            type="button"
            aria-label="Row actions"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((prev) => !prev)
            }}
            className={`grid h-8 w-8 place-items-center rounded-lg transition-all ${
              menuOpen
                ? 'bg-gray-100 text-gray-700'
                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            <DotsIcon />
          </button>
        </td>
      </tr>

      {/* Portal dropdown — lives outside all overflow containers */}
      <PortalDropdown
        anchorRef={triggerRef}
        open={menuOpen}
        onClose={closeMenu}
        items={dropdownItems}
      />
    </>
  )
}