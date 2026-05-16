import { useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from './lib/firebase'
import googleLogo from './assets/google.svg'

function AuthLayout({ subtitle, children }) {
  return (
    <main className="flex h-screen items-center justify-center overflow-hidden bg-white p-6 text-[#111111]">
      <div className="flex h-full max-h-[900px] w-full max-w-[1100px] items-center justify-center rounded-sm bg-white px-6">
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

function getPasswordStrength(password) {
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

function GoogleButton({ loading, onClick }) {
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

function LoginPage() {
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [authError, setAuthError] = useState('')
  const [signedInUser, setSignedInUser] = useState(null)

  const handleGoogleSignIn = async () => {
    setLoadingGoogle(true)
    setAuthError('')
    try {
      const result = await signInWithPopup(auth, googleProvider)
      setSignedInUser(result.user)
    } catch (error) {
      setAuthError(error.message || 'Google sign-in failed.')
    } finally {
      setLoadingGoogle(false)
    }
  }

  return (
    <AuthLayout subtitle="Log in to your account">
      <GoogleButton loading={loadingGoogle} onClick={handleGoogleSignIn} />

      <div className="my-6 h-px w-full bg-[#dedede]" />

      <form className="space-y-5">
        <div>
          <label className="mb-2 block text-[16px] font-semibold text-[#1d1d1d]">Email</label>
          <input
            type="email"
            placeholder="Enter your email address..."
            className="h-[46px] w-full cursor-text rounded-lg border border-[#d9d9d9] px-4 text-[17px] text-[#4f4f4f] outline-none placeholder:text-[#a0a0a0] focus:border-[#2f80ed]"
          />
        </div>

        <div>
          <label className="mb-2 block text-[16px] font-semibold text-[#1d1d1d]">Password</label>
          <div className="flex h-[46px] items-center rounded-lg border border-[#d9d9d9] px-4 focus-within:border-[#2f80ed]">
            <input
              type="password"
              placeholder="Enter your password"
              className="h-full w-full cursor-text border-none text-[17px] text-[#4f4f4f] outline-none placeholder:text-[#a0a0a0]"
            />
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#9aa0a6]" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 text-[15px]">
          <label className="flex cursor-pointer items-center gap-3 text-[#2f2f2f]">
            <input type="checkbox" className="h-4 w-4 cursor-pointer rounded border-[#2f80ed] accent-[#2f80ed]" />
            Remember me
          </label>
          <button type="button" className="cursor-pointer font-medium text-[#1f74e8]">
            Forgot password?
          </button>
        </div>

        <button
          type="button"
          className="mt-1 h-[50px] w-full cursor-pointer rounded-lg bg-gradient-to-r from-[#1e73e8] to-[#1971e9] text-[18px] font-semibold text-white"
        >
          Sign In
        </button>
      </form>

      <p className="mt-5 text-center text-[15px] text-[#303030]">
        Don&apos;t have an account? <Link to="/signup" className="font-semibold text-[#1f74e8]">Sign up</Link>
      </p>

      <div className="my-5 h-px w-full bg-[#e6e6e6]" />
      <p className="text-center text-[13px] text-[#808080]">
        By continuing, you agree to our <span className="text-[#1f74e8]">Terms</span> and{' '}
        <span className="text-[#1f74e8]">Privacy Policy</span>.
      </p>

      {signedInUser && (
        <p className="mt-4 text-center text-sm text-green-600">
          Signed in as {signedInUser.displayName || signedInUser.email}
        </p>
      )}
      {authError && <p className="mt-4 text-center text-sm text-red-600">{authError}</p>}
    </AuthLayout>
  )
}

function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [message, setMessage] = useState('')

  const strength = useMemo(() => getPasswordStrength(password), [password])
  const passwordsDoNotMatch = confirmPassword.length > 0 && password !== confirmPassword

  const handleGoogleSignUp = async () => {
    setLoadingGoogle(true)
    setMessage('')
    try {
      await signInWithPopup(auth, googleProvider)
      setMessage('Account created successfully.')
    } catch (error) {
      setMessage(error.message || 'Google sign-up failed.')
    } finally {
      setLoadingGoogle(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await createUserWithEmailAndPassword(auth, email, password)
      setMessage('Account created successfully.')
    } catch (error) {
      setMessage(error.message || 'Could not create account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout subtitle="Create your account">
      <GoogleButton loading={loadingGoogle} onClick={handleGoogleSignUp} />

      <div className="my-5 h-px w-full bg-[#dedede]" />

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-[16px] font-semibold text-[#1d1d1d]">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email address..."
            className="h-[46px] w-full cursor-text rounded-lg border border-[#d9d9d9] px-4 text-[17px] text-[#4f4f4f] outline-none placeholder:text-[#a0a0a0] focus:border-[#2f80ed]"
          />
        </div>

        <div>
          <label className="mb-2 block text-[16px] font-semibold text-[#1d1d1d]">Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Create a password"
            className="h-[46px] w-full cursor-text rounded-lg border border-[#d9d9d9] px-4 text-[17px] text-[#4f4f4f] outline-none placeholder:text-[#a0a0a0] focus:border-[#2f80ed]"
          />
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#ededed]">
              <div className={`h-full rounded-full transition-all ${strength.color} ${strength.width}`} />
            </div>
            <p className={`mt-1 text-[13px] font-medium ${strength.text}`}>{strength.label}</p>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[16px] font-semibold text-[#1d1d1d]">Confirm password</label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Re-enter your password"
            className={`h-[46px] w-full cursor-text rounded-lg border px-4 text-[17px] text-[#4f4f4f] outline-none placeholder:text-[#a0a0a0] ${
              passwordsDoNotMatch ? 'border-[#ef4444] focus:border-[#ef4444]' : 'border-[#d9d9d9] focus:border-[#2f80ed]'
            }`}
          />
          {passwordsDoNotMatch && (
            <p className="mt-1 text-[13px] font-medium text-[#ef4444]">Passwords do not match.</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="h-[50px] w-full cursor-pointer rounded-lg bg-gradient-to-r from-[#1e73e8] to-[#1971e9] text-[18px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>
      </form>

      <p className="mt-5 text-center text-[15px] text-[#303030]">
        Already have an account? <Link to="/login" className="font-semibold text-[#1f74e8]">Log in</Link>
      </p>

      <div className="my-5 h-px w-full bg-[#e6e6e6]" />
      <p className="text-center text-[13px] text-[#808080]">
        By continuing, you agree to our <span className="text-[#1f74e8]">Terms</span> and{' '}
        <span className="text-[#1f74e8]">Privacy Policy</span>.
      </p>

      {message && (
        <p className={`mt-4 text-center text-sm ${message.includes('successfully') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}
    </AuthLayout>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
