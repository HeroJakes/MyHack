/**
 * CreateContext — the Create Context page.
 *
 * Three-column layout (sidebar nav | main form | summary rail). The main
 * column has two numbered sections (Basic Context Information, Relationship
 * Needs); the rail stacks the Validation Checklist, Context Summary and Target
 * Outcomes panels. Every form field is owned by the useCreateContext hook —
 * this component holds only UI-only state (open dropdowns, drag state, the
 * unsaved-changes modal and the custom-outcome draft).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  ChangeEvent,
  DragEvent,
  KeyboardEvent,
  ReactNode,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import RoleRequirementForm from '../components/RoleRequirementForm'
import { db } from '../lib/firebase'
import { useCreateContext } from '../hooks/useCreateContext'
import type {
  ContextFormData,
  ContextRelationshipNeed,
  ContextType,
  ExistingContextTarget,
  LocationType,
  ValidationKey,
} from '../hooks/useCreateContext'
import { useSuggestRelationshipNeeds } from '../hooks/useSuggestRelationshipNeeds'

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
const INPUT_FOCUS =
  'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20'

const NAME_LIMIT = 100
const DESCRIPTION_LIMIT = 1000
const DESCRIPTION_MIN = 20
const MAX_OUTCOMES = 10
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const CONTEXT_TYPE_OPTIONS: { value: ContextType; label: string }[] = [
  { value: 'Event', label: 'Event' },
  { value: 'Programme', label: 'Programme' },
  { value: 'Initiative', label: 'Initiative' },
  { value: 'Cohort', label: 'Cohort' },
  { value: 'CountryExpansion', label: 'Country Expansion' },
]

const FIELD_OPTIONS = [
  'FinTech',
  'HealthTech',
  'AgriTech',
  'SaaS',
  'Cybersecurity',
  'EdTech',
  'Supply Chain',
  'Government',
  'GreenTech',
  'PropTech',
  'E-commerce',
  'Logistics',
  'AI / ML',
  'Deep Tech',
]

const LOCATION_TYPE_OPTIONS: { value: LocationType; label: string }[] = [
  { value: 'Physical', label: 'Physical' },
  { value: 'Virtual', label: 'Virtual' },
  { value: 'Hybrid', label: 'Hybrid' },
]

const STATUS_OPTIONS: { value: 'draft' | 'open'; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
]

const CHECKLIST: { key: ValidationKey; label: string }[] = [
  { key: 'nameProvided', label: 'Context name provided' },
  { key: 'typeSelected', label: 'Context type selected' },
  { key: 'fieldSelected', label: 'Field / sector selected' },
  { key: 'descriptionAdded', label: 'Description added' },
  { key: 'dateSelected', label: 'Date selected' },
  { key: 'locationProvided', label: 'Location provided' },
  { key: 'needAdded', label: 'Relationship need added' },
  { key: 'countValid', label: 'Count valid' },
]

function contextTypeLabel(value: ContextType): string {
  return CONTEXT_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value
}

function formatDate(value: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Default target-outcome suggestions, keyed off the chosen field. */
function suggestedOutcomes(field: string): string[] {
  const sector = field.trim()
  return [
    'Facilitate high-value connections',
    sector ? `Promote ${sector} innovation` : 'Promote sector innovation',
    'Enable partnerships and pilot opportunities',
    "Strengthen Malaysia's ecosystem",
    'Support early-stage startups',
    'Drive cross-sector collaboration',
  ]
}

