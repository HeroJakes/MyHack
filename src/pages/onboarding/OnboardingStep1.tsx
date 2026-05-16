/**
 * OnboardingStep1 — "Who you are".
 *
 * The user uploads their CV / resume (PDF or image) and/or pastes a short bio,
 * then triggers the Gemini extraction. Gemini reads the file directly. On
 * success we jump straight to step 3 (the loading state lives on this page).
 * On failure the user is offered a manual path.
 */
import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingProgress from '../../components/OnboardingProgress'
import { useExtractProfile } from '../../hooks/useExtractProfile'
import { useOnboardingStore } from '../../stores/useOnboardingStore'
import type { ExtractedProfile } from '../../types'

const BIO_MAX = 1000
const MAX_CV_BYTES = 10 * 1024 * 1024
const ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp'
const ALLOWED_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]

interface CvFileState {
  name: string
  size: number
  mimeType: string
  data: string
}

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

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function OnboardingStep1() {
  const navigate = useNavigate()
  const { input, setInput, setExtractedProfile, setEditedProfile, setStep } =
    useOnboardingStore()
  const { extract, loading, error } = useExtractProfile()

  const [cvFile, setCvFile] = useState<CvFileState | null>(null)
  const [cvError, setCvError] = useState('')
  const [validationError, setValidationError] = useState('')
  const [showFallback, setShowFallback] = useState(false)

  const allEmpty = !cvFile && !input.bio.trim()

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // allow re-selecting the same file later
    if (!file) return

    setCvError('')
    setShowFallback(false)
    setValidationError('')

    if (!ALLOWED_MIME.includes(file.type)) {
      setCvError('Unsupported file. Upload a PDF, PNG or JPG.')
      return
    }
    if (file.size > MAX_CV_BYTES) {
      setCvError('That file is over 10MB. Please upload a smaller CV.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const base64 = result.includes(',')
        ? result.slice(result.indexOf(',') + 1)
        : result
      if (!base64) {
        setCvError('Could not read that file. Please try another.')
        return
      }
      setCvFile({
        name: file.name,
        size: file.size,
        mimeType: file.type,
        data: base64,
      })
    }
    reader.onerror = () =>
      setCvError('Could not read that file. Please try another.')
    reader.readAsDataURL(file)
  }

  async function handleBuild() {
    setValidationError('')
    setShowFallback(false)
    if (allEmpty) {
      setValidationError('Upload your CV or add a short bio to continue.')
      return
    }
    try {
      const profile = await extract({
        cvFile: cvFile
          ? { mimeType: cvFile.mimeType, data: cvFile.data }
          : undefined,
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
            Upload your CV or paste a short bio — Gemini turns it into your
            profile.
          </p>

          <div className="mt-6 space-y-5">
            {/* CV upload */}
            <div>
              <span className="mb-1.5 block text-sm font-semibold text-gray-800">
                Upload your CV / Resume
              </span>

              {cvFile ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-300 bg-gray-50 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-8 w-8 shrink-0 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                    >
                      <path d="M14 3v5h5" />
                      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    </svg>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800">
                        {cvFile.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatSize(cvFile.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCvFile(null)}
                    disabled={loading}
                    className="shrink-0 cursor-pointer rounded-lg px-2 py-1 text-sm font-medium text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label
                  className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 px-4 py-8 text-center transition-colors hover:border-blue-500 hover:bg-blue-50/40 ${
                    loading ? 'pointer-events-none opacity-60' : 'cursor-pointer'
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-8 w-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M12 16V4m0 0L7 9m5-5 5 5" />
                    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                  </svg>
                  <span className="mt-2 text-sm font-medium text-gray-700">
                    Click to upload your CV
                  </span>
                  <span className="mt-0.5 text-xs text-gray-400">
                    PDF, PNG or JPG · up to 10MB
                  </span>
                  <input
                    type="file"
                    accept={ACCEPT}
                    onChange={handleFileChange}
                    disabled={loading}
                    className="hidden"
                  />
                </label>
              )}

              {cvError && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {cvError}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-400">
                Gemini reads your CV directly to draft your profile.
              </p>
            </div>

            {/* Bio / resume text */}
            <div>
              <label
                htmlFor="bio"
                className="mb-1.5 block text-sm font-semibold text-gray-800"
              >
                Bio / Resume text{' '}
                <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                id="bio"
                rows={4}
                maxLength={BIO_MAX}
                value={input.bio}
                onChange={(e) => setInput({ bio: e.target.value })}
                placeholder="Paste your résumé text, or a few sentences about what you do…"
                disabled={loading}
                className="w-full resize-y rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 outline-none focus:border-blue-600 disabled:bg-gray-50"
              />
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="text-xs text-gray-400">
                  Use this on its own, or alongside your CV for extra context.
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
