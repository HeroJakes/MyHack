/**
 * EventDetail — the organizer's workspace for one event.
 *
 *  - Shows the event and its relationship needs.
 *  - "Generate participants" runs the AI match engine; suggestions stream in
 *    live from suggestions/{eventId}/participants.
 *  - The organizer selects suggestions and sends invites in a batch.
 *  - "Link tracking" lists the ecosystem links created for this context.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  collection,
  doc,
  onSnapshot,
  query,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useGenerateParticipants } from '../hooks/useGenerateParticipants'
import { useSendInvites } from '../hooks/useSendInvites'
import { useEcosystemLinks } from '../hooks/useEcosystemLinks'
import ParticipantCard from '../components/ParticipantCard'
import EcosystemLinkCard from '../components/EcosystemLinkCard'
import type { EcoEvent, ParticipantSuggestion } from '../types'

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()

  const [event, setEvent] = useState<EcoEvent | null>(null)
  const [eventLoading, setEventLoading] = useState(true)
  const [eventError, setEventError] = useState('')

  const [suggestions, setSuggestions] = useState<ParticipantSuggestion[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const {
    generateParticipants,
    status: genStatus,
    error: genError,
  } = useGenerateParticipants()
  const {
    sendInvites,
    status: sendStatus,
    error: sendError,
    data: sendData,
  } = useSendInvites()
  const { links } = useEcosystemLinks()

  // Live event document.
  useEffect(() => {
    if (!eventId) return
    setEventLoading(true)
    const unsubscribe = onSnapshot(
      doc(db, 'events', eventId),
      (snap) => {
        if (snap.exists()) {
          setEvent({ id: snap.id, ...snap.data() } as EcoEvent)
        } else {
          setEventError('This event no longer exists.')
        }
        setEventLoading(false)
      },
      (err) => {
        setEventError(err.message)
        setEventLoading(false)
      },
    )
    return unsubscribe
  }, [eventId])

  // Live participant suggestions for this context.
  useEffect(() => {
    if (!eventId) return
    const participantsQuery = query(
      collection(db, 'suggestions', eventId, 'participants'),
    )
    const unsubscribe = onSnapshot(participantsQuery, (snap) => {
      const rows = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as ParticipantSuggestion,
      )
      rows.sort((a, b) => a.rank - b.rank)
      setSuggestions(rows)
    })
    return unsubscribe
  }, [eventId])

  const contextLinks = useMemo(
    () => links.filter((link) => link.contextId === eventId),
    [links, eventId],
  )

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleGenerate = async () => {
    if (!eventId) return
    setSelected(new Set())
    try {
      await generateParticipants(eventId)
    } catch {
      // Error surfaced via genError below.
    }
  }

  const handleSendInvites = async () => {
    if (!eventId) return
    const chosen = suggestions.filter((s) => selected.has(s.id))
    if (chosen.length === 0) return
    try {
      await sendInvites(
        eventId,
        chosen.map((s) => ({
          userId: s.userId,
          suggestedRole: s.suggestedRole,
          relationshipType: s.relationshipType,
          reason: s.reason,
          confidence: s.confidence,
        })),
      )
      setSelected(new Set())
      navigate('/contexts')
    } catch {
      // Error surfaced via sendError below.
    }
  }

  if (eventLoading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-gray-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
        Loading event…
      </div>
    )
  }

  if (eventError || !event) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
        {eventError || 'Event not found.'}
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
            <p className="text-sm text-gray-500">
              {event.type} · {event.field} · {event.contextType}
            </p>
          </div>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-600">
            {event.status}
          </span>
        </div>
        {event.description && (
          <p className="mt-3 text-sm text-gray-700">{event.description}</p>
        )}

        <div className="mt-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Relationship needs
          </h2>
          {event.roleRequirements.length === 0 ? (
            <p className="mt-1 text-sm text-gray-500">
              No relationship needs defined for this event.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {event.roleRequirements.map((need, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center gap-2 text-sm text-gray-700"
                >
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {need.count}× {need.role}
                  </span>
                  <span className="text-xs text-gray-400">
                    {need.relationshipType}
                  </span>
                  <span className="text-gray-600">— {need.requirements}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      {/* Participant suggestions */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-gray-900">
              AI participant suggestions
            </h2>
            <p className="text-sm text-gray-500">
              Rule pre-filter plus Gemini ranking.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={genStatus === 'loading'}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {genStatus === 'loading'
              ? 'Matching…'
              : suggestions.length > 0
                ? 'Regenerate'
                : 'Generate participants'}
          </button>
        </div>

        {genError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {genError}
          </p>
        )}

        {suggestions.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
            {genStatus === 'loading'
              ? 'Generating suggestions…'
              : 'No suggestions yet. Generate participants to begin.'}
          </p>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {suggestions.map((suggestion) => (
                <ParticipantCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  selected={selected.has(suggestion.id)}
                  onToggle={toggleSelect}
                />
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSendInvites}
                disabled={selected.size === 0 || sendStatus === 'loading'}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sendStatus === 'loading'
                  ? 'Sending…'
                  : `Send ${selected.size} invite${selected.size === 1 ? '' : 's'}`}
              </button>
              {sendStatus === 'success' && sendData && (
                <span className="text-sm text-green-700">
                  Sent {sendData.count} invite
                  {sendData.count === 1 ? '' : 's'}.
                </span>
              )}
              {sendError && (
                <span className="text-sm text-red-600">{sendError}</span>
              )}
            </div>
          </>
        )}
      </section>

      {/* Link tracking */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold text-gray-900">Link tracking</h2>
        <p className="text-sm text-gray-500">
          Ecosystem links created from confirmed invites for this event.
        </p>
        {contextLinks.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
            No confirmed links yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {contextLinks.map((link) => (
              <EcosystemLinkCard key={link.id} link={link} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
