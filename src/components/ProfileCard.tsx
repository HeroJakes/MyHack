/**
 * ProfileCard — one ecosystem profile in the grid view.
 *
 * `InviteButton` is exported for reuse by the profile drawer; it renders the
 * idle / loading / invited / error / disabled states of an invite action.
 */
import type { KeyboardEvent } from 'react'
import type { User } from '../types'
import {
  colorForName,
  derivePossibleRoles,
  deriveRole,
  initials,
  strengthInfo,
} from '../lib/profileHelpers'
import { Briefcase, CheckCircle, Send } from './icons'

export type InviteState = 'idle' | 'loading' | 'error'

interface InviteButtonProps {
  invited: boolean
  inviteState: InviteState
  canInvite: boolean
  userName: string
  onInvite: () => void
  label?: string
  full?: boolean
}

export function InviteButton({
  invited,
  inviteState,
  canInvite,
  userName,
  onInvite,
  label = 'Invite',
  full = false,
}: InviteButtonProps) {
  const base = `inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
    full ? 'w-full' : 'flex-1'
  }`

  if (invited) {
    return (
      <button
        type="button"
        disabled
        className={`${base} bg-green-50 text-green-700 ring-1 ring-green-200`}
      >
        <CheckCircle className="h-3.5 w-3.5" />
        Invited
      </button>
    )
  }

  if (inviteState === 'loading') {
    return (
      <button
        type="button"
        disabled
        aria-busy="true"
        className={`${base} bg-blue-600 text-white opacity-80`}
      >
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        Inviting…
      </button>
    )
  }

  if (inviteState === 'error') {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onInvite()
        }}
        title="Invite failed — click to retry"
        className={`${base} border border-red-300 bg-white text-red-600 hover:bg-red-50`}
      >
        Retry
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={!canInvite}
      onClick={(event) => {
        event.stopPropagation()
        onInvite()
      }}
      aria-label={`Invite ${userName} to campaign`}
      title={canInvite ? undefined : 'Select a context to enable invites'}
      className={`${base} ${
        canInvite
          ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700'
          : 'cursor-not-allowed bg-gray-200 text-gray-400'
      }`}
    >
      <Send className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

interface ProfileCardProps {
  user: User
  isSelected: boolean
  invited: boolean
  inviteState: InviteState
  canInvite: boolean
  onView: () => void
  onInvite: () => void
}

export default function ProfileCard({
  user,
  isSelected,
  invited,
  inviteState,
  canInvite,
  onView,
  onInvite,
}: ProfileCardProps) {
  const role = deriveRole(user)
  const possibleRoles = derivePossibleRoles(user)
  const completeness = Math.round(user.profileCompleteness ?? 0)
  const strength = strengthInfo(completeness)
  const expertise = user.inferredExpertise ?? []
  const sector = user.inferredSector?.[0]

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onView()
    }
  }

  return (
    <div
      role="article"
      tabIndex={0}
      onClick={onView}
      onKeyDown={handleKey}
      className={`group flex cursor-pointer flex-col rounded-xl border border-gray-200 bg-white p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-300 ${
        isSelected ? 'border-l-4 border-l-blue-600 ring-1 ring-blue-100' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-gray-100"
          />
        ) : (
          <div
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-bold ring-2 ring-gray-100 ${colorForName(
              user.name,
            )}`}
          >
            {initials(user.name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 font-bold text-gray-900 transition-colors group-hover:text-blue-700">
            {user.name}
          </p>
          <p className="line-clamp-2 text-xs leading-5 text-gray-500">
            {user.headline}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${role.badgeClass}`}
        >
          {role.label}
        </span>
      </div>

      {sector && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
          <Briefcase className="h-3.5 w-3.5 text-gray-400" />
          <span className="truncate">{sector}</span>
        </div>
      )}

      {expertise.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {expertise.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600"
            >
              {tag}
            </span>
          ))}
          {expertise.length > 3 && (
            <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
              +{expertise.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="mt-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
          Possible Roles
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {possibleRoles.map((roleInfo) => (
            <span
              key={roleInfo.key}
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${roleInfo.chipClass}`}
            >
              {roleInfo.label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-gray-500">
            Profile Strength · {strength.label}
          </span>
          <span className={`font-bold ${strength.text}`}>{completeness}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={completeness}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
        >
          <div
            className={`h-full rounded-full ${strength.bar}`}
            style={{ width: `${completeness}%` }}
          />
        </div>
      </div>

      {/* Spacer keeps the action row aligned across uneven cards. */}
      <div className="mt-4 flex flex-1 items-end gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onView()
          }}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          View Profile
        </button>
        <InviteButton
          invited={invited}
          inviteState={inviteState}
          canInvite={canInvite}
          userName={user.name}
          onInvite={onInvite}
        />
      </div>
    </div>
  )
}
