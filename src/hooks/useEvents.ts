/**
 * Real-time listener for `events`.
 *
 * Defaults to the events created by the signed-in user (the Dashboard's
 * "My Events" tab). Pass `createdBy` to scope it to another organizer.
 */
import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import type { EcoEvent } from '../types'

interface UseEventsOptions {
  createdBy?: string
}

function toMillis(value: unknown): number {
  if (!value) return 0
  const ts = value as { toMillis?: () => number; seconds?: number }
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  return 0
}

export function useEvents(options?: UseEventsOptions) {
  const { user } = useAuth()
  const ownerId = options?.createdBy ?? user?.uid ?? null

  const [events, setEvents] = useState<EcoEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ownerId) {
      setEvents([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    const eventsQuery = query(
      collection(db, 'events'),
      where('createdBy', '==', ownerId),
    )

    const unsubscribe = onSnapshot(
      eventsQuery,
      (snap) => {
        const rows = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as EcoEvent,
        )
        rows.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
        setEvents(rows)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )

    return unsubscribe
  }, [ownerId])

  return { events, loading, error }
}
