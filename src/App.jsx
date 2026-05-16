import { useState } from 'react'
import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from './lib/firebase'

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
    <main className="min-h-screen bg-[#f6f6f7] px-4 py-10 text-[#111827] sm:py-14">
      <div className="mx-auto w-full max-w-[640px]">
        <h1 className="text-center text-5xl font-semibold leading-none text-[#111827] sm:text-6xl">Welcome</h1>
        <p className="mt-4 text-center text-xl text-[#6b7280] sm:text-[34px]">
          Sign in to continue or create a new account.
        </p>

        <section className="mx-auto mt-8 w-full rounded-3xl border border-[#e5e7eb] bg-white p-5 shadow-[0_2px_18px_rgba(0,0,0,0.05)] sm:mt-10 sm:p-8">
          <div className="grid grid-cols-2 border-b border-[#e5e7eb] text-center text-2xl font-semibold sm:text-[38px]">
            <button type="button" className="border-b-4 border-[#2563eb] pb-4 text-[#2563eb]">
              Sign In
            </button>
            <button type="button" className="pb-4 text-[#6b7280]">
              Sign Up
            </button>
          </div>

          <form className="mt-6 space-y-6 sm:mt-8 sm:space-y-8">
            <div>
              <label className="mb-2 block text-xl font-semibold text-[#111827] sm:mb-3 sm:text-[34px]">Email address</label>
              <input
                type="email"
                placeholder="you@example.com"
                className="h-14 w-full rounded-xl border border-[#d1d5db] px-4 text-lg text-[#6b7280] outline-none focus:border-[#2563eb] sm:h-[84px] sm:px-6 sm:text-[31px]"
              />
            </div>

            <div>
              <label className="mb-2 block text-xl font-semibold text-[#111827] sm:mb-3 sm:text-[34px]">Password</label>
              <input
                type="password"
                placeholder="•••••••••••"
                className="h-14 w-full rounded-xl border border-[#d1d5db] px-4 text-lg text-[#6b7280] outline-none focus:border-[#2563eb] sm:h-[84px] sm:px-6 sm:text-[31px]"
              />
            </div>

            <div className="flex items-center justify-between text-base sm:text-[30px]">
              <label className="flex items-center gap-2 sm:gap-3 text-[#374151]">
                <input type="checkbox" defaultChecked className="h-6 w-6 accent-[#2563eb]" />
                Remember me
              </label>
              <button type="button" className="text-[#2563eb]">
                Forgot password?
              </button>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loadingGoogle}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-xl border border-[#d1d5db] text-lg font-semibold text-[#111827] hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-70 sm:h-[84px] sm:gap-4 sm:text-[34px]"
            >
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                className="h-9 w-9"
              />
              {loadingGoogle ? 'Signing in with Google...' : 'Continue with Google'}
            </button>

            <div className="flex items-center gap-4 text-[#9ca3af]">
              <div className="h-px flex-1 bg-[#e5e7eb]" />
              <span className="text-base sm:text-[28px]">or</span>
              <div className="h-px flex-1 bg-[#e5e7eb]" />
            </div>

            <button
              type="button"
              className="h-14 w-full rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#2563eb] text-xl font-semibold text-white sm:h-[84px] sm:text-[36px]"
            >
              Sign In
            </button>
          </form>

          <p className="mt-8 text-center text-lg text-[#6b7280] sm:text-[30px]">
            Don&apos;t have an account? <button type="button" className="font-semibold text-[#2563eb]">Sign up</button>
          </p>

          {signedInUser && (
            <p className="mt-4 text-center text-sm text-green-600 sm:text-xl">
              Signed in as {signedInUser.displayName || signedInUser.email}
            </p>
          )}
          {authError && <p className="mt-4 text-center text-sm text-red-600 sm:text-xl">{authError}</p>}
        </section>

        <p className="mt-8 text-center text-base text-[#6b7280] sm:text-[28px]">
          By continuing, you agree to our <span className="text-[#2563eb]">Terms of Service</span> and{' '}
          <span className="text-[#2563eb]">Privacy Policy</span>.
        </p>
      </div>
    </main>
  )
}

export default App
