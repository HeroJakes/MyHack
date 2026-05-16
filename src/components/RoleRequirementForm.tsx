/**
 * RoleRequirementForm — a repeatable editor for an event's RelationshipNeed[].
 *
 * Each row captures a role, a count, a free-text requirements string and an
 * optional list of keyword hints. Selecting a role auto-couples a sensible
 * relationship type (still editable). Rows can be added and removed; the
 * parent owns the value and receives every edit through `onChange`.
 */
import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
  RELATIONSHIP_ROLES,
  RELATIONSHIP_TYPES,
} from '../types'
import type {
  RelationshipNeed,
  RelationshipRole,
  RelationshipType,
} from '../types'

/**
 * Default relationship type for each role. Selecting a role auto-fills the
 * relationship type from this map; the user can still override it manually.
 */
const ROLE_TO_RELATIONSHIP: Record<string, string> = {
  Mentor: 'mentor_match',
  Partner: 'partner_linkage',
  'Service Provider': 'service_support',
  'Startup/Company': 'programme_fit',
  'Programme Admin': 'participant_orchestration',
}

/**
 * `keywords` is part of the backend RelationshipNeed but not yet mirrored in
 * the shared frontend type — model it locally so the form stays type-safe.
 */
type NeedWithKeywords = RelationshipNeed & { keywords?: string[] }

interface RoleRequirementFormProps {
  value: RelationshipNeed[]
  onChange: (next: RelationshipNeed[]) => void
}

const EMPTY_NEED: RelationshipNeed = {
  role: 'Mentor',
  count: 1,
  relationshipType: 'mentor_match',
  requirements: '',
}

export default function RoleRequirementForm({
  value,
  onChange,
}: RoleRequirementFormProps) {
  const update = (index: number, patch: Partial<NeedWithKeywords>) => {
    onChange(value.map((need, i) => (i === index ? { ...need, ...patch } : need)))
  }

  const addRow = () => onChange([...value, { ...EMPTY_NEED }])

  const removeRow = (index: number) =>
    onChange(value.filter((_, i) => i !== index))

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-sm text-gray-500">
          No relationship needs yet. Add one below or let AI suggest them.
        </p>
      )}

      {value.map((need, index) => (
        <div
          key={index}
          className="rounded-xl border border-gray-200 bg-gray-50 p-3"
        >
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-xs font-medium text-gray-600">
              Role
              <select
                value={need.role}
                onChange={(e) => {
                  const role = e.target.value as RelationshipRole
                  const mapped = ROLE_TO_RELATIONSHIP[role]
                  // Auto-couple the relationship type on role change; leave it
                  // untouched for any unexpected role value.
                  update(
                    index,
                    mapped
                      ? { role, relationshipType: mapped as RelationshipType }
                      : { role },
                  )
                }}
                className="mt-1 h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm"
              >
                {RELATIONSHIP_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col text-xs font-medium text-gray-600">
              Count
              <input
                type="number"
                min={1}
                value={need.count}
                onChange={(e) =>
                  update(index, {
                    count: Math.max(1, Number(e.target.value) || 1),
                  })
                }
                className="mt-1 h-9 w-20 rounded-lg border border-gray-300 bg-white px-2 text-sm"
              />
            </label>

            <label className="flex flex-col text-xs font-medium text-gray-600">
              Relationship type
              <select
                value={need.relationshipType}
                onChange={(e) =>
                  update(index, {
                    relationshipType: e.target.value as RelationshipType,
                  })
                }
                className="mt-1 h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm"
              >
                {RELATIONSHIP_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => removeRow(index)}
              className="ml-auto h-9 rounded-lg border border-red-200 px-3 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Remove
            </button>
          </div>

          <label className="mt-3 flex flex-col text-xs font-medium text-gray-600">
            Requirements
            <textarea
              value={need.requirements}
              onChange={(e) => update(index, { requirements: e.target.value })}
              rows={2}
              placeholder="Describe who fits this role…"
              className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          <KeywordsField
            value={(need as NeedWithKeywords).keywords ?? []}
            onChange={(keywords) => update(index, { keywords })}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
      >
        + Add relationship need
      </button>
    </div>
  )
}

interface KeywordsFieldProps {
  value: string[]
  onChange: (next: string[]) => void
}

/**
 * KeywordsField — a small tag-style input for per-need keyword hints.
 *
 * Enter or comma commits the typed keyword, Backspace on an empty input
 * removes the last tag, and each tag has its own remove button.
 */
function KeywordsField({ value, onChange }: KeywordsFieldProps) {
  const [draft, setDraft] = useState('')

  const addKeyword = (raw: string) => {
    const keyword = raw.trim()
    if (!keyword) return
    if (value.some((k) => k.toLowerCase() === keyword.toLowerCase())) {
      setDraft('')
      return
    }
    onChange([...value, keyword])
    setDraft('')
  }

  const removeKeyword = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addKeyword(draft)
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      removeKeyword(value.length - 1)
    }
  }

  return (
    <label className="mt-3 flex flex-col text-xs font-medium text-gray-600">
      Keywords
      <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2 py-1.5 focus-within:border-blue-600">
        {value.map((keyword, i) => (
          <span
            key={`${keyword}-${i}`}
            className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
          >
            {keyword}
            <button
              type="button"
              onClick={() => removeKeyword(i)}
              aria-label={`Remove ${keyword}`}
              className="leading-none text-blue-500 hover:text-blue-800"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            value.length === 0
              ? 'e.g. Islamic finance, cold chain, B2G sales'
              : ''
          }
          className="min-w-[140px] flex-1 border-none bg-transparent text-sm font-normal text-gray-700 outline-none placeholder:text-gray-400"
        />
      </div>
    </label>
  )
}