function toDateInputValue(value: unknown): string {
  if (!value) return ''
  const maybeTimestamp = value as { toDate?: () => Date; seconds?: number }
  let date: Date | null = null
  if (typeof maybeTimestamp.toDate === 'function') {
    date = maybeTimestamp.toDate()
  } else if (typeof maybeTimestamp.seconds === 'number') {
    date = new Date(maybeTimestamp.seconds * 1000)
  } else if (value instanceof Date) {
    date = value
  }
  if (!date || Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function normalizeStatus(value: unknown): 'draft' | 'open' {
  return value === 'draft' ? 'draft' : 'open'
}

function normalizeNeeds(value: unknown): ContextRelationshipNeed[] {
  if (!Array.isArray(value)) return []
  return value.map((need) => ({
    role: need.role || 'Mentor',
    count: Math.max(1, Number(need.count ?? 1)),
    relationshipType: need.relationshipType || 'mentor_match',
    requirements: need.requirements || '',
    keywords: Array.isArray(need.keywords) ? need.keywords : [],
  })) as ContextRelationshipNeed[]
}

export default function CreateContext() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const {
    formData,
    setField,
    replaceForm,
    relationshipNeeds,
    addNeed,
    updateNeed,
    removeNeed,
    validationState,
    isValid,
    isDirty,
    loading,
    error,
    submit,
  } = useCreateContext()
  const [existingTarget, setExistingTarget] = useState<ExistingContextTarget | null>(null)
  const [editLoading, setEditLoading] = useState(false)

  const { suggestNeeds, status: suggestStatus } = useSuggestRelationshipNeeds()

  // UI-only state.
  const [dragging, setDragging] = useState(false)
  const [imageError, setImageError] = useState('')
  const [customOutcome, setCustomOutcome] = useState('')
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editId) {
      setExistingTarget(null)
      return
    }

    let cancelled = false
    setEditLoading(true)

    async function loadContextForEdit() {
      const ecoSnap = await getDoc(doc(db, 'ecosystemContexts', editId as string))
      if (cancelled) return

      if (ecoSnap.exists()) {
        const data = ecoSnap.data()
        const next: ContextFormData = {
          name: String(data.name ?? ''),
          contextType: (data.contextType ?? 'Event') as ContextType,
          field: String(data.field ?? ''),
          description: String(data.description ?? ''),
          locationType: (data.locationType ?? 'Physical') as LocationType,
          location: String(data.location ?? ''),
          startDate: toDateInputValue(data.startDate),
          endDate: toDateInputValue(data.endDate),
          status: normalizeStatus(data.status),
          imageUrl: String(data.imageUrl ?? ''),
          targetOutcomes: Array.isArray(data.targetOutcomes)
            ? data.targetOutcomes.map(String)
            : [],
          relationshipNeeds: normalizeNeeds(data.relationshipNeeds),
        }
        replaceForm(next)
        setExistingTarget({ id: ecoSnap.id, collection: 'ecosystemContexts' })
        setEditLoading(false)
        return
      }

      const eventSnap = await getDoc(doc(db, 'events', editId as string))
      if (cancelled) return
      if (eventSnap.exists()) {
        const data = eventSnap.data()
        const date = toDateInputValue(data.eventDate)
        replaceForm({
          name: String(data.name ?? ''),
          contextType: 'Event',
          field: String(data.field ?? ''),
          description: String(data.description ?? ''),
          locationType: (data.locationType ?? 'Physical') as LocationType,
          location: String(data.location ?? ''),
          startDate: date,
          endDate: date,
          status: normalizeStatus(data.status),
          imageUrl: String(data.imageUrl ?? ''),
          targetOutcomes: Array.isArray(data.targetOutcomes)
            ? data.targetOutcomes.map(String)
            : [],
          relationshipNeeds: normalizeNeeds(data.roleRequirements),
        })
        setExistingTarget({ id: eventSnap.id, collection: 'events' })
      }
      setEditLoading(false)
    }

    void loadContextForEdit().catch(() => setEditLoading(false))
    return () => {
      cancelled = true
    }
  }, [editId, replaceForm])

  const suggestions = useMemo(
    () => suggestedOutcomes(formData.field),
    [formData.field],
  )

  // The visible outcome list = suggestions for the current field plus any
  // checked (incl. custom-added) outcomes, de-duplicated.
  const outcomeList = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    for (const outcome of [...suggestions, ...formData.targetOutcomes]) {
      const key = outcome.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        list.push(outcome)
      }
    }
    return list
  }, [suggestions, formData.targetOutcomes])

  const submitting = loading

  // --- Image upload -------------------------------------------------------

  const processFile = (file: File) => {
    if (!IMAGE_TYPES.includes(file.type)) {
      setImageError('Please upload a JPG, PNG or WEBP image.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Image must be 5MB or smaller.')
      return
    }
    setImageError('')
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setField('imageUrl', reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const clearImage = () => {
    setField('imageUrl', '')
    setImageError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // --- Target outcomes ----------------------------------------------------

  const toggleOutcome = (outcome: string) => {
    const checked = formData.targetOutcomes.some(
      (o) => o.toLowerCase() === outcome.toLowerCase(),
    )
    if (checked) {
      setField(
        'targetOutcomes',
        formData.targetOutcomes.filter(
          (o) => o.toLowerCase() !== outcome.toLowerCase(),
        ),
      )
    } else if (formData.targetOutcomes.length < MAX_OUTCOMES) {
      setField('targetOutcomes', [...formData.targetOutcomes, outcome])
    }
  }

  const addCustomOutcome = () => {
    const value = customOutcome.trim().slice(0, 100)
    if (!value || formData.targetOutcomes.length >= MAX_OUTCOMES) return
    if (
      formData.targetOutcomes.some(
        (o) => o.toLowerCase() === value.toLowerCase(),
      )
    ) {
      setCustomOutcome('')
      return
    }
    setField('targetOutcomes', [...formData.targetOutcomes, value])
    setCustomOutcome('')
  }

  // --- AI suggestions -----------------------------------------------------

  const handleSuggest = async () => {
    if (!formData.field.trim() || suggestStatus === 'loading') return
    try {
      const suggested = await suggestNeeds({
        field: formData.field,
        description: formData.description,
      })
      const mapped: ContextRelationshipNeed[] = suggested.map((need) => ({
        role: need.role,
        count: Math.min(20, Math.max(1, Math.round(need.count))),
        relationshipType: need.relationshipType,
        requirements: need.requirements,
        keywords: [],
      }))
      setField('relationshipNeeds', mapped)
    } catch {
      // Surfaced inline via suggestStatus below.
    }
  }

  // --- Submit / cancel ----------------------------------------------------

  const handleSubmit = async (status: 'draft' | 'open') => {
    const contextId = await submit(status, existingTarget)
    if (contextId) navigate(`/contexts/${contextId}`)
  }

  const handleCancel = () => {
    if (isDirty) setShowLeaveConfirm(true)
    else navigate(-1)
  }

  const locationRequired = formData.locationType !== 'Virtual'

  return (
    <div>
      {/* Header bar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-950">
            {existingTarget ? 'Edit Context' : 'Create Context'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {existingTarget
              ? 'Update this context and its relationship needs.'
              : 'Create an ecosystem context and define relationship needs.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 ${FOCUS_RING}`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit('draft')}
            disabled={submitting || !isValid}
            className={`inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            {submitting ? (
              <Spinner />
            ) : (
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
            )}
            {existingTarget ? 'Save Draft' : 'Save as Draft'}
          </button>
        </div>
      </div>

      {editLoading ? (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-5 py-8 text-sm font-semibold text-gray-500 shadow-sm">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
          Loading context details...
        </div>
      ) : (
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main column */}
        <div className="space-y-6">
          {/* Section 1 — Basic Context Information */}
          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <header className="flex items-center gap-2">
              <StepBadge step={1} />
              <h2 className="text-base font-bold text-gray-950">
                Basic Context Information
              </h2>
            </header>

            <div className="mt-5 space-y-5">
              {/* Row 1 — Context Name */}
              <label className="flex flex-col gap-1">
                <FieldLabel required>Context Name</FieldLabel>
                <input
                  value={formData.name}
                  maxLength={NAME_LIMIT}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="Tech Summit KL 2026"
                  className={`h-11 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-800 ${INPUT_FOCUS}`}
                />
                <span className="self-end text-[11px] font-medium text-gray-400">
                  {formData.name.length} / {NAME_LIMIT}
                </span>
              </label>

              {/* Row 2 — Context Type | Field / Sector */}
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <FieldLabel required>Context Type</FieldLabel>
                  <select
                    value={formData.contextType}
                    onChange={(e) =>
                      setField('contextType', e.target.value as ContextType)
                    }
                    className={`h-11 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-800 ${INPUT_FOCUS}`}
                  >
                    {CONTEXT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex flex-col gap-1">
                  <FieldLabel required>Field / Sector</FieldLabel>
                  <FieldSelect
                    value={formData.field}
                    onChange={(next) => setField('field', next)}
                  />
                </div>
              </div>

              {/* Row 3 — Description */}
              <label className="flex flex-col gap-1">
                <FieldLabel required>Description</FieldLabel>
                <div className="relative">
                  <textarea
                    value={formData.description}
                    maxLength={DESCRIPTION_LIMIT}
                    onChange={(e) => setField('description', e.target.value)}
                    rows={4}
                    placeholder="Describe the context, who should be in the room, and what you hope to achieve."
                    className={`block w-full resize-none rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 ${INPUT_FOCUS}`}
                  />
                  <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] font-medium text-gray-400">
                    {formData.description.length} / {DESCRIPTION_LIMIT}
                  </span>
                </div>
                {formData.description.length > 0 &&
                  formData.description.trim().length < DESCRIPTION_MIN && (
                    <span className="text-[11px] font-medium text-amber-600">
                      Minimum {DESCRIPTION_MIN} characters.
                    </span>
                  )}
              </label>

              {/* Row 4 — Date / Duration */}
              <div className="flex flex-col gap-1">
                <FieldLabel required>Date / Duration</FieldLabel>
                <div
                  className={`flex h-11 items-center rounded-xl border border-gray-300 bg-white px-2 text-sm text-gray-800 focus-within:border-blue-500`}
                >
                  <svg
                    className="ml-1 h-4 w-4 shrink-0 text-gray-400"
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
                    aria-label="Start date"
                    value={formData.startDate}
                    onChange={(e) => setField('startDate', e.target.value)}
                    className={`min-w-0 flex-1 rounded bg-transparent px-2 ${FOCUS_RING}`}
                  />
                  <span className="px-1 text-gray-400">—</span>
                  <input
                    type="date"
                    aria-label="End date"
                    value={formData.endDate}
                    min={formData.startDate || undefined}
                    onChange={(e) => setField('endDate', e.target.value)}
                    className={`min-w-0 flex-1 rounded bg-transparent px-2 ${FOCUS_RING}`}
                  />
                </div>
              </div>

              {/* Row 5 — Location Type | Location | Status */}
              <div className="grid gap-5 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <FieldLabel required>Location Type</FieldLabel>
                  <SegmentedControl
                    ariaLabel="Location type"
                    value={formData.locationType}
                    onChange={(next) => setField('locationType', next)}
                    options={LOCATION_TYPE_OPTIONS}
                  />
                </div>

                <label className="flex flex-col gap-1">
                  <FieldLabel required={locationRequired}>
                    Location
                  </FieldLabel>
                  <div
                    className={`flex h-11 items-center rounded-xl border border-gray-300 bg-white px-3 text-sm focus-within:border-blue-500`}
                  >
                    <svg
                      className="h-4 w-4 shrink-0 text-gray-400"
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
                      value={formData.location}
                      onChange={(e) => setField('location', e.target.value)}
                      placeholder={
                        formData.locationType === 'Virtual'
                          ? 'Meeting link (optional)'
                          : 'Kuala Lumpur Convention Centre'
                      }
                      aria-label="Location"
                      className="ml-2 min-w-0 flex-1 bg-transparent text-gray-800 outline-none"
                    />
                  </div>
                </label>

                <div className="flex flex-col gap-1">
                  <FieldLabel required>Status</FieldLabel>
                  <SegmentedControl
                    ariaLabel="Status"
                    value={formData.status}
                    onChange={(next) => setField('status', next)}
                    options={STATUS_OPTIONS}
                  />
                </div>
              </div>

              {/* Row 6 — Upload Image */}
              <div className="flex flex-col gap-2">
                <FieldLabel>Upload Image (Optional)</FieldLabel>
                <div
                  className={
                    formData.imageUrl
                      ? 'grid gap-3 sm:grid-cols-2'
                      : 'grid gap-3'
                  }
                >
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragging(true)
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    className={`flex h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 text-center transition-colors ${FOCUS_RING} ${
                      dragging
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/30'
                    }`}
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
                      Drag &amp; drop, or click to upload
                    </span>
                    <span className="text-[11px] text-gray-400">
                      JPG, PNG, WEBP up to 5MB
                    </span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {formData.imageUrl && (
                    <div className="relative h-32 overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                      <img
                        src={formData.imageUrl}
                        alt="Context banner preview"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={clearImage}
                        aria-label="Remove image"
                        className={`absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80 ${FOCUS_RING}`}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
                {imageError && (
                  <p className="text-[11px] font-medium text-red-600">
                    {imageError}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Section 2 — Relationship Needs */}
          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <StepBadge step={2} />
                <div>
                  <h2 className="text-base font-bold text-gray-950">
                    Relationship Needs
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Define the roles and relationships you need. These will be
                    used by Gemini AI to recommend relevant linkages.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleSuggest()}
                disabled={!formData.field.trim() || suggestStatus === 'loading'}
                className={`inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
              >
                {suggestStatus === 'loading' ? (
                  <Spinner />
                ) : (
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
                )}
                {suggestStatus === 'loading'
                  ? 'Asking Gemini…'
                  : 'Suggest with AI'}
              </button>
            </header>

            {suggestStatus === 'error' && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                AI suggestion failed. Please define needs manually.
              </p>
            )}

            <div className="mt-5">
              <RoleRequirementForm
                needs={relationshipNeeds}
                onAdd={addNeed}
                onUpdate={updateNeed}
                onRemove={removeNeed}
              />
            </div>

            {error && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end border-t border-gray-100 pt-5">
              <button
                type="button"
                onClick={() => void handleSubmit('open')}
                disabled={submitting || !isValid}
                className={`inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
              >
                {submitting ? <Spinner /> : null}
                {submitting
                  ? existingTarget
                    ? 'Saving...'
                    : 'Creating...'
                  : existingTarget
                    ? 'Save Changes'
                    : 'Create & Generate'}
                {!submitting && <span aria-hidden>→</span>}
              </button>
            </div>
          </section>
        </div>

        {/* Right rail */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {/* Validation Checklist */}
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
              {CHECKLIST.map((item) => (
                <CheckRow
                  key={item.key}
                  ok={validationState[item.key]}
                  label={item.label}
                />
              ))}
            </ul>
          </section>

          {/* Context Summary */}
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
              <SummaryRow label="Context Name">
                {formData.name || <Dash />}
              </SummaryRow>
              <div>
                <dt className="font-semibold text-gray-500">Type</dt>
                <dd className="mt-0.5">
                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                    {contextTypeLabel(formData.contextType)}
                  </span>
                </dd>
              </div>
              <SummaryRow label="Field / Sector">
                {formData.field || <Dash />}
              </SummaryRow>
              <SummaryRow label="Date / Duration">
                {formData.startDate ? (
                  <>
                    {formatDate(formData.startDate)}
                    {formData.endDate
                      ? ` — ${formatDate(formData.endDate)}`
                      : ''}
                  </>
                ) : (
                  <Dash />
                )}
              </SummaryRow>
              <SummaryRow label="Location">
                {formData.location || <Dash />}
              </SummaryRow>
              <div>
                <dt className="font-semibold text-gray-500">Status</dt>
                <dd className="mt-0.5">
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${
                      formData.status === 'open'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {formData.status}
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          {/* Target Outcomes */}
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-950">
                Target Outcomes
              </h3>
              <span className="text-[11px] font-medium text-gray-400">
                {formData.targetOutcomes.length} / {MAX_OUTCOMES}
              </span>
            </div>
            <ul className="mt-3 space-y-1.5">
              {outcomeList.map((outcome) => {
                const checked = formData.targetOutcomes.some(
                  (o) => o.toLowerCase() === outcome.toLowerCase(),
                )
                const atCap =
                  !checked &&
                  formData.targetOutcomes.length >= MAX_OUTCOMES
                return (
                  <li key={outcome}>
                    <label
                      className={`flex items-start gap-2 text-[13px] ${
                        atCap ? 'opacity-50' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={atCap}
                        onChange={() => toggleOutcome(outcome)}
                        className={`mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 ${FOCUS_RING}`}
                      />
                      <span
                        className={checked ? 'text-gray-800' : 'text-gray-600'}
                      >
                        {outcome}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
            <div className="mt-3 flex items-center gap-2">
              <input
                value={customOutcome}
                maxLength={100}
                onChange={(e) => setCustomOutcome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustomOutcome()
                  }
                }}
                disabled={formData.targetOutcomes.length >= MAX_OUTCOMES}
                placeholder="Add a custom outcome…"
                aria-label="Add a custom target outcome"
                className={`h-9 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-xs text-gray-800 disabled:bg-gray-50 ${INPUT_FOCUS}`}
              />
              <button
                type="button"
                onClick={addCustomOutcome}
                disabled={
                  !customOutcome.trim() ||
                  formData.targetOutcomes.length >= MAX_OUTCOMES
                }
                aria-label="Add custom outcome"
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
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
              </button>
            </div>
          </section>
        </aside>
      </div>
      )}

      {/* Unsaved-changes confirmation */}
      {showLeaveConfirm && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-dialog-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2
              id="leave-dialog-title"
              className="text-base font-bold text-gray-950"
            >
              Leave this page?
            </h2>
            <p className="mt-1.5 text-sm text-gray-500">
              You have unsaved changes. Leave anyway?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 ${FOCUS_RING}`}
              >
                Stay
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLeaveConfirm(false)
                  navigate(-1)
                }}
                className={`rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 ${FOCUS_RING}`}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Presentational helpers                                                     */
/* -------------------------------------------------------------------------- */

function Dash() {
  return <span className="text-gray-400">—</span>
}

function Spinner() {
  return (
    <span
      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
      aria-hidden
    />
  )
}

function StepBadge({ step }: { step: number }) {
  return (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white">
      {step}
    </span>
  )
}

function FieldLabel({
  children,
  required,
}: {
  children: ReactNode
  required?: boolean
}) {
  return (
    <span className="text-xs font-semibold text-gray-700">
      {children}
      {required ? <span className="ml-0.5 text-red-500">*</span> : null}
    </span>
  )
}

function SummaryRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div>
      <dt className="font-semibold text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-gray-900">{children}</dd>
    </div>
  )
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
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

/** Keyboard-accessible segmented radio group with arrow-key navigation. */
function SegmentedControl<T extends string>({
  ariaLabel,
  value,
  onChange,
  options,
}: {
  ariaLabel: string
  value: T
  onChange: (next: T) => void
  options: { value: T; label: string }[]
}) {
  const groupRef = useRef<HTMLDivElement>(null)

  const move = (index: number, delta: number) => {
    const next = (index + delta + options.length) % options.length
    onChange(options[next].value)
    const buttons =
      groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    buttons?.[next]?.focus()
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex w-full rounded-xl border border-gray-200 bg-gray-50 p-1"
    >
      {options.map((opt, index) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault()
                move(index, 1)
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault()
                move(index, -1)
              }
            }}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${FOCUS_RING} ${
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

/** Single-select Field / Sector dropdown with a removable tag display. */
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
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:border-gray-400 ${FOCUS_RING}`}
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
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${FOCUS_RING} ${
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
