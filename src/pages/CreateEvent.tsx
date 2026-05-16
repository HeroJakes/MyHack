/**
 * CreateEvent — form to create a new event/context.
 *
 * The organizer fills in the basics, then either hand-builds the relationship
 * needs with RoleRequirementForm or asks Gemini to suggest them. Submitting
 * calls the createEvent Cloud Function and navigates to the new event.
 */
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateEvent } from '../hooks/useCreateEvent'
import { useSuggestRelationshipNeeds } from '../hooks/useSuggestRelationshipNeeds'
import RoleRequirementForm from '../components/RoleRequirementForm'
import type { RelationshipNeed } from '../types'

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
  const [type, setType] = useState('Summit')
  const [field, setField] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [needs, setNeeds] = useState<RelationshipNeed[]>([])

  const handleSuggest = async () => {
    if (!field.trim()) return
    try {
      const suggested = await suggestNeeds({ field, description })
      setNeeds(suggested)
    } catch {
      // Error surfaced via suggestError below.
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const result = await createEvent({
        name,
        type,
        field,
        description,
        roleRequirements: needs,
        eventDate: eventDate ? new Date(eventDate).getTime() : undefined,
      })
      navigate(`/events/${result.eventId}`)
    } catch {
      // Error surfaced via createError below.
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Create Event</h1>
      <p className="text-sm text-gray-500">
        An event is the first kind of PoyoLink context.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col text-sm font-medium text-gray-700">
              Event name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tech Summit KL 2026"
                className="mt-1 h-10 rounded-lg border border-gray-300 px-3 text-sm"
              />
            </label>

            <label className="flex flex-col text-sm font-medium text-gray-700">
              Type
              <input
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="Summit, Demo Day, Cohort…"
                className="mt-1 h-10 rounded-lg border border-gray-300 px-3 text-sm"
              />
            </label>

            <label className="flex flex-col text-sm font-medium text-gray-700">
              Field / sector
              <input
                required
                value={field}
                onChange={(e) => setField(e.target.value)}
                placeholder="FinTech"
                className="mt-1 h-10 rounded-lg border border-gray-300 px-3 text-sm"
              />
            </label>

            <label className="flex flex-col text-sm font-medium text-gray-700">
              Event date (optional)
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="mt-1 h-10 rounded-lg border border-gray-300 px-3 text-sm"
              />
            </label>
          </div>

          <label className="mt-4 flex flex-col text-sm font-medium text-gray-700">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What is this event about and who should be in the room?"
              className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-gray-900">Relationship needs</h2>
            <button
              type="button"
              onClick={handleSuggest}
              disabled={!field.trim() || suggestStatus === 'loading'}
              className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {suggestStatus === 'loading'
                ? 'Asking Gemini…'
                : '✨ Suggest with AI'}
            </button>
          </div>

          {suggestError && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {suggestError}
            </p>
          )}
          {suggestStatus === 'success' && (
            <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              AI suggested {needs.length} relationship needs — edit them freely.
            </p>
          )}

          <div className="mt-3">
            <RoleRequirementForm value={needs} onChange={setNeeds} />
          </div>
        </div>

        {createError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {createError}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={createStatus === 'loading'}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createStatus === 'loading' ? 'Creating…' : 'Create event'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
