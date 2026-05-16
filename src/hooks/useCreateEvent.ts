/** Calls the `createEvent` Cloud Function with idle/loading/error/success state. */
import { useCallback, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'
import type { AsyncStatus, EcoEvent, RelationshipNeed } from '../types'

export interface CreateEventInput {
  name: string
  type: string
  field: string
  description: string
  roleRequirements: RelationshipNeed[]
  eventDate?: number
}

interface CreateEventResult {
  eventId: string
  event: EcoEvent
}

export function useCreateEvent() {
  const [status, setStatus] = useState<AsyncStatus>('idle')
  const [error, setError] = useState('')
  const [data, setData] = useState<CreateEventResult | null>(null)

  const createEvent = useCallback(async (input: CreateEventInput) => {
    setStatus('loading')
    setError('')
    try {
      const callable = httpsCallable<CreateEventInput, CreateEventResult>(
        functions,
        'createEvent',
      )
      const res = await callable(input)
      setData(res.data)
      setStatus('success')
      return res.data
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not create the event.'
      setError(message)
      setStatus('error')
      throw err
    }
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setError('')
    setData(null)
  }, [])

  return {
    createEvent,
    reset,
    status,
    error,
    data,
    isIdle: status === 'idle',
    isLoading: status === 'loading',
    isError: status === 'error',
    isSuccess: status === 'success',
  }
}
