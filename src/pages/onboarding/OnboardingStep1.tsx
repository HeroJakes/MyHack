/**
 * OnboardingStep1 — "Who you are".
 *
 * The user pastes any combination of a LinkedIn URL, a website URL or a
 * free-text bio, then triggers the Gemini extraction. On success we jump
 * straight to step 3 (the loading state lives on this page, so the step 2
 * shell route is skipped). On failure the user is offered a manual path.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingProgress from '../../components/OnboardingProgress'
import { useExtractProfile } from '../../hooks/useExtractProfile'
import { useOnboardingStore } from '../../stores/useOnboardingStore'
import type { ExtractedProfile } from '../../types'

const BIO_MAX = 1000

const EMPTY_PROFILE: ExtractedProfile = {
  headline: '',
  bio: '',
  inferredSector: [],
  inferredExpertise: [],
  inferredStage: 'pre-seed',
  contributionSignals: [],
  profileCompleteness: 0,
}

/** A result with no usable content — treated as a soft extraction failure. */
function isEmptyProfile(profile: ExtractedProfile): boolean {
  return (
    !profile.headline.trim() &&
    !profile.bio.trim() &&
    profile.inferredSector.length === 0 &&
    profile.inferredExpertise.length === 0 &&
    profile.contributionSignals.length === 0
  )
}

export default function OnboardingStep1() {
  const navigate = useNavigate()
  const { input, setInput, setExtractedProfile, setEditedProfile, setStep } =
    useOnboardingStore()
  const { extract, loading, error } = useExtractProfile()

  const [validationError, setValidationError] = useState('')
  const [showFallback, setShowFallback] = useState(false)

  const allEmpty =
    !input.linkedinUrl.trim() &&
    !input.websiteUrl.trim() &&
    !input.bio.trim()

  async function handleBuild() {
    setValidationError('')
    setShowFallback(false)
    if (allEmpty) {
      setValidationError(
        'Add a LinkedIn URL, a website, or a short bio to continue.',
      )
      return
    }
    try {
      const profile = await extract({
        linkedinUrl: input.linkedinUrl.trim() || undefined,
        websiteUrl: input.websiteUrl.trim() || undefined,
        bio: input.bio.trim() || undefined,
      })
      if (isEmptyProfile(profile)) {
        setShowFallback(true)
        return
      }
      setExtractedProfile(profile)
      setEditedProfile(profile)
      setStep(3)
      navigate('/onboarding/step3')
    } catch {
      // useExtractProfile has already produced a human-readable `error`.
      setShowFallback(true)
    }
  }

  function continueManually() {
    setExtractedProfile(EMPTY_PROFILE)
    setEditedProfile(EMPTY_PROFILE)
    setStep(3)
    navigate('/onboarding/step3')
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        <OnboardingProgress currentStep={1} />

        <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Tell us about yourself
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Paste your LinkedIn URL, website, or a short bio. Gemini will do
            the rest.
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="linkedinUrl"
                className="mb-1.5 block text-sm font-semibold text-gray-800"
              >
                LinkedIn Profile URL
              </label>
              <input
                id="linkedinUrl"
                type="url"
                value={input.linkedinUrl}
                onChange={(e) => setInput({ linkedinUrl: e.target.value })}
                placeholder="https://linkedin.com/in/yourname"
                disabled={loading}
                className="h-11 w-full rounded-xl border border-gray-300 px-4 text-sm text-gray-800 outline-none focus:border-blue-600 disabled:bg-gray-50"
              />
              <p className="mt-1 text-xs text-gray-400">
                We'll read your public profile headline to help Gemini.
              </p>
            </div>

            <div>
              <label
                htmlFor="websiteUrl"
                className="mb-1.5 block text-sm font-semibold text-gray-800"
              >
                Website URL
              </label>
              <input
                id="websiteUrl"
                type="url"
                value={input.websiteUrl}
                onChange={(e) => setInput({ websiteUrl: e.target.value })}
                placeholder="https://yourcompany.com"
                disabled={loading}
                className="h-11 w-full rounded-xl border border-gray-300 px-4 text-sm text-gray-800 outline-none focus:border-blue-600 disabled:bg-gray-50"
              />
              <p className="mt-1 text-xs text-gray-400">
                A company or portfolio site gives Gemini extra context.
              </p>
            </div>

            <div>
              <label
                htmlFor="bio"
                className="mb-1.5 block text-sm font-semibold text-gray-800"
              >
                Bio / Short Description
              </label>
              <textarea
                id="bio"
                rows={4}
                maxLength={BIO_MAX}
                value={input.bio}
                onChange={(e) => setInput({ bio: e.target.value })}
                placeholder="I'm the founder of..."
                disabled={loading}
                className="w-full resize-y rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 outline-none focus:border-blue-600 disabled:bg-gray-50"
              />
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="text-xs text-gray-400">
                  A sentence or two about what you do works best.
                </p>
                <span className="shrink-0 text-xs text-gray-400">
                  {input.bio.length}/{BIO_MAX}
                </span>
              </div>
            </div>
          </div>

          {validationError && (
            <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {validationError}
            </p>
          )}

          {showFallback && (
            <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-3 text-sm text-red-700">
              <p className="font-semibold">
                {error || "We couldn't read that profile automatically."}
              </p>
              <p className="mt-0.5 text-red-600">
                You can fill in your details manually below.
              </p>
              <button
                type="button"
                onClick={continueManually}
                className="mt-2 cursor-pointer rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                Fill in my profile manually →
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleBuild}
            disabled={allEmpty || loading}
            className="mt-6 h-12 w-full cursor-pointer rounded-xl bg-blue-600 text-base font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Gemini is analysing…' : 'Build My Profile with AI'}
          </button>

          {loading && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
              <div className="h-full w-full animate-pulse rounded-full bg-blue-600" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
