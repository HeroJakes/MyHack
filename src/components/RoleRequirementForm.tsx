/**
 * RoleRequirementForm — the Relationship Needs editor for the Create Context
 * page, extracted from the inline table.
 *
 * Renders one row per need (role, count stepper, keyword tag input,
 * requirements) plus an "Add Relationship Need" action. State is owned by the
 * parent's useCreateContext hook; every edit flows back through the callbacks.
 */
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { RELATIONSHIP_ROLES } from '../types'
import type { RelationshipRole } from '../types'
import type { ContextRelationshipNeed } from '../hooks/useCreateContext'

const COUNT_MIN = 1
const COUNT_MAX = 20
const KEYWORDS_MAX = 10
const KEYWORD_LENGTH_MAX = 50

/** Keyword suggestions surfaced per role in the keyword dropdown. */
const KEYWORD_SUGGESTIONS_BY_ROLE: Record<RelationshipRole, string[]> = {
  Mentor: [
    'fundraising',
    'mentorship',
    'advice',
    'compliance',
    'go-to-market',
    'product strategy',
    'regulatory',
  ],
  Partner: [
    'partnership',
    'collaboration',
    'finance',
    'government',
    'banking',
    'co-marketing',
    'distribution',
  ],
  'Startup/Company': [
    'startup',
    'innovation',
    'fintech',
    'healthtech',
    'pilot',
    'showcase',
    'product demo',
  ],
  'Service Provider': [
    'legal',
    'compliance',
    'consulting',
    'accounting',
    'marketing',
    'HR',
    'cloud services',
  ],
  'Programme Admin': [
    'coordination',
    'event management',
    'community',
    'operations',
    'participant engagement',
  ],
}

interface RoleRequirementFormProps {
  needs: ContextRelationshipNeed[]
  onAdd: () => void
  onUpdate: (index: number, need: ContextRelationshipNeed) => void
  onRemove: (index: number) => void
}

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'

export default function RoleRequirementForm({
  needs,
  onAdd,
  onUpdate,
  onRemove,
}: RoleRequirementFormProps) {
  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[1.2fr_0.9fr_1.4fr_1.4fr_0.4fr] gap-3 border-b border-gray-100 pb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
            <span>Role Needed</span>
            <span>Count</span>
            <span>Keyword (Select multiple)</span>
            <span>Requirements</span>
            <span className="text-right">Action</span>
          </div>

          {needs.length === 0 && (
            <p className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
              No relationship needs yet. Add one below or let AI suggest them.
            </p>
          )}

          {needs.map((need, index) => (
            <div
              key={index}
              className="grid grid-cols-[1.2fr_0.9fr_1.4fr_1.4fr_0.4fr] items-start gap-3 border-b border-gray-50 py-3"
            >
              <select
                aria-label={`Role for relationship need ${index + 1}`}
                value={need.role}
                onChange={(e) =>
                  onUpdate(index, {
                    ...need,
                    role: e.target.value as RelationshipRole,
                  })
                }
                className={`h-10 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-700 focus:border-blue-500 ${FOCUS_RING}`}
              >
                {RELATIONSHIP_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>

              <CountStepper
                value={need.count}
                onChange={(count) => onUpdate(index, { ...need, count })}
              />

              <KeywordTagInput
                role={need.role}
                value={need.keywords}
                onChange={(keywords) => onUpdate(index, { ...need, keywords })}
              />

              <input
                aria-label={`Requirements for relationship need ${index + 1}`}
                value={need.requirements}
                maxLength={500}
                onChange={(e) =>
                  onUpdate(index, { ...need, requirements: e.target.value })
                }
                placeholder="Describe who fits this role…"
                className={`h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 ${FOCUS_RING}`}
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  aria-label={`Remove relationship need ${index + 1}`}
                  className={`grid h-10 w-10 place-items-center rounded-lg border border-gray-200 text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500 ${FOCUS_RING}`}
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
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onAdd}
        className={`mt-4 inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 ${FOCUS_RING}`}
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add Relationship Need
      </button>
    </div>
  )
}

/** A minus / number / plus stepper clamped to [1, 20]. */
function CountStepper({
  value,
  onChange,
}: {
  value: number
  onChange: (next: number) => void
}) {
  const clamp = (n: number) => Math.min(COUNT_MAX, Math.max(COUNT_MIN, n))

  return (
    <div className="inline-flex h-10 items-center rounded-lg border border-gray-300 bg-white">
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= COUNT_MIN}
        aria-label="Decrease count"
        className={`grid h-full w-9 place-items-center text-gray-500 hover:text-gray-800 disabled:cursor-not-allowed disabled:text-gray-300 ${FOCUS_RING}`}
      >
        −
      </button>
      <input
        type="number"
        min={COUNT_MIN}
        max={COUNT_MAX}
        value={value}
        aria-label="Count"
        onChange={(e) => onChange(clamp(Number(e.target.value) || COUNT_MIN))}
        className={`h-full w-10 border-x border-gray-200 bg-transparent text-center text-sm font-semibold text-gray-800 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${FOCUS_RING}`}
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= COUNT_MAX}
        aria-label="Increase count"
        className={`grid h-full w-9 place-items-center text-gray-500 hover:text-gray-800 disabled:cursor-not-allowed disabled:text-gray-300 ${FOCUS_RING}`}
      >
        +
      </button>
    </div>
  )
}

