/**
 * EcosystemLinks — reusable relationship memory created from confirmed AI
 * matches, backed by live Firestore data.
 *
 * The "table" is implemented as a flex-row list so:
 *  - column headers never word-wrap
 *  - no horizontal scroll bar appears from percentage rounding errors
 *  - every cell is always vertically middle-aligned by default (flex items-center)
 *  - the portal-based action menu is never clipped by overflow containers
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useEcosystemLinks } from '../hooks/useEcosystemLinks'
import type { ResolvedEcosystemLink } from '../hooks/useEcosystemLinks'
import RelationshipGraphPanel from '../components/RelationshipGraphPanel'
import EcosystemLinkDetail from '../components/EcosystemLinkDetail'
import {
  Bell,
  CheckCircle,
  HelpCircle,
  Link2,
  Recycle,
  Search,
  TrendingUp,
} from '../components/icons'

// ─── Column config ────────────────────────────────────────────────────────────
// `basis` is the px floor; `grow:true` columns absorb remaining space.

const COLUMNS = [
  { key: 'link',       label: 'Link',              basis: 200, grow: true  },
  { key: 'type',       label: 'Relationship Type', basis: 158, grow: true  },
  { key: 'context',    label: 'Context',            basis: 130, grow: false },
  { key: 'status',     label: 'Status',             basis: 96,  grow: false },
  { key: 'confidence', label: 'Confidence',         basis: 90,  grow: false },
  { key: 'outcome',    label: 'Outcome Score',      basis: 112, grow: false },
  { key: 'linked',     label: 'Linked On',          basis: 100, grow: false },
  { key: 'actions',    label: '',                   basis: 48,  grow: false },
] as const

type ColKey = typeof COLUMNS[number]['key']

function colStyle(key: ColKey): React.CSSProperties {
  const col = COLUMNS.find((c) => c.key === key)!
  return { flexBasis: col.basis, flexGrow: col.grow ? 1 : 0, flexShrink: 0, minWidth: col.basis }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 8

const STATUS_OPTIONS = [
  { value: 'all',       label: 'All Status'  },
  { value: 'active',    label: 'Active'      },
  { value: 'completed', label: 'Completed'   },
  { value: 'invited',   label: 'Invited'     },
  { value: 'declined',  label: 'Declined'    },
  { value: 'archived',  label: 'Archived'    },
]

const RELATIONSHIP_OPTIONS = [
  { value: 'all',                       label: 'All Relationship Types'    },
  { value: 'mentor_match',              label: 'Mentor Match'              },
  { value: 'partner_linkage',           label: 'Partner Linkage'           },
  { value: 'service_support',           label: 'Service Support'           },
  { value: 'programme_fit',             label: 'Programme Fit'             },
  { value: 'participant_orchestration', label: 'Participant Orchestration' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function confidenceColor(score: number) {
  if (score >= 80) return 'text-emerald-600 font-bold'
  if (score >= 60) return 'text-amber-500 font-bold'
  return 'text-red-500 font-bold'
}

function statusBadge(status: string) {
  switch (status) {
    case 'active':    return { bg: 'bg-emerald-50 border border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' }
    case 'completed': return { bg: 'bg-blue-50 border border-blue-200',       text: 'text-blue-700',    dot: 'bg-blue-500'    }
    case 'declined':  return { bg: 'bg-red-50 border border-red-200',         text: 'text-red-700',     dot: 'bg-red-400'     }
    case 'archived':  return { bg: 'bg-gray-100 border border-gray-200',      text: 'text-gray-500',    dot: 'bg-gray-400'    }
    case 'invited':   return { bg: 'bg-violet-50 border border-violet-200',   text: 'text-violet-700',  dot: 'bg-violet-500'  }
    default:          return { bg: 'bg-gray-100 border border-gray-200',      text: 'text-gray-500',    dot: 'bg-gray-400'    }
  }
}

function formatRelType(type: string) {
  return type.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function formatDate(ts: any): string {
  if (!ts) return '—'
  const d = typeof ts.toDate === 'function' ? ts.toDate() : ts instanceof Date ? ts : new Date()
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-blue-100 text-blue-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
]

function nameColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() ?? '').join('')
}

function Avatar({ name }: { name: string }) {
  return (
    <div
      className={`h-8 w-8 shrink-0 rounded-full grid place-items-center text-xs font-bold ${nameColor(name)}`}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const ArrowRight = () => (
  <svg className="h-3.5 w-3.5 shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
  </svg>
)
const DotsV = () => (
  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
    <circle cx="10" cy="4"  r="1.5" />
    <circle cx="10" cy="10" r="1.5" />
    <circle cx="10" cy="16" r="1.5" />
  </svg>
)
const EyeIco = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
)
const CheckIco = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
const ArchiveIco = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
  </svg>
)
const ChevLeft = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
)
const ChevRight = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
)
const ChevDown = () => (
  <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)

// ─── Portal dropdown (never clipped by overflow) ───────────────────────────────

interface MenuItem { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }

function PortalMenu({
  anchorRef, open, onClose, items,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  open: boolean
  onClose: () => void
  items: MenuItem[]
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const r = anchorRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + window.scrollY + 6, left: r.right + window.scrollX - 176 })
  }, [open, anchorRef])

  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node) && !anchorRef.current?.contains(e.target as Node)) onClose()
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open, onClose, anchorRef])

  if (!open) return null
  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ position: 'absolute', top: pos.top, left: pos.left, width: 176, zIndex: 9999 }}
      className="rounded-xl border border-gray-100 bg-white py-1 shadow-xl shadow-gray-200/80"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={() => { item.onClick(); onClose() }}
          className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium transition-colors hover:bg-gray-50 ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'}`}
        >
          <span className={`shrink-0 ${item.danger ? 'text-red-400' : 'text-gray-400'}`}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  )
}

// ─── Flex row wrapper (header + data rows share this) ─────────────────────────

function Row({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`flex w-full flex-row items-center ${className}`}
      style={{ minWidth: COLUMNS.reduce((s, c) => s + c.basis, 0) }}
    >
      {children}
    </div>
  )
}

// ─── Data row ─────────────────────────────────────────────────────────────────

function LinkRow({
  link, isSelected, onClick, onMarkCompleted, onArchive, onViewDetails,
}: {
  link: ResolvedEcosystemLink
  isSelected: boolean
  onClick: () => void
  onMarkCompleted?: (id: string) => void
  onArchive?: (id: string) => void
  onViewDetails?: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const close  = useCallback(() => setOpen(false), [])
  const badge  = statusBadge(link.status)

  const items: MenuItem[] = [
    { label: 'View Details',       icon: <EyeIco />,    onClick: () => onViewDetails?.(link.id)    },
    ...(link.status !== 'completed' ? [{ label: 'Mark as Completed', icon: <CheckIco />,   onClick: () => onMarkCompleted?.(link.id) }] : []),
    ...(link.status !== 'archived'  ? [{ label: 'Archive',           icon: <ArchiveIco />, onClick: () => onArchive?.(link.id), danger: true }] : []),
  ]

  return (
    <>
      <Row
        onClick={onClick}
        className={`cursor-pointer border-b border-gray-50 py-3 transition-colors last:border-0 ${isSelected ? 'bg-blue-50/60' : 'hover:bg-gray-50/70'}`}
      >
        {/* Link */}
        <div style={colStyle('link')} className="flex items-center gap-2 px-4">
          <div className="flex items-center gap-1.5 min-w-0">
            <Avatar name={link.sourceUserName} />
            <span className="truncate text-xs font-medium text-gray-600" style={{ maxWidth: 54 }}>
              {link.sourceUserName.split(' ')[0]}
            </span>
          </div>
          <ArrowRight />
          <div className="flex items-center gap-1.5 min-w-0">
            <Avatar name={link.targetUserName} />
            <span className="truncate text-xs font-medium text-gray-600" style={{ maxWidth: 54 }}>
              {link.targetUserName.split(' ')[0]}
            </span>
          </div>
        </div>

        {/* Relationship type */}
        <div style={colStyle('type')} className="flex items-center px-4">
          <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 whitespace-nowrap">
            {formatRelType(link.relationshipType)}
          </span>
        </div>

        {/* Context */}
        <div style={colStyle('context')} className="flex flex-col justify-center px-4">
          <p className="truncate text-sm font-medium text-gray-800">{link.contextName}</p>
          <p className="mt-0.5 text-xs capitalize text-gray-400">{link.contextType}</p>
        </div>

        {/* Status */}
        <div style={colStyle('status')} className="flex items-center px-4">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize whitespace-nowrap ${badge.bg} ${badge.text}`}>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${badge.dot}`} aria-hidden="true" />
            {link.status}
          </span>
        </div>

        {/* Confidence */}
        <div style={colStyle('confidence')} className="flex items-center px-4">
          <span className={`text-sm ${confidenceColor(link.confidence)}`}>{link.confidence}%</span>
        </div>

        {/* Outcome score */}
        <div style={colStyle('outcome')} className="flex items-center px-4">
          {link.outcomeScore != null ? (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-14 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-emerald-400" style={{ width: `${link.outcomeScore}%` }} />
              </div>
              <span className="text-xs font-medium text-gray-600">{link.outcomeScore}</span>
            </div>
          ) : (
            <span className="text-sm text-gray-300">—</span>
          )}
        </div>

        {/* Linked on */}
        <div style={colStyle('linked')} className="flex items-center px-4">
          <span className="text-sm text-gray-600 whitespace-nowrap">{formatDate(link.createdAt)}</span>
        </div>

        {/* Actions */}
        <div
          style={colStyle('actions')}
          className="flex items-center justify-end px-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            ref={btnRef}
            type="button"
            aria-label="Row actions"
            aria-haspopup="true"
            aria-expanded={open}
            onClick={(e) => { e.stopPropagation(); setOpen((p) => !p) }}
            className={`grid h-8 w-8 place-items-center rounded-lg transition-all ${open ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'}`}
          >
            <DotsV />
          </button>
        </div>
      </Row>

      <PortalMenu anchorRef={btnRef} open={open} onClose={close} items={items} />
    </>
  )
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <Row className="border-b border-gray-50 py-3">
      {COLUMNS.map((col) => (
        <div key={col.key} style={colStyle(col.key)} className="px-4">
          <div className="h-5 w-4/5 animate-pulse rounded-md bg-gray-100" />
        </div>
      ))}
    </Row>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ hasLinks }: { hasLinks: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-gray-100 text-gray-400">
        <Link2 className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-600">
          {hasLinks ? 'No links match your filters' : 'No ecosystem links yet'}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          {hasLinks ? 'Try adjusting the search or filter options.' : 'Accept an invite to create the first reusable relationship link.'}
        </p>
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, iconBg, iconColor, value, label, description, badge }: {
  icon: React.ReactNode; iconBg: string; iconColor: string
  value: string; label: string; description: string
  badge?: { label: string; color: string }
}) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${iconBg} ${iconColor}`}>{icon}</div>
        {badge && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.color}`}>{badge.label}</span>}
      </div>
      <div>
        <p className="text-3xl font-black tracking-tight text-gray-950">{value}</p>
        <p className="mt-0.5 text-sm font-semibold text-gray-700">{label}</p>
        <p className="mt-0.5 text-xs text-gray-400">{description}</p>
      </div>
    </div>
  )
}

function StatSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="h-10 w-10 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-5 w-12 animate-pulse rounded-full bg-gray-100" />
      </div>
      <div className="h-8 w-16 animate-pulse rounded-lg bg-gray-200" />
      <div className="space-y-1.5">
        <div className="h-3.5 w-24 animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-36 animate-pulse rounded bg-gray-50" />
      </div>
    </div>
  )
}

// ─── Filter select ────────────────────────────────────────────────────────────

function FilterSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 appearance-none rounded-lg border border-gray-200 bg-white py-0 pl-3 pr-8 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevDown />
    </div>
  )
}

function IconBtn({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button type="button" aria-label={label} className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-all hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 active:scale-95">
      {icon}
    </button>
  )
}

function PageBtn({ page, active, onClick }: { page: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid h-8 min-w-8 place-items-center rounded-lg px-2 text-xs font-semibold transition-all active:scale-95 ${active ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}
    >
      {page}
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EcosystemLinks() {
  const navigate = useNavigate()
  const { links, isLoading, error } = useEcosystemLinks()

  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null)
  const [search, setSearch]                 = useState('')
  const [statusFilter, setStatusFilter]     = useState('all')
  const [relFilter, setRelFilter]           = useState('all')
  const [currentPage, setCurrentPage]       = useState(1)

  const stats = useMemo(() => {
    const active    = links.filter((l) => l.status === 'active').length
    const completed = links.filter((l) => l.status === 'completed').length
    const reused    = links.filter((l) => l.reusableTags.length > 0).length
    const avgConf   = links.length ? Math.round(links.reduce((s, l) => s + l.confidence, 0) / links.length) : 0
    return { active, completed, reused, avgConf }
  }, [links])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return links.filter((l) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false
      if (relFilter    !== 'all' && l.relationshipType !== relFilter) return false
      if (q && ![l.sourceUserName, l.targetUserName, l.contextName].some((v) => v.toLowerCase().includes(q))) return false
      return true
    })
  }, [links, search, statusFilter, relFilter])

  useEffect(() => { setCurrentPage(1) }, [search, statusFilter, relFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageLinks  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const selected   = links.find((l) => l.id === selectedLinkId) ?? links[0] ?? null
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const rangeEnd   = Math.min(currentPage * PAGE_SIZE, filtered.length)

  async function handleMarkCompleted(id: string) {
    try { await updateDoc(doc(db, 'ecosystemLinks', id), { status: 'completed', updatedAt: serverTimestamp() }) }
    catch (e) { console.error(e) }
  }
  async function handleArchive(id: string) {
    try { await updateDoc(doc(db, 'ecosystemLinks', id), { status: 'archived', updatedAt: serverTimestamp() }) }
    catch (e) { console.error(e) }
  }

  return (
    <div className="space-y-5">

      {/* ── Header + filters ─────────────────────────────────────────────── */}
      <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-950">Ecosystem Links</h1>
          <p className="mt-1 text-sm text-gray-500">Reusable relationship memory created from confirmed AI matches.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search links..."
              className="h-9 w-56 rounded-lg border border-gray-200 bg-white py-0 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 transition-colors hover:border-gray-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
          <FilterSelect value={relFilter}    onChange={setRelFilter}    options={RELATIONSHIP_OPTIONS} />
          <div className="flex items-center gap-1.5">
            <IconBtn icon={<Bell className="h-4 w-4" />}       label="Notifications" />
            <IconBtn icon={<HelpCircle className="h-4 w-4" />} label="Help"          />
          </div>
        </div>
      </header>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">Failed to load ecosystem links. <span className="font-normal opacity-80">{error}</span></p>
          <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 active:scale-95">Retry</button>
        </div>
      )}

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isLoading ? (
          <><StatSkeleton /><StatSkeleton /><StatSkeleton /><StatSkeleton /></>
        ) : (
          <>
            <StatCard icon={<Link2 className="h-5 w-5" />}      iconBg="bg-violet-100"  iconColor="text-violet-600"  value={String(stats.active)}   label="Active Links"    description="Currently ongoing"             badge={{ label: 'Live',   color: 'bg-violet-50 text-violet-700'  }} />
            <StatCard icon={<CheckCircle className="h-5 w-5" />} iconBg="bg-emerald-100" iconColor="text-emerald-600" value={String(stats.completed)} label="Completed Links" description="Successfully closed"            badge={{ label: 'Done',   color: 'bg-emerald-50 text-emerald-700' }} />
            <StatCard icon={<TrendingUp className="h-5 w-5" />}  iconBg="bg-blue-100"    iconColor="text-blue-600"    value={`${stats.avgConf}%`}     label="Avg Confidence"  description="Average AI match confidence"   badge={{ label: 'AI',     color: 'bg-blue-50 text-blue-700'      }} />
            <StatCard icon={<Recycle className="h-5 w-5" />}     iconBg="bg-amber-100"   iconColor="text-amber-600"   value={String(stats.reused)}    label="Reused Links"    description="Applied across future contexts" badge={{ label: 'Memory', color: 'bg-amber-50 text-amber-700'    }} />
          </>
        )}
      </div>

      {/* ── D3 graph ─────────────────────────────────────────────────────── */}
      <RelationshipGraphPanel links={links} isLoading={isLoading} onNodeClick={(id, name) => console.log(id, name)} />

      {/* ── Links card + detail panel ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[58fr_42fr]">

        <div className="flex min-w-0 flex-col rounded-2xl border border-gray-100 bg-white shadow-sm">

          {/* Card title + filter chips */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Recent Ecosystem Links</h2>
              <p className="mt-0.5 text-xs text-gray-400">
                {filtered.length === 0 ? 'No links to display' : `Showing ${rangeStart}–${rangeEnd} of ${filtered.length} links`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {statusFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  {STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label}
                  <button type="button" onClick={() => setStatusFilter('all')} className="ml-0.5 text-blue-400 hover:text-blue-700" aria-label="Clear">&times;</button>
                </span>
              )}
              {relFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                  {RELATIONSHIP_OPTIONS.find((o) => o.value === relFilter)?.label}
                  <button type="button" onClick={() => setRelFilter('all')} className="ml-0.5 text-violet-400 hover:text-violet-700" aria-label="Clear">&times;</button>
                </span>
              )}
            </div>
          </div>

          {/* ── Column header row ── */}
          <div className="overflow-x-auto border-y border-gray-100 bg-gray-50/70">
            <Row className="py-2.5">
              {COLUMNS.map((col) => (
                <div
                  key={col.key}
                  style={colStyle(col.key)}
                  className={`px-4 text-xs font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap ${col.key === 'actions' ? 'text-right' : ''}`}
                >
                  {col.label}
                </div>
              ))}
            </Row>
          </div>

          {/* ── Data rows ── */}
          <div className="overflow-x-auto">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : pageLinks.length === 0 ? (
              <EmptyState hasLinks={links.length > 0} />
            ) : (
              pageLinks.map((link) => (
                <LinkRow
                  key={link.id}
                  link={link}
                  isSelected={link.id === selected?.id}
                  onClick={() => setSelectedLinkId(link.id)}
                  onMarkCompleted={handleMarkCompleted}
                  onArchive={handleArchive}
                  onViewDetails={(id) => setSelectedLinkId(id)}
                />
              ))
            )}
          </div>

          {/* ── Pagination ── */}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
            <p className="text-xs text-gray-400">
              {filtered.length === 0 ? '0 results' : `${rangeStart}–${rangeEnd} of ${filtered.length}`}
            </p>
            {totalPages > 1 && (
              <nav className="flex items-center gap-1" aria-label="Pagination">
                <button type="button" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:pointer-events-none disabled:opacity-30" aria-label="Previous"><ChevLeft /></button>
                {Array.from({ length: totalPages }).map((_, i) => <PageBtn key={i + 1} page={i + 1} active={currentPage === i + 1} onClick={() => setCurrentPage(i + 1)} />)}
                <button type="button" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:pointer-events-none disabled:opacity-30" aria-label="Next"><ChevRight /></button>
              </nav>
            )}
          </div>
        </div>

        {/* Detail panel */}
        <EcosystemLinkDetail
          link={isLoading ? null : selected}
          onMarkCompleted={handleMarkCompleted}
          onViewContext={(contextId) => navigate(`/events/${contextId}`)}
        />
      </div>
    </div>
  )
}