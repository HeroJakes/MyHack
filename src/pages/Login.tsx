/**
 * Login — public sign-in / sign-up page.
 *
 * Supports Google sign-in and email + password auth in a single tabbed card.
 * Once authenticated the user is sent to `/`, where the route guards forward
 * them to onboarding or the dashboard depending on their profile state.
 */
import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import googleLogo from '../assets/google.svg'

type Mode = 'signin' | 'signup'

/** Scores a password 0-4 and maps it to a strength bar style. */
function getPasswordStrength(password: string) {
  const score = [
    password.length >= 8,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length

  if (!password) {
    return { label: 'Password strength', bar: 'bg-gray-200', width: 'w-0', text: 'text-gray-400' }
  }
  if (score <= 1) {
    return { label: 'Weak password', bar: 'bg-red-500', width: 'w-1/3', text: 'text-red-500' }
  }
  if (score <= 3) {
    return { label: 'Medium password', bar: 'bg-amber-500', width: 'w-2/3', text: 'text-amber-500' }
  }
  return { label: 'Strong password', bar: 'bg-green-500', width: 'w-full', text: 'text-green-600' }
}

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
  const location = useLocation()

  const [mode, setMode] = useState<Mode>(
    location.pathname === '/signup' ? 'signup' : 'signin',
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const strength = useMemo(() => getPasswordStrength(password), [password])
  const passwordsMismatch =
    mode === 'signup' &&
    confirmPassword.length > 0 &&
    password !== confirmPassword

  if (!loading && user) {
    return <Navigate to="/" replace />
  }

  function switchMode(next: Mode) {
    setMode(next)
    setFormError('')
    setConfirmPassword('')
    clearError()
  }

  async function handleEmailSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError('')
    if (mode === 'signup' && password !== confirmPassword) {
      setFormError('Passwords do not match.')
      return
    }
    setEmailLoading(true)
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password)
      } else {
        await signUpWithEmail(email, password)
      }
    } catch {
      // useAuth surfaces the failure message through `error`.
    } finally {
      setEmailLoading(false)
    }
  }

  async function handleGoogle() {
    setFormError('')
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
    } catch {
      // handled via `error`
    } finally {
      setGoogleLoading(false)
    }
  }

  const busy = emailLoading || googleLoading
  const shownError = formError || error

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10 text-[#111827]">
      <div className="w-full max-w-[440px]">
        <h1 className="text-center text-3xl font-bold sm:text-4xl">
          🌿 EcoGraph AI
        </h1>
        <p className="mt-2 text-center text-sm text-gray-500 sm:text-base">
          {mode === 'signin'
            ? 'Log in to map and grow your ecosystem relationships.'
            : 'Create your account to start building your ecosystem.'}
        </p>

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="grid grid-cols-2 border-b border-gray-200 text-center text-base font-semibold">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className={
                mode === 'signin'
                  ? 'cursor-pointer border-b-2 border-blue-600 pb-3 text-blue-600'
                  : 'cursor-pointer pb-3 text-gray-400'
              }
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={
                mode === 'signup'
                  ? 'cursor-pointer border-b-2 border-blue-600 pb-3 text-blue-600'
                  : 'cursor-pointer pb-3 text-gray-400'
              }
            >
              Sign Up
            </button>
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="mt-5 flex h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <img src={googleLogo} alt="" aria-hidden="true" className="h-6 w-6" />
            {googleLoading ? 'Signing in with Google…' : 'Continue with Google'}
          </button>

          <div className="my-5 flex items-center gap-4 text-gray-400">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-sm">or</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <form className="space-y-4" onSubmit={handleEmailSubmit}>
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-semibold text-gray-800"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-semibold text-gray-800"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === 'signup'
                    ? 'Create a password'
                    : 'Enter your password'
                }
                className="h-11 w-full rounded-xl border border-gray-300 px-4 text-sm outline-none focus:border-blue-600"
              />
              {mode === 'signup' && (
                <div className="mt-2">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full transition-all ${strength.bar} ${strength.width}`}
                    />
                  </div>
                  <p className={`mt-1 text-xs font-medium ${strength.text}`}>
                    {strength.label}
                  </p>
                </div>
              )}
            </div>

            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-1.5 block text-sm font-semibold text-gray-800"
                >
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className={`h-11 w-full rounded-xl border px-4 text-sm outline-none ${
                    passwordsMismatch
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-gray-300 focus:border-blue-600'
                  }`}
                />
                {passwordsMismatch && (
                  <p className="mt-1 text-xs font-medium text-red-500">
                    Passwords do not match.
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="h-11 w-full cursor-pointer rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 text-base font-semibold text-white hover:from-blue-800 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {emailLoading
                ? 'Please wait…'
                : mode === 'signin'
                  ? 'Sign In'
                  : 'Create account'}
            </button>
          </form>

          {shownError && (
            <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-center text-sm text-red-700">
              {shownError}
            </p>
          )}
        </section>

        <p className="mt-5 text-center text-xs text-gray-400">
          By continuing, you agree to our{' '}
          <span className="text-blue-600">Terms</span> and{' '}
          <span className="text-blue-600">Privacy Policy</span>.
        </p>
      </div>
    </main>
  )
}
