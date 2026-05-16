/**
 * AuthContext — exposes the Firebase Auth state and sign-in actions to the
 * whole app. On first sign-in it lazily creates the caller's `users/{uid}`
 * document so downstream features always have a profile to read.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import type { User as FirebaseUser } from 'firebase/auth'
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { auth, db, googleProvider } from '../lib/firebase'

interface AuthContextValue {
  user: FirebaseUser | null
  loading: boolean
  error: string
  /** Whether the signed-in user has finished the onboarding flow. */
  onboardingComplete: boolean
  /** True while the user's profile document is still being read. */
  profileLoading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function toMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return fallback
}

/** Creates the user's profile document the first time they sign in. */
async function ensureUserDocument(user: FirebaseUser): Promise<void> {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return

  await setDoc(ref, {
    id: user.uid,
    name: user.displayName ?? user.email?.split('@')[0] ?? 'New Member',
    email: user.email ?? '',
    photoURL: user.photoURL ?? '',
    headline: '',
    inferredSector: [],
    inferredExpertise: [],
    inferredStage: 'seed',
    contributionSignals: [],
    bio: '',
    profileCompleteness: 10,
    onboardingComplete: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [onboardingComplete, setOnboardingComplete] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined

    const unsubscribeAuth = onAuthStateChanged(auth, async (next) => {
      unsubscribeProfile?.()
      unsubscribeProfile = undefined

      if (next) {
        try {
          await ensureUserDocument(next)
        } catch {
          // Profile bootstrap is non-fatal — the user is still signed in.
        }
        setUser(next)
        setLoading(false)
        setProfileLoading(true)
        // Live-track onboarding status so the route guards never go stale.
        unsubscribeProfile = onSnapshot(
          doc(db, 'users', next.uid),
          (snap) => {
            setOnboardingComplete(snap.data()?.onboardingComplete === true)
            setProfileLoading(false)
          },
          () => {
            setOnboardingComplete(false)
            setProfileLoading(false)
          },
        )
      } else {
        setUser(null)
        setOnboardingComplete(false)
        setProfileLoading(false)
        setLoading(false)
      }
    })

    return () => {
      unsubscribeAuth()
      unsubscribeProfile?.()
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    setError('')
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      setError(toMessage(err, 'Google sign-in failed.'))
      throw err
    }
  }, [])

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      setError('')
      try {
        await signInWithEmailAndPassword(auth, email, password)
      } catch (err) {
        setError(toMessage(err, 'Could not sign in with those credentials.'))
        throw err
      }
    },
    [],
  )

  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      setError('')
      try {
        await createUserWithEmailAndPassword(auth, email, password)
      } catch (err) {
        setError(toMessage(err, 'Could not create that account.'))
        throw err
      }
    },
    [],
  )

  const logout = useCallback(async () => {
    await signOut(auth)
  }, [])

  const clearError = useCallback(() => setError(''), [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      onboardingComplete,
      profileLoading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      logout,
      clearError,
    }),
    [
      user,
      loading,
      error,
      onboardingComplete,
      profileLoading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      logout,
      clearError,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>.')
  }
  return ctx
}
