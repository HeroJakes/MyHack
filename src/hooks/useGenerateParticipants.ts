/** Calls the `generateParticipants` Cloud Function (the AI match engine). */
import { useCallback, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'
import type { ParticipantSuggestion } from '../types'

interface GenerateParticipantsInput {
  contextId: string
}

/** Structured envelope returned by the `generateParticipants` function. */
interface GenerateParticipantsResult {
  success: boolean
  suggestions: ParticipantSuggestion[]
  quotaSummary: {
    role: string
    relationshipType: string
    needed: number
    filled: number
  }[]
  warnings: string[]
  error?: string
  fallback?: boolean
}

export function useGenerateParticipants(contextId?: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<ParticipantSuggestion[]>([])
  const [quotaSummary, setQuotaSummary] = useState<
    GenerateParticipantsResult['quotaSummary']
  >([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [fallback, setFallback] = useState(false)

  const generate = useCallback(() => {
    if (!contextId) return
    setLoading(true)
    setError(null)
    setWarnings([])
    setFallback(false)

    const callable = httpsCallable<
      GenerateParticipantsInput,
      GenerateParticipantsResult
    >(functions, 'generateParticipants')

    callable({ contextId })
      .then((res) => {
        const data = res.data
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
        setQuotaSummary(
          Array.isArray(data.quotaSummary) ? data.quotaSummary : [],
        )
        setWarnings(Array.isArray(data.warnings) ? data.warnings : [])
        setFallback(data.fallback === true)
        setError(data.error ?? null)
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error
            ? err.message
            : 'Could not generate participant suggestions.'
        setError(message)
        setSuggestions([])
        setQuotaSummary([])
        setWarnings([])
        setFallback(false)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [contextId])

  return {
    suggestions,
    quotaSummary,
    warnings,
    error,
    fallback,
    loading,
    generate,
  }
}
