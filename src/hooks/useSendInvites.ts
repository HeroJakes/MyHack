/** Calls the `sendInvites` Cloud Function to batch-create invite documents. */
import { useCallback, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'
import type {
  AsyncStatus,
  Invite,
  ParticipantSuggestion,
} from '../types'

/** Subset of a ParticipantSuggestion needed to create an invite. */
export type InvitePayload = Pick<
  ParticipantSuggestion,
  'userId' | 'suggestedRole' | 'relationshipType' | 'reason' | 'confidence'
> & { invitedUserId?: string }

interface SendInvitesInput {
  contextId: string
  invites: InvitePayload[]
}

interface SendInvitesResult {
  contextId: string
  count: number
  invites: Invite[]
}

export function useSendInvites() {
  const [status, setStatus] = useState<AsyncStatus>('idle')
  const [error, setError] = useState('')
  const [data, setData] = useState<SendInvitesResult | null>(null)

  const sendInvites = useCallback(
    async (contextId: string, invites: InvitePayload[]) => {
      setStatus('loading')
      setError('')
      try {
        const callable = httpsCallable<SendInvitesInput, SendInvitesResult>(
          functions,
          'sendInvites',
        )
        const res = await callable({ contextId, invites })
        setData(res.data)
        setStatus('success')
        return res.data
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Could not send invites.'
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
    sendInvites,
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
