/** Calls the `suggestRelationshipNeeds` Cloud Function (Gemini-backed). */
import { useCallback, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'
import type { AsyncStatus, RelationshipNeed } from '../types'

export interface SuggestRelationshipNeedsInput {
  field: string
  description?: string
}

interface SuggestRelationshipNeedsResult {
  needs: RelationshipNeed[]
}

export function useSuggestRelationshipNeeds() {
  const [status, setStatus] = useState<AsyncStatus>('idle')
  const [error, setError] = useState('')
  const [needs, setNeeds] = useState<RelationshipNeed[]>([])

  const suggestNeeds = useCallback(
    async (input: SuggestRelationshipNeedsInput) => {
      setStatus('loading')
      setError('')
      try {
        const callable = httpsCallable<
          SuggestRelationshipNeedsInput,
          SuggestRelationshipNeedsResult
        >(functions, 'suggestRelationshipNeeds')
        const res = await callable(input)
        setNeeds(res.data.needs)
        setStatus('success')
        return res.data.needs
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Could not suggest needs.'
        setError(message)
        setStatus('error')
        throw err
      }
    },
    [],
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setError('')
    setNeeds([])
  }, [])

  return {
    suggestNeeds,
    reset,
    needs,
    status,
    error,
    isIdle: status === 'idle',
    isLoading: status === 'loading',
    isError: status === 'error',
    isSuccess: status === 'success',
  }
}
