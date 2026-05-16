/**
 * InviteView — the invitee's view of a single invite.
 *
 * Shows the context, assigned role and the AI reasoning, then lets the
 * invitee accept (which creates an active ecosystem link) or decline (which
 * captures a reason). The invite document is watched live.
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useRespondToInvite } from '../hooks/useRespondToInvite'
import InviteStatusBadge from '../components/InviteStatusBadge'
import type { Invite } from '../types'

/** Confidence badge tone: green >= 80, yellow >= 60, red < 60. */
function confidenceClasses(value: number): string {
  if (value >= 80) return 'bg-green-100 text-green-800 border-green-200'
  if (value >= 60) return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-red-100 text-red-700 border-red-200'
}

export default function InviteView() {
  const { inviteId } = useParams<{ inviteId: string }>()

  const [invite, setInvite] = useState<Invite | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [showDecline, setShowDecline] = useState(false)
  const [declineReason, setDeclineReason] = useState('')

  const { respond, status, error } = useRespondToInvite()

  useEffect(() => {
    if (!inviteId) return
    setLoading(true)
    const unsubscribe = onSnapshot(
      doc(db, 'invites', inviteId),
      (snap) => {
        if (snap.exists()) {
          setInvite({ id: snap.id, ...snap.data() } as Invite)
        } else {
          setLoadError('This invite no longer exists.')
        }
        setLoading(false)
      },
      (err) => {
        setLoadError(err.message)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [inviteId])

  const handleAccept = async () => {
    if (!inviteId) return
    try {
      await respond(inviteId, 'accepted')
    } catch {
      // Error surfaced via `error` below.
    }
  }

  const handleDecline = async () => {
    if (!inviteId) return
    try {
      await respond(inviteId, 'declined', declineReason)
      setShowDecline(false)
    } catch {
      // Error surfaced via `error` below.
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-gray-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
        Loading invite…
      </div>
    )
  }

  if (loadError || !invite) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
        {loadError || 'Invite not found.'}
      </p>
    )
  }

  const isPending = invite.status === 'pending'

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              {invite.contextType} invite
            </p>
            <h1 className="text-xl font-bold text-gray-900">
              {invite.contextName}
            </h1>
          </div>
          <InviteStatusBadge status={invite.status} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-blue-50 px-2.5 py-1 text-sm font-medium text-blue-700">
            Role: {invite.assignedRole}
          </span>
          <span className="rounded-md bg-gray-100 px-2.5 py-1 text-sm font-medium text-gray-600">
            {invite.relationshipType}
          </span>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${confidenceClasses(
              invite.confidence,
            )}`}
          >
            {invite.confidence}% match
          </span>
        </div>

        <div className="mt-4 rounded-xl bg-gray-50 px-4 py-3">
          <p className="text-xs font-semibold text-gray-500">Why you?</p>
          <p className="mt-1 text-sm text-gray-700">
            {invite.aiReason || 'No reasoning was provided.'}
          </p>
        </div>

        {invite.status === 'declined' && invite.declineReason && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            You declined: {invite.declineReason}
          </p>
        )}
        {invite.status === 'confirmed' && (
          <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            You confirmed this match — an active ecosystem link was created.
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {isPending && !showDecline && (
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={handleAccept}
              disabled={status === 'loading'}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === 'loading' ? 'Working…' : 'Accept invite'}
            </button>
            <button
              type="button"
              onClick={() => setShowDecline(true)}
              disabled={status === 'loading'}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Decline
            </button>
          </div>
        )}

        {isPending && showDecline && (
          <div className="mt-5">
            <label className="text-sm font-medium text-gray-700">
              Reason for declining (optional)
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={3}
                placeholder="Let the organizer know why…"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={handleDecline}
                disabled={status === 'loading'}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === 'loading' ? 'Working…' : 'Confirm decline'}
              </button>
              <button
                type="button"
                onClick={() => setShowDecline(false)}
                disabled={status === 'loading'}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
