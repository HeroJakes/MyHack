/**
 * RoleRequirementForm — a repeatable editor for an event's RelationshipNeed[].
 *
 * Each row captures a role, a count and a free-text requirements string. Rows
 * can be added and removed; the parent owns the value and receives every edit
 * through `onChange`.
 */
import {
  RELATIONSHIP_ROLES,
  RELATIONSHIP_TYPES,
} from '../types'
import type {
  RelationshipNeed,
  RelationshipRole,
  RelationshipType,
} from '../types'

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
  const update = (index: number, patch: Partial<RelationshipNeed>) => {
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
                onChange={(e) =>
                  update(index, { role: e.target.value as RelationshipRole })
                }
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
