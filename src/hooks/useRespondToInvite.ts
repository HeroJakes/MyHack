/** Calls the `respondToInvite` Cloud Function to accept or decline an invite. */
import { useCallback, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'
import type { AsyncStatus } from '../types'

type InviteResponse = 'accepted' | 'declined'

interface RespondToInviteInput {
  inviteId: string
  response: InviteResponse
  declineReason?: string
}

interface RespondToInviteResult {
  inviteId: string
  status: 'confirmed' | 'declined'
  linkId: string | null
}

export function useRespondToInvite() {
  const [status, setStatus] = useState<AsyncStatus>('idle')
  const [error, setError] = useState('')
  const [data, setData] = useState<RespondToInviteResult | null>(null)

  const respond = useCallback(
    async (
      inviteId: string,
      response: InviteResponse,
      declineReason?: string,
    ) => {
      setStatus('loading')
      setError('')
      try {
        const callable = httpsCallable<
          RespondToInviteInput,
          RespondToInviteResult
        >(functions, 'respondToInvite')
        const res = await callable({ inviteId, response, declineReason })
        setData(res.data)
        setStatus('success')
        return res.data
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Could not record your response.'
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
    setData(null)
  }, [])

  return {
    respond,
    reset,
    data,
    status,
    error,
    isIdle: status === 'idle',
    isLoading: status === 'loading',
    isError: status === 'error',
    isSuccess: status === 'success',
  }
}
