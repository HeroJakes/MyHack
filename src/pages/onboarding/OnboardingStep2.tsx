/**
 * OnboardingStep2 — transitional "AI Profile Builder" loading screen.
 *
 * Step 1 keeps its own loading overlay and navigates straight to step 3, so
 * this route is normally skipped. It is kept as a standalone shell: if it is
 * reached directly it forwards the user to wherever they actually belong.
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOnboardingStore } from '../../stores/useOnboardingStore'

export default function OnboardingStep2() {
  const navigate = useNavigate()
  const { extractedProfile, input } = useOnboardingStore()

  useEffect(() => {
    if (extractedProfile) {
      navigate('/onboarding/step3', { replace: true })
    } else if (
      !input.linkedinUrl.trim() &&
      !input.websiteUrl.trim() &&
      !input.bio.trim()
    ) {
      navigate('/onboarding/step1', { replace: true })
    }
  }, [extractedProfile, input, navigate])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      <h1 className="mt-6 text-xl font-semibold text-gray-900">
        Gemini is reading your profile…
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        This takes about 3-5 seconds.
      </p>
    </div>
  )
}