/**
 * KeywordTagInput — per-need keyword chips. Type and press Enter or comma to
 * add a chip; the dropdown arrow opens role-aware keyword suggestions. Capped
 * at 10 keywords, each at most 50 characters.
 */
function KeywordTagInput({
  role,
  value,
  onChange,
}: {
  role: RelationshipRole
  value: string[]
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const atMax = value.length >= KEYWORDS_MAX
  const suggestions = (KEYWORD_SUGGESTIONS_BY_ROLE[role] ?? []).filter(
    (s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()),
  )

  const add = (raw: string) => {
    const keyword = raw.trim().slice(0, KEYWORD_LENGTH_MAX)
    if (!keyword || atMax) return
    if (value.some((v) => v.toLowerCase() === keyword.toLowerCase())) {
      setDraft('')
      return
    }
    onChange([...value, keyword])
    setDraft('')
  }

  const remove = (keyword: string) => {
    onChange(value.filter((v) => v !== keyword))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      add(draft)
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      remove(value[value.length - 1])
    }
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex min-h-10 flex-wrap items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1 focus-within:border-blue-500">
        {value.map((keyword) => (
          <span
            key={keyword}
            className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
          >
            {keyword}
            <button
              type="button"
              onClick={() => remove(keyword)}
              aria-label={`Remove keyword ${keyword}`}
              className={`text-blue-500 hover:text-blue-700 ${FOCUS_RING}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          maxLength={KEYWORD_LENGTH_MAX}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={
            value.length === 0
              ? atMax
                ? ''
                : 'Add keywords…'
              : ''
          }
          aria-label="Add keyword"
          disabled={atMax && value.length >= KEYWORDS_MAX}
          className="min-w-[60px] flex-1 border-none bg-transparent py-1 text-xs text-gray-700 outline-none placeholder:text-gray-400"
        />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Toggle keyword suggestions"
          aria-expanded={open}
          className={`ml-auto rounded text-gray-400 hover:text-gray-600 ${FOCUS_RING}`}
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          {atMax ? (
            <p className="px-3 py-2 text-xs text-gray-400">
              Maximum of {KEYWORDS_MAX} keywords reached.
            </p>
          ) : suggestions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400">
              No more suggestions for this role.
            </p>
          ) : (
            <ul role="listbox" className="max-h-48 overflow-auto py-1">
              {suggestions.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => add(suggestion)}
                    className={`w-full px-3 py-1.5 text-left text-xs text-gray-600 hover:bg-gray-50 ${FOCUS_RING}`}
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
