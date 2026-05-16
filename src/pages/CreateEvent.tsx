/**
 * CreateEvent — Create Context page.
 *
 * Two-column layout: a left form (Basic Context Information + Relationship
 * Needs) and a right validation/summary rail (Validation Checklist, Context
 * Summary, Target Outcomes, primary CTA). Submitting calls the createEvent
 * Cloud Function and navigates to the new event.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateEvent } from '../hooks/useCreateEvent'
import { useSuggestRelationshipNeeds } from '../hooks/useSuggestRelationshipNeeds'
import {
  RELATIONSHIP_ROLES,
} from '../types'
import type {
  RelationshipNeed,
  RelationshipRole,
  RelationshipType,
} from '../types'

type LocationKind = 'physical' | 'virtual' | 'hybrid'
type DraftStatus = 'draft' | 'open'

interface NeedRow extends RelationshipNeed {
  keywords: string[]
}

const CONTEXT_TYPES = [
  'Event',
  'Summit',
  'Demo Day',
  'Workshop',
  'Cohort',
  'Programme',
]

const FIELD_OPTIONS = [
  'FinTech',
  'HealthTech',
  'EdTech',
  'AgriTech',
  'GreenTech',
  'CleanTech',
  'Cybersecurity',
  'PropTech',
  'Logistics',
  'E-commerce',
  'AI / ML',
  'Web3 / Blockchain',
  'Deep Tech',
]

const ROLE_TO_TYPE: Record<RelationshipRole, RelationshipType> = {
  Mentor: 'mentor_match',
  Partner: 'partner_linkage',
  'Startup/Company': 'participant_orchestration',
  'Service Provider': 'service_support',
  'Programme Admin': 'programme_fit',
}

const DEFAULT_KEYWORDS_BY_ROLE: Record<RelationshipRole, string[]> = {
  Mentor: ['mentorship', 'advice'],
  Partner: ['partnership', 'collaboration'],
  'Startup/Company': ['startup', 'innovation'],
  'Service Provider': ['legal', 'compliance', 'consulting'],
  'Programme Admin': ['programme', 'operations'],
}

const KEYWORD_SUGGESTIONS = [
  'mentorship',
  'advice',
  'fundraising',
  'partnership',
  'collaboration',
  'finance',
  'startup',
  'innovation',
  'fintech',
  'legal',
  'compliance',
  'consulting',
  'marketing',
  'product',
  'engineering',
  'design',
  'sales',
  'operations',
  'policy',
]

const DESCRIPTION_LIMIT = 1000

function formatDate(value: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function outcomesFor(field: string): string[] {
  const sector = field.trim() || 'the sector'
  return [
    'Facilitate high-value connections',
    `Promote ${sector} innovation`,
    'Enable partnerships and pilot opportunities',
    "Strengthen Malaysia's ecosystem",
  ]
}

interface CheckProps {
  ok: boolean
  label: string
}

function CheckRow({ ok, label }: CheckProps) {
  return (
    <li className="flex items-center gap-2 text-[13px]">
      <span
        className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${
          ok ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
        }`}
      >
        <svg
          className="h-3 w-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 12l5 5L20 7" />
        </svg>
      </span>
      <span className={ok ? 'text-gray-700' : 'text-gray-400'}>{label}</span>
    </li>
  )
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (next: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div
      role="radiogroup"
      className="inline-flex w-full rounded-xl border border-gray-200 bg-gray-50 p-1"
    >
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              active
                ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-100'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function FieldSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:border-gray-400"
      >
        <span className="flex flex-wrap items-center gap-1">
          {value ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {value}
              <span
                role="button"
                tabIndex={0}
                aria-label={`Remove ${value}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onChange('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    onChange('')
                  }
                }}
                className="cursor-pointer text-blue-500 hover:text-blue-700"
              >
                ×
              </span>
            </span>
          ) : (
            <span className="text-gray-400">Select a field</span>
          )}
        </span>
        <svg
          className="h-4 w-4 text-gray-400"
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
      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
        >
          {FIELD_OPTIONS.map((option) => (
            <li key={option}>
              <button
                type="button"
                onClick={() => {
                  onChange(option)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${
                  option === value ? 'text-blue-700' : 'text-gray-700'
                }`}
              >
                {option}
                {option === value ? <span aria-hidden>✓</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function KeywordTags({
  value,
  onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const available = KEYWORD_SUGGESTIONS.filter(
    (k) => !value.some((v) => v.toLowerCase() === k.toLowerCase()),
  )

  function add(raw: string) {
    const tag = raw.trim()
    if (!tag) return
    if (value.some((v) => v.toLowerCase() === tag.toLowerCase())) return
    onChange([...value, tag])
    setInput('')
  }

  function remove(tag: string) {
    onChange(value.filter((v) => v !== tag))
  }

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(true)}
        className="flex min-h-10 cursor-text flex-wrap items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1 focus-within:border-blue-500"
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                remove(tag)
              }}
              aria-label={`Remove ${tag}`}
              className="text-blue-500 hover:text-blue-700"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add(input)
            } else if (e.key === 'Backspace' && !input && value.length) {
              remove(value[value.length - 1])
            }
          }}
          placeholder={value.length === 0 ? 'Add keywords…' : ''}
          className="min-w-[60px] flex-1 border-none bg-transparent py-1 text-xs text-gray-700 outline-none placeholder:text-gray-400"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setOpen((prev) => !prev)
          }}
          aria-label="Toggle keyword suggestions"
          className="ml-auto text-gray-400 hover:text-gray-600"
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
      {open && available.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
        >
          {available.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onClick={() => {
                  add(suggestion)
                  setOpen(false)
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-gray-600 hover:bg-gray-50"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StepBadge({ step }: { step: number }) {
  return (
    <span className="grid h-6 w-6 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white">
      {step}
    </span>
  )
}

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <span className="text-xs font-semibold text-gray-700">
      {children}
      {required ? <span className="ml-0.5 text-red-500">*</span> : null}
    </span>
  )
}

export default function CreateEvent() {
  const navigate = useNavigate()
  const { createEvent, status: createStatus, error: createError } =
    useCreateEvent()
  const {
    suggestNeeds,
    status: suggestStatus,
    error: suggestError,
  } = useSuggestRelationshipNeeds()

  const [name, setName] = useState('')
  const [contextType, setContextType] = useState('Event')
  const [field, setField] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [locationType, setLocationType] = useState<LocationKind>('physical')
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState<DraftStatus>('draft')
  const [imagePreview, setImagePreview] = useState<string>('')
  const [imageName, setImageName] = useState<string>('')
  const [needs, setNeeds] = useState<NeedRow[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  const updateNeed = (index: number, patch: Partial<NeedRow>) => {
    setNeeds((prev) =>
      prev.map((need, i) => {
        if (i !== index) return need
        const next = { ...need, ...patch }
        if (patch.role && patch.role !== need.role) {
          next.relationshipType = ROLE_TO_TYPE[patch.role]
        }
        return next
      }),
    )
  }

  const addNeed = () => {
    setNeeds((prev) => [
      ...prev,
      {
        role: 'Mentor',
        count: 1,
        relationshipType: 'mentor_match',
        requirements: '',
        keywords: [...DEFAULT_KEYWORDS_BY_ROLE.Mentor],
      },
    ])
  }

  const removeNeed = (index: number) => {
    setNeeds((prev) => prev.filter((_, i) => i !== index))
  }

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setImagePreview(typeof reader.result === 'string' ? reader.result : '')
      setImageName(file.name)
    }
    reader.readAsDataURL(file)
  }

  const clearImage = () => {
    setImagePreview('')
    setImageName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSuggest = async () => {
    if (!field.trim()) return
    try {
      const suggested = await suggestNeeds({ field, description })
      setNeeds(
        suggested.map((need) => ({
          ...need,
          keywords: [...(DEFAULT_KEYWORDS_BY_ROLE[need.role] ?? [])],
        })),
      )
    } catch {
      // Surfaced via suggestError below.
    }
  }

  const validation = useMemo(() => {
    const countValid = needs.length === 0 || needs.every((n) => n.count >= 1)
    return [
      { label: 'Context name provided', ok: name.trim().length > 0 },
      { label: 'Context type selected', ok: contextType.trim().length > 0 },
      { label: 'Field / sector selected', ok: field.trim().length > 0 },
      { label: 'Description added', ok: description.trim().length > 0 },
      { label: 'Date selected', ok: startDate.length > 0 },
      { label: 'Location provided', ok: location.trim().length > 0 },
      { label: 'Relationship need added', ok: needs.length > 0 },
      { label: 'Count valid', ok: countValid },
    ]
  }, [name, contextType, field, description, startDate, location, needs])

  const allValid = validation.every((v) => v.ok)

  const submit = async (asDraft: boolean) => {
    try {
      const payload = {
        name,
        type: contextType,
        field,
        description,
        roleRequirements: needs.map(({ keywords, ...rest }) => ({
          ...rest,
          keywords,
        })) as RelationshipNeed[],
        eventDate: startDate ? new Date(startDate).getTime() : undefined,
      }
      const result = await createEvent(payload)
      if (asDraft) {
        navigate('/contexts')
      } else {
        navigate(`/events/${result.eventId}`)
      }
    } catch {
      // Surfaced via createError below.
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await submit(status === 'draft')
  }

  const submitting = createStatus === 'loading'
  const outcomes = outcomesFor(field)

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-950">
            Create Context
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Create an ecosystem context and define relationship needs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit(true)}
            disabled={submitting || !name.trim() || !field.trim()}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
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
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            Save as Draft
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
      >
        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <header className="flex items-center gap-2">
              <StepBadge step={1} />
              <h2 className="text-base font-bold text-gray-950">
                Basic Context Information
              </h2>
            </header>

            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              <label className="flex flex-col gap-1">
                <FieldLabel required>Context Name</FieldLabel>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tech Summit KL 2026"
                  className="h-11 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none focus:border-blue-500"
                />
              </label>

              <label className="flex flex-col gap-1">
                <FieldLabel required>Context Type</FieldLabel>
                <select
                  value={contextType}
                  onChange={(e) => setContextType(e.target.value)}
                  className="h-11 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none focus:border-blue-500"
                >
                  {CONTEXT_TYPES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-col gap-1">
                <FieldLabel required>Field / Sector</FieldLabel>
                <FieldSelect value={field} onChange={setField} />
              </div>

              <label className="flex flex-col gap-1 sm:col-span-2">
                <FieldLabel required>Description</FieldLabel>
                <div className="relative">
                  <textarea
                    value={description}
                    maxLength={DESCRIPTION_LIMIT}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Describe the context, who should be in the room, and what you hope to achieve."
                    className="block w-full resize-none rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500"
                  />
                  <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] font-medium text-gray-400">
                    {description.length} / {DESCRIPTION_LIMIT}
                  </span>
                </div>
              </label>

              <div className="flex flex-col gap-1">
                <FieldLabel required>Date / Duration</FieldLabel>
                <div className="flex h-11 items-center rounded-xl border border-gray-300 bg-white px-2 text-sm text-gray-800 focus-within:border-blue-500">
                  <svg
                    className="ml-1 h-4 w-4 text-gray-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <rect width="16" height="17" x="4" y="5" rx="2" />
                    <path d="M8 3v4" />
                    <path d="M16 3v4" />
                    <path d="M4 10h16" />
                  </svg>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent px-2 outline-none"
                  />
                  <span className="px-1 text-gray-400">—</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent px-2 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <FieldLabel required>Location Type</FieldLabel>
                <SegmentedControl<LocationKind>
                  value={locationType}
                  onChange={setLocationType}
                  options={[
                    { value: 'physical', label: 'Physical' },
                    { value: 'virtual', label: 'Virtual' },
                    { value: 'hybrid', label: 'Hybrid' },
                  ]}
                />
              </div>

              <label className="flex flex-col gap-1">
                <FieldLabel required>Location</FieldLabel>
                <div className="flex h-11 items-center rounded-xl border border-gray-300 bg-white px-3 text-sm focus-within:border-blue-500">
                  <svg
                    className="h-4 w-4 text-gray-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={
                      locationType === 'virtual'
                        ? 'Meeting link or platform'
                        : 'Kuala Lumpur Convention Centre'
                    }
                    className="ml-2 min-w-0 flex-1 bg-transparent text-gray-800 outline-none"
                  />
                </div>
              </label>

              <div className="flex flex-col gap-1">
                <FieldLabel required>Status</FieldLabel>
                <SegmentedControl<DraftStatus>
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: 'draft', label: 'Draft' },
                    { value: 'open', label: 'Open' },
                  ]}
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <FieldLabel>Upload Image (Optional)</FieldLabel>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-28 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 text-center hover:border-blue-400 hover:bg-blue-50/30"
                >
                  <svg
                    className="h-6 w-6 text-gray-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span className="text-xs font-semibold text-gray-600">
                    Upload context banner or logo
                  </span>
                  <span className="text-[11px] text-gray-400">
                    JPG, PNG, WEBP up to 5MB
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <div className="relative h-28 overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                  {imagePreview ? (
                    <>
                      <img
                        src={imagePreview}
                        alt={imageName || 'Context banner preview'}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={clearImage}
                        aria-label="Remove image"
                        className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center text-[11px] text-gray-400">
                      No image selected
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <StepBadge step={2} />
                <div>
                  <h2 className="text-base font-bold text-gray-950">
                    Relationship Needs
                  </h2>
                  <p className="text-xs text-gray-500">
                    Define the roles and relationships you need. These will be
                    used by Gemini AI to recommend relevant linkages.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSuggest}
                disabled={!field.trim() || suggestStatus === 'loading'}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                  <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
                </svg>
                {suggestStatus === 'loading'
                  ? 'Asking Gemini…'
                  : 'Suggest with AI'}
              </button>
            </header>

            {suggestError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {suggestError}
              </p>
            )}

            <div className="mt-5 overflow-x-auto">
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
                    No relationship needs yet. Add one below or let AI suggest
                    them.
                  </p>
                )}

                {needs.map((need, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1.2fr_0.9fr_1.4fr_1.4fr_0.4fr] items-center gap-3 border-b border-gray-50 py-3"
                  >
                    <select
                      value={need.role}
                      onChange={(e) =>
                        updateNeed(index, {
                          role: e.target.value as RelationshipRole,
                        })
                      }
                      className="h-10 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-700 outline-none focus:border-blue-500"
                    >
                      {RELATIONSHIP_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>

                    <div className="inline-flex h-10 items-center rounded-lg border border-gray-300 bg-white">
                      <button
                        type="button"
                        onClick={() =>
                          updateNeed(index, {
                            count: Math.max(1, need.count - 1),
                          })
                        }
                        aria-label="Decrease count"
                        className="grid h-full w-9 place-items-center text-gray-500 hover:text-gray-800"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={need.count}
                        onChange={(e) =>
                          updateNeed(index, {
                            count: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="h-full w-10 border-x border-gray-200 bg-transparent text-center text-sm font-semibold text-gray-800 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateNeed(index, { count: need.count + 1 })
                        }
                        aria-label="Increase count"
                        className="grid h-full w-9 place-items-center text-gray-500 hover:text-gray-800"
                      >
                        +
                      </button>
                    </div>

                    <KeywordTags
                      value={need.keywords}
                      onChange={(next) =>
                        updateNeed(index, { keywords: next })
                      }
                    />

                    <input
                      value={need.requirements}
                      onChange={(e) =>
                        updateNeed(index, { requirements: e.target.value })
                      }
                      placeholder="Describe who fits this role…"
                      className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-blue-500"
                    />

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeNeed(index)}
                        aria-label="Remove relationship need"
                        className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500"
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
              onClick={addNeed}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50"
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
          </section>

          {createError && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {createError}
            </p>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-blue-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              <h3 className="text-sm font-bold text-gray-950">
                Validation Checklist
              </h3>
            </div>
            <ul className="mt-3 space-y-1.5">
              {validation.map((item) => (
                <CheckRow key={item.label} ok={item.ok} label={item.label} />
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-blue-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="8" y1="13" x2="16" y2="13" />
                <line x1="8" y1="17" x2="14" y2="17" />
              </svg>
              <h3 className="text-sm font-bold text-gray-950">
                Context Summary
              </h3>
            </div>
            <dl className="mt-3 space-y-2.5 text-xs">
              <div>
                <dt className="font-semibold text-gray-500">Context Name</dt>
                <dd className="mt-0.5 text-gray-900">
                  {name || <span className="text-gray-400">—</span>}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-500">Type</dt>
                <dd className="mt-0.5">
                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                    {contextType}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-500">Field / Sector</dt>
                <dd className="mt-0.5 text-gray-900">
                  {field || <span className="text-gray-400">—</span>}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-500">Date / Duration</dt>
                <dd className="mt-0.5 text-gray-900">
                  {startDate ? (
                    <>
                      {formatDate(startDate)}
                      {endDate ? ` – ${formatDate(endDate)}` : ''}
                    </>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-500">Location</dt>
                <dd className="mt-0.5 text-gray-900">
                  {location || <span className="text-gray-400">—</span>}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-500">Status</dt>
                <dd className="mt-0.5">
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${
                      status === 'open'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {status}
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-950">Target Outcomes</h3>
            <ul className="mt-3 space-y-2 text-[13px]">
              {outcomes.map((outcome) => (
                <li
                  key={outcome}
                  className="flex items-start gap-2 text-gray-700"
                >
                  <svg
                    className="mt-0.5 h-4 w-4 shrink-0 text-blue-600"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                  <span>{outcome}</span>
                </li>
              ))}
            </ul>
          </section>

          <button
            type="submit"
            disabled={submitting || !allValid}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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
              <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
            </svg>
            {submitting ? 'Creating…' : 'Create & Generate'}
            <span aria-hidden>→</span>
          </button>
        </aside>
      </form>
    </div>
  )
}
