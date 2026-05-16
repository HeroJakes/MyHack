import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import googleLogo from '../assets/google.svg'

type Mode = 'signin' | 'signup'

function passwordStrength(password: string) {
  const score = [
    password.length >= 8,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length

  if (!password) {
    return { label: 'Password strength', color: 'bg-[#d9d9d9]', width: 'w-0', text: 'text-[#808080]' }
  }
  if (score <= 1) {
    return { label: 'Weak password', color: 'bg-[#ef4444]', width: 'w-1/3', text: 'text-[#ef4444]' }
  }
  if (score <= 3) {
    return { label: 'Medium password', color: 'bg-[#f59e0b]', width: 'w-2/3', text: 'text-[#f59e0b]' }
  }
  return { label: 'Strong password', color: 'bg-[#22c55e]', width: 'w-full', text: 'text-[#22c55e]' }
}

function AuthLayout({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <main className="flex h-screen items-center justify-center overflow-hidden bg-white p-6 text-[#111111]">
      <div className="flex h-full max-h-[900px] w-full max-w-[1100px] items-center justify-center bg-white px-6">
        <div className="w-full max-w-[500px]">
          <h1 className="text-[34px] font-bold leading-tight text-[#111111]">
            Think it. Make it.
          </h1>
          <p className="mt-1 text-[22px] font-semibold leading-tight text-[#8f8f8f]">{subtitle}</p>
          {children}
        </div>
      </div>
    </main>
  )
}

function ErrorToast({ message }: { message: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!message) return
    setVisible(true)
    const timer = window.setTimeout(() => setVisible(false), 3800)
    return () => window.clearTimeout(timer)
  }, [message])

  if (!message) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div
        className={`w-full max-w-[920px] rounded-2xl border border-[#f2a7a7] bg-[#ea9a9a] px-8 py-6 text-[18px] font-medium text-white shadow-[0_12px_35px_rgba(234,154,154,0.35)] transition-all duration-300 ${
          visible ? 'translate-y-0 opacity-100' : '-translate-y-5 opacity-0'
        }`}
      >
        Error: {message}
      </div>
    </div>
  )
}

function GoogleButton({
  loading,
  onClick,
}: {
  loading: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="mt-7 flex h-[48px] w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-[#d9d9d9] bg-white text-[18px] font-medium text-[#202124] hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-70"
    >
      <img src={googleLogo} alt="" aria-hidden="true" className="h-10 w-10" />
      {loading ? 'Signing in with Google...' : 'Continue with Google'}
    </button>
  )
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
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>(location.pathname === '/signup' ? 'signup' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const strength = useMemo(() => passwordStrength(password), [password])
  const passwordsMismatch = mode === 'signup' && confirmPassword.length > 0 && password !== confirmPassword
  const busy = emailLoading || googleLoading
  const shownError = formError || error

  useEffect(() => {
    setMode(location.pathname === '/signup' ? 'signup' : 'signin')
    setFormError('')
    clearError()
  }, [clearError, location.pathname])

  if (!loading && user && !(mode === 'signup' && emailLoading)) {
    return <Navigate to="/" replace />
  }

  function resetForm(next: Mode) {
    setMode(next)
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setFormError('')
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
        setEmail('')
        setPassword('')
        setConfirmPassword('')
        resetForm('signin')
        navigate('/login', { replace: true })
      }
    } catch {
      // AuthContext exposes the readable error message.
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
      // AuthContext exposes the readable error message.
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <AuthLayout subtitle={mode === 'signin' ? 'Log in to your account' : 'Create your account'}>
      <ErrorToast message={shownError} />
      <GoogleButton loading={googleLoading} onClick={handleGoogle} />

      <div className="my-5 h-px w-full bg-[#dedede]" />

      <form className="space-y-4" onSubmit={handleEmailSubmit}>
        <div>
          <label htmlFor="email" className="mb-2 block text-[16px] font-semibold text-[#1d1d1d]">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email address..."
            className="h-[46px] w-full cursor-text rounded-lg border border-[#d9d9d9] px-4 text-[17px] text-[#4f4f4f] outline-none placeholder:text-[#a0a0a0] focus:border-[#2f80ed]"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-2 block text-[16px] font-semibold text-[#1d1d1d]">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={mode === 'signin' ? 'Enter your password' : 'Create a password'}
            className="h-[46px] w-full cursor-text rounded-lg border border-[#d9d9d9] px-4 text-[17px] text-[#4f4f4f] outline-none placeholder:text-[#a0a0a0] focus:border-[#2f80ed]"
          />
          {mode === 'signup' && (
            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#ededed]">
                <div className={`h-full rounded-full transition-all ${strength.color} ${strength.width}`} />
              </div>
              <p className={`mt-1 text-[13px] font-medium ${strength.text}`}>{strength.label}</p>
            </div>
          )}
        </div>

        {mode === 'signup' && (
          <div>
            <label htmlFor="confirmPassword" className="mb-2 block text-[16px] font-semibold text-[#1d1d1d]">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter your password"
              className={`h-[46px] w-full cursor-text rounded-lg border px-4 text-[17px] text-[#4f4f4f] outline-none placeholder:text-[#a0a0a0] ${
                passwordsMismatch ? 'border-[#ef4444] focus:border-[#ef4444]' : 'border-[#d9d9d9] focus:border-[#2f80ed]'
              }`}
            />
            {passwordsMismatch && (
              <p className="mt-1 text-[13px] font-medium text-[#ef4444]">Passwords do not match.</p>
            )}
          </div>
        )}

        {mode === 'signin' && (
          <div className="flex items-center justify-between pt-1 text-[15px]">
            <label className="flex cursor-pointer items-center gap-3 text-[#2f2f2f]">
              <input type="checkbox" className="h-4 w-4 cursor-pointer rounded border-[#2f80ed] accent-[#2f80ed]" />
              Remember me
            </label>
            <button type="button" className="cursor-pointer font-medium text-[#1f74e8]">
              Forgot password?
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="h-[50px] w-full cursor-pointer rounded-lg bg-gradient-to-r from-[#1e73e8] to-[#1971e9] text-[18px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {emailLoading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
        </button>
      </form>

      <p className="mt-5 text-center text-[15px] text-[#303030]">
        {mode === 'signin' ? (
          <>
            Don&apos;t have an account?{' '}
            <Link to="/signup" onClick={() => resetForm('signup')} className="font-semibold text-[#1f74e8]">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <Link to="/login" onClick={() => resetForm('signin')} className="font-semibold text-[#1f74e8]">
              Log in
            </Link>
          </>
        )}
      </p>

      <div className="my-5 h-px w-full bg-[#e6e6e6]" />
      <p className="text-center text-[13px] text-[#808080]">
        By continuing, you agree to our <span className="text-[#1f74e8]">Terms</span> and{' '}
        <span className="text-[#1f74e8]">Privacy Policy</span>.
      </p>
    </AuthLayout>
  )
}
