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
  /** Uploaded CV / resume, carried as base64 inline data. */
  cvFile?: { mimeType: string; data: string }
  bio?: string
}

/** Turns a thrown Functions / network error into a message we can show. */
function toMessage(err: unknown): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'You appear to be offline. Please reconnect and try again.'
  }
  const message =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : ''
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code: unknown }).code)
      : ''
  if (message.includes("Database '(default)' not found")) {
    return "Firestore isn't set up in this Firebase project yet. Create the default Firestore database, then try again."
  }
  if (code.includes('unauthenticated')) {
    return 'Your session has expired. Please sign in again.'
  }
  if (code.includes('invalid-argument')) {
    if (message) return message
    return 'Upload your CV or add a short bio first.'
  }
  if (code.includes('failed-precondition')) {
    if (message) return message
    return 'A required Firebase service is not configured yet. Please check Firestore setup.'
  }
  if (code.includes('internal')) {
    if (message) return message
    return "Gemini couldn't read that profile automatically."
  }
  if (message) return message
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
        // Keep this so function-level diagnostics are visible in DevTools.
        // eslint-disable-next-line no-console
        console.error('extractUserProfile failed:', err)
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
