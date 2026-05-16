/**
 * Login — public sign-in / sign-up page.
 *
 * Supports Google sign-in and email + password auth. Each async action tracks
 * idle / loading / error / success state. Once the user is authenticated they
 * are redirected to the dashboard.
 */
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { AsyncStatus } from '../types'

type Mode = 'signin' | 'signup'

export default function Login() {
  const {
    user,
    loading,
    error,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    clearError,
  } = useAuth()

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailStatus, setEmailStatus] = useState<AsyncStatus>('idle')
  const [googleStatus, setGoogleStatus] = useState<AsyncStatus>('idle')

  if (!loading && user) {
    return <Navigate to="/" replace />
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setEmailStatus('idle')
    clearError()
  }

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setEmailStatus('loading')
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password)
      } else {
        await signUpWithEmail(email, password)
      }
      setEmailStatus('success')
    } catch {
      setEmailStatus('error')
    }
  }

  const handleGoogle = async () => {
    setGoogleStatus('loading')
    try {
      await signInWithGoogle()
      setGoogleStatus('success')
    } catch {
      setGoogleStatus('error')
    }
  }

  const busy = emailStatus === 'loading' || googleStatus === 'loading'

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f6f7] px-4 py-10 text-[#111827]">
      <div className="w-full max-w-[460px]">
        <h1 className="text-center text-3xl font-semibold sm:text-4xl">
          🌿 EcoGraph AI
        </h1>
        <p className="mt-2 text-center text-sm text-[#6b7280] sm:text-base">
          Sign in to map and grow your ecosystem relationships.
        </p>

        <section className="mx-auto mt-4 w-full rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-[0_2px_18px_rgba(0,0,0,0.05)]">
          <div className="grid grid-cols-2 border-b border-[#e5e7eb] text-center text-lg font-semibold">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className={
                mode === 'signin'
                  ? 'cursor-pointer border-b-4 border-[#2563eb] pb-3 text-[#2563eb]'
                  : 'cursor-pointer pb-3 text-[#6b7280]'
              }
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={
                mode === 'signup'
                  ? 'cursor-pointer border-b-4 border-[#2563eb] pb-3 text-[#2563eb]'
                  : 'cursor-pointer pb-3 text-[#6b7280]'
              }
            >
              Sign Up
            </button>
          </div>

          <form className="mt-4 space-y-4" onSubmit={handleEmailSubmit}>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11 w-full cursor-text rounded-xl border border-[#d1d5db] px-4 text-sm outline-none focus:border-[#2563eb]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="h-11 w-full cursor-text rounded-xl border border-[#d1d5db] px-4 text-sm outline-none focus:border-[#2563eb]"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="h-11 w-full cursor-pointer rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#2563eb] text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {emailStatus === 'loading'
                ? 'Please wait…'
                : mode === 'signin'
                  ? 'Sign In'
                  : 'Create account'}
            </button>

            <div className="flex items-center gap-4 text-[#9ca3af]">
              <div className="h-px flex-1 bg-[#e5e7eb]" />
              <span className="text-sm">or</span>
              <div className="h-px flex-1 bg-[#e5e7eb]" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy}
              className="flex h-11 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-[#d1d5db] text-sm font-semibold hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt=""
                className="h-6 w-6"
              />
              {googleStatus === 'loading'
                ? 'Signing in with Google…'
                : 'Continue with Google'}
            </button>
          </form>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">
              {error}
            </p>
          )}
        </section>

        <p className="mt-4 text-center text-xs text-[#6b7280]">
          By continuing you agree to take part in the MyHack 2026 demo.
        </p>
      </div>
    </main>
  )
}
