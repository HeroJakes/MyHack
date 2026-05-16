import { useState } from 'react'
import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from './lib/firebase'
import googleLogo from './assets/google.svg'

function App() {
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
    <main className="flex h-screen items-center justify-center overflow-hidden bg-white p-6 text-[#111111]">
      <div className="flex h-full max-h-[900px] w-full max-w-[1100px] items-center justify-center rounded-sm bg-white px-6">
        <div className="w-full max-w-[500px]">
          <h1 className="text-[34px] font-bold leading-tight text-[#111111]">
            Think it. Make it.
          </h1>
          <p className="mt-1 text-[22px] font-semibold leading-tight text-[#8f8f8f]">Log in to your account</p>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loadingGoogle}
            className="mt-7 flex h-[48px] w-full items-center justify-center gap-3 rounded-lg border border-[#d9d9d9] bg-white text-[18px] font-medium text-[#202124] hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <img src={googleLogo} alt="" aria-hidden="true" className="h-10 w-10" />
            {loadingGoogle ? 'Signing in with Google...' : 'Continue with Google'}
          </button>

          <div className="my-6 h-px w-full bg-[#dedede]" />

          <form className="space-y-5">
            <div>
              <label className="mb-2 block text-[16px] font-semibold text-[#1d1d1d]">Email</label>
              <input
                type="email"
                placeholder="Enter your email address..."
                className="h-[46px] w-full rounded-lg border border-[#d9d9d9] px-4 text-[17px] text-[#4f4f4f] outline-none placeholder:text-[#a0a0a0] focus:border-[#2f80ed]"
              />
            </div>

            <div>
              <label className="mb-2 block text-[16px] font-semibold text-[#1d1d1d]">Password</label>
              <div className="flex h-[46px] items-center rounded-lg border border-[#d9d9d9] px-4 focus-within:border-[#2f80ed]">
                <input
                  type="password"
                  placeholder="••••••••••••"
                  className="h-full w-full border-none text-[17px] text-[#4f4f4f] outline-none placeholder:text-[#a0a0a0]"
                />
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#9aa0a6]" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 text-[15px]">
              <label className="flex items-center gap-3 text-[#2f2f2f]">
                <input type="checkbox" className="h-4 w-4 rounded border-[#2f80ed] accent-[#2f80ed]" />
                Remember me
              </label>
              <button type="button" className="font-medium text-[#1f74e8]">
                Forgot password?
              </button>
            </div>

            <button
              type="button"
              className="mt-1 h-[50px] w-full rounded-lg bg-gradient-to-r from-[#1e73e8] to-[#1971e9] text-[18px] font-semibold text-white"
            >
              Sign In
            </button>
          </form>

          <p className="mt-5 text-center text-[15px] text-[#303030]">
            Don&apos;t have an account? <button type="button" className="font-semibold text-[#1f74e8]">Sign up</button>
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
        </div>
      </div>
    </main>
  )
}

export default App
