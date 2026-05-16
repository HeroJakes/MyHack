import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'

type IconName =
  | 'dashboard'
  | 'calendar'
  | 'mail'
  | 'links'
  | 'people'
  | 'analytics'

type SidebarItem = {
  label: string
  to: string
  icon: IconName
  end?: boolean
  badge?: number
}

type ProfileState = {
  name: string
  headline: string
  photoURL: string
}

const baseItems: SidebarItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: 'dashboard', end: true },
  { label: 'My Contexts', to: '/contexts', icon: 'calendar' },
  { label: 'My Invites', to: '/invites', icon: 'mail' },
  { label: 'Linkages', to: '/ecosystem-links', icon: 'links' },
  { label: 'Ecosystem Profile', to: '/people', icon: 'people' },
  { label: 'Analytics', to: '/analytics', icon: 'analytics' },
]

function Icon({ name }: { name: IconName }) {
  const common = {
    className: 'h-[18px] w-[18px]',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    viewBox: '0 0 24 24',
    'aria-hidden': true,
  }

  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <path d="m3 11 9-8 9 8" />
          <path d="M5 10v10h14V10" />
          <path d="M10 20v-6h4v6" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...common}>
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <rect width="16" height="17" x="4" y="5" rx="2" />
          <path d="M4 10h16" />
        </svg>
      )
    case 'mail':
      return (
        <svg {...common}>
          <rect width="18" height="14" x="3" y="5" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      )
    case 'links':
      return (
        <svg {...common}>
          <circle cx="6" cy="12" r="2" />
          <circle cx="18" cy="5" r="2" />
          <circle cx="18" cy="19" r="2" />
          <path d="m8 11 8-5" />
          <path d="m8 13 8 5" />
        </svg>
      )
    case 'people':
      return (
        <svg {...common}>
          <path d="M16 20v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="10" cy="7" r="3" />
          <path d="M20 20v-2a4 4 0 0 0-3-3.87" />
          <path d="M17 4.13a3 3 0 0 1 0 5.74" />
        </svg>
      )
    case 'analytics':
      return (
        <svg {...common}>
          <path d="M4 20V9" />
          <path d="M10 20V4" />
          <path d="M16 20v-7" />
          <path d="M22 20H2" />
          <rect width="4" height="7" x="2" y="13" rx="1" />
          <rect width="4" height="16" x="8" y="4" rx="1" />
          <rect width="4" height="11" x="14" y="9" rx="1" />
        </svg>
      )
  }
}

function InitialsAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
      {initials || 'EA'}
    </div>
  )
}

function useSidebarProfile(): ProfileState {
  const { user } = useAuth()
  const fallback = useMemo(
    () => ({
      name: user?.displayName ?? user?.email?.split('@')[0] ?? 'PoyoLink User',
      headline: 'Ecosystem Builder',
      photoURL: user?.photoURL ?? '',
    }),
    [user],
  )
  const [profile, setProfile] = useState<ProfileState>(fallback)

  useEffect(() => {
    setProfile(fallback)
    if (!user) return

    return onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const data = snap.data()
      setProfile({
        name: data?.name || fallback.name,
        headline: data?.headline || 'Ecosystem Builder',
        photoURL: data?.photoURL || fallback.photoURL,
      })
    })
  }, [fallback, user])

  return profile
}

function usePendingInviteCount() {
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!user) {
      setCount(0)
      return
    }

    const invitesQuery = query(
      collection(db, 'invites'),
      where('invitedUserId', '==', user.uid),
    )

    return onSnapshot(invitesQuery, (snap) => {
      setCount(snap.docs.filter((item) => item.data().status === 'pending').length)
    })
  }, [user])

  return count
}

export default function AppSidebar() {
  const { logout } = useAuth()
  const profile = useSidebarProfile()
  const pendingInvites = usePendingInviteCount()
  const items = baseItems.map((item) =>
    item.to === '/invites' ? { ...item, badge: pendingInvites } : item,
  )

  return (
    <aside className="flex min-h-screen w-full flex-col border-r border-gray-100 bg-white px-4 py-5 shadow-[18px_0_45px_rgba(15,23,42,0.04)] lg:w-60">
      <NavLink to="/dashboard" className="mb-2 flex items-center px-2">
        <img
          src="/logo.svg"
          alt="PoyoLink"
          className="h-20 w-50 shrink-0 object-contain object-left"
        />
      </NavLink>

      <nav className="space-y-1.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-100/80'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-950'
              }`
            }
          >
            <span className="transition-colors">
              <Icon name={item.icon} />
            </span>
            <span className="flex-1">{item.label}</span>
            {item.badge ? (
              <span className="grid h-6 min-w-6 place-items-center rounded-full bg-blue-600 px-2 text-[11px] font-black text-white shadow-lg shadow-blue-500/25">
                {item.badge}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-4 pt-6">
        <div className="rounded-2xl bg-gradient-to-br from-blue-50 via-slate-50 to-white p-4 shadow-sm ring-1 ring-blue-100/70">
          <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
            </svg>
          </div>
          <h2 className="text-xs font-black text-gray-900">AI-Powered Linkages</h2>
          <p className="mt-2 text-xs leading-5 text-gray-500">
            AI recommends the right people for stronger ecosystem connections.
          </p>
          <NavLink to="/ecosystem-links" className="mt-3 inline-flex items-center gap-2 text-xs font-black text-blue-600">
            Learn more
            <span aria-hidden>&rarr;</span>
          </NavLink>
        </div>

        <div className="flex items-center gap-2 rounded-2xl px-1 py-1">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-1 py-1 transition-colors ${
                isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`
            }
            aria-label="View user profile"
          >
            {profile.photoURL ? (
              <img
                src={profile.photoURL}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm"
              />
            ) : (
              <InitialsAvatar name={profile.name} />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-black text-gray-950">{profile.name}</p>
              <p className="truncate text-[11px] font-semibold text-gray-500">
                {profile.headline || 'Ecosystem Builder'}
              </p>
            </div>
          </NavLink>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Sign out"
            title="Sign out"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m7 15 5 5 5-5" />
              <path d="m7 9 5-5 5 5" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
