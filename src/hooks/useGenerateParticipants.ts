/** Calls the `generateParticipants` Cloud Function (the AI match engine). */
import { useCallback, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'
import type { AsyncStatus, ParticipantSuggestion } from '../types'

interface GenerateParticipantsInput {
  contextId: string
}

interface GenerateParticipantsResult {
  contextId: string
  count: number
  suggestions: ParticipantSuggestion[]
}

export function useGenerateParticipants() {
  const [status, setStatus] = useState<AsyncStatus>('idle')
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState<ParticipantSuggestion[]>([])

  const generateParticipants = useCallback(async (contextId: string) => {
    setStatus('loading')
    setError('')
    try {
      const callable = httpsCallable<
        GenerateParticipantsInput,
        GenerateParticipantsResult
      >(functions, 'generateParticipants')
      const res = await callable({ contextId })
      setSuggestions(res.data.suggestions)
      setStatus('success')
      return res.data
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not generate participant suggestions.'
      setError(message)
      setStatus('error')
      throw err
    }
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setError('')
    setSuggestions([])
  }, [])

  return {
    generateParticipants,
    reset,
    suggestions,
    status,
    error,
    isIdle: status === 'idle',
    isLoading: status === 'loading',
    isError: status === 'error',
    isSuccess: status === 'success',
  }
}
