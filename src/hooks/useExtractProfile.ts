/**
 * useExtractProfile — wraps the `extractUserProfile` Cloud Function.
 *
 * The function takes whatever the user pasted during onboarding and returns a
 * structured ExtractedProfile. Firebase Functions and network errors are
 * mapped to short, human-readable messages.
 */
import { useCallback, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'
import type { ExtractedProfile } from '../types'

export interface ExtractUserProfileInput {
  linkedinUrl?: string
  websiteUrl?: string
  bio?: string
}

/** Turns a thrown Functions / network error into a message we can show. */
function toMessage(err: unknown): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'You appear to be offline. Please reconnect and try again.'
  }
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code: unknown }).code)
      : ''
  if (code.includes('unauthenticated')) {
    return 'Your session has expired. Please sign in again.'
  }
  if (code.includes('invalid-argument')) {
    return 'Add a LinkedIn URL, a website, or a short bio first.'
  }
  if (code.includes('internal')) {
    return "Gemini couldn't read that profile automatically."
  }
  if (err instanceof Error && err.message) return err.message
  return 'Something went wrong while building your profile.'
}

export function useExtractProfile() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ExtractedProfile | null>(null)

  const extract = useCallback(
    async (input: ExtractUserProfileInput): Promise<ExtractedProfile> => {
      setLoading(true)
      setError('')
      try {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          throw new Error(
            'You appear to be offline. Please reconnect and try again.',
          )
        }
        const callable = httpsCallable<
          ExtractUserProfileInput,
          ExtractedProfile
        >(functions, 'extractUserProfile')
        const res = await callable(input)
        setResult(res.data)
        return res.data
      } catch (err) {
        setError(toMessage(err))
        throw err
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const reset = useCallback(() => {
    setLoading(false)
    setError('')
    setResult(null)
  }, [])

  return { extract, loading, error, result, reset }
}
