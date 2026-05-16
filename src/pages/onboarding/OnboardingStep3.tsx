/**
 * OnboardingStep3 — "Review & Edit Profile".
 *
 * The Gemini-extracted profile is shown in a fully editable form. Every field
 * carries an "AI generated" badge while it still matches the extraction, so
 * the user can see what came from Gemini versus what they typed. "Save Profile"
 * merges the confirmed profile onto `users/{uid}` and routes to the dashboard.
 */
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../contexts/AuthContext'
import OnboardingProgress from '../../components/OnboardingProgress'
import TagInput from '../../components/TagInput'
import { useOnboardingStore } from '../../stores/useOnboardingStore'
import type { ExtractedProfile, InferredStage } from '../../types'

const SECTOR_OPTIONS = [
  'FinTech',
  'HealthTech',
  'AgriTech',
  'SaaS',
  'EdTech',
  'Cybersecurity',
  'Supply Chain',
  'Government',
  'Deep Tech',
  'CleanTech',
  'PropTech',
  'Retail',
  'Other',
]

const SIGNAL_OPTIONS = [
  'Mentorship',
  'Investment',
  'Partnership',
  'Market Access',
  'Technical Advisory',
  'Policy',
  'B2B Sales',
  'Regulatory Guidance',
]

const STAGES: InferredStage[] = [
  'pre-seed',
  'seed',
  'series-a',
  'growth',
  'established',
  'ecosystem',
]

/** Trims, drops blanks and removes case-insensitive duplicates. */
function dedupe(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const tag = raw.trim()
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(tag)
  }
  return out
}

function AiBadge() {
  return (
    <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] italic text-gray-500">
      AI generated
    </span>
  )
}

export default function OnboardingStep3() {
  const { extractedProfile, editedProfile } = useOnboardingStore()
  const base = editedProfile ?? extractedProfile

  // Reached without going through step 1 — send the user back to the start.
  if (!base) {
    return <Navigate to="/onboarding/step1" replace />
  }
  return <Step3Form initial={base} extracted={extractedProfile} />
}

function Step3Form({
  initial,
  extracted,
}: {
  initial: ExtractedProfile
  extracted: ExtractedProfile | null
}) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { setEditedProfile } = useOnboardingStore()

  const [form, setForm] = useState<ExtractedProfile>(initial)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  function update<K extends keyof ExtractedProfile>(
    key: K,
    value: ExtractedProfile[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  /** A field is "AI generated" while it still equals the (non-empty) extraction. */
  function isAiGenerated(key: keyof ExtractedProfile): boolean {
    if (!extracted) return false
    const extractedValue = extracted[key]
    const extractedEmpty = Array.isArray(extractedValue)
      ? extractedValue.length === 0
      : !String(extractedValue).trim()
    if (extractedEmpty) return false
    return JSON.stringify(extractedValue) === JSON.stringify(form[key])
  }

  async function handleSave() {
    if (!user) {
      setSaveError('Please sign in again before saving your profile.')
      return
    }
    setSaving(true)
    setSaveError('')

    const userRef = doc(db, 'users', user.uid)

    try {
      const payload = {
        id: user.uid,
        name: user.displayName ?? user.email?.split('@')[0] ?? 'New Member',
        email: user.email ?? '',
        photoURL: user.photoURL ?? '',
        headline: form.headline.trim(),
        bio: form.bio.trim(),
        inferredSector: dedupe(form.inferredSector),
        inferredExpertise: dedupe(form.inferredExpertise),
        inferredStage: form.inferredStage,
        contributionSignals: dedupe(form.contributionSignals),
        profileCompleteness: Math.max(
          0,
          Math.min(100, Math.round(form.profileCompleteness)),
        ),
        onboardingComplete: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      setEditedProfile({
        headline: payload.headline,
        bio: payload.bio,
        inferredSector: payload.inferredSector,
        inferredExpertise: payload.inferredExpertise,
        inferredStage: payload.inferredStage,
        contributionSignals: payload.contributionSignals,
        profileCompleteness: payload.profileCompleteness,
      })
      await setDoc(userRef, payload, { merge: true })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Could not save your profile. Please try again.',
      )
      setSaving(false)
    }
  }

  const completeness = Math.max(
    0,
    Math.min(100, Math.round(form.profileCompleteness)),
  )

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        <OnboardingProgress currentStep={3} />

        <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Review your AI-generated profile
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Check the information below. You can edit anything before saving.
          </p>

          <div className="mt-6 space-y-6">
            {/* Headline */}
            <div>
              <div className="mb-1.5 flex items-center">
                <label
                  htmlFor="headline"
                  className="text-sm font-semibold text-gray-800"
                >
                  Headline / Current Title
                </label>
                {isAiGenerated('headline') && <AiBadge />}
              </div>
              <input
                id="headline"
                type="text"
                value={form.headline}
                onChange={(e) => update('headline', e.target.value)}
                placeholder="e.g. Founder building climate fintech for SMEs"
                className="h-11 w-full rounded-xl border border-gray-300 px-4 text-sm text-gray-800 outline-none focus:border-blue-600"
              />
            </div>

            {/* Bio */}
            <div>
              <div className="mb-1.5 flex items-center">
                <label
                  htmlFor="bio"
                  className="text-sm font-semibold text-gray-800"
                >
                  Bio / Profile Summary
                </label>
                {isAiGenerated('bio') && <AiBadge />}
              </div>
              <textarea
                id="bio"
                rows={4}
                value={form.bio}
                onChange={(e) => update('bio', e.target.value)}
                placeholder="Two or three sentences about who you are and what you offer."
                className="w-full resize-y rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 outline-none focus:border-blue-600"
              />
            </div>

            {/* Inferred Sector */}
            <div>
              <div className="mb-1.5 flex items-center">
                <span className="text-sm font-semibold text-gray-800">
                  Inferred Sector
                </span>
                {isAiGenerated('inferredSector') && <AiBadge />}
              </div>
              <TagInput
                label="Inferred Sector"
                value={form.inferredSector}
                onChange={(tags) => update('inferredSector', tags)}
                suggestions={SECTOR_OPTIONS}
                maxTags={6}
                placeholder="Add a sector…"
              />
            </div>

            {/* Inferred Expertise */}
            <div>
              <div className="mb-1.5 flex items-center">
                <span className="text-sm font-semibold text-gray-800">
                  Inferred Expertise
                </span>
                {isAiGenerated('inferredExpertise') && <AiBadge />}
              </div>
              <TagInput
                label="Inferred Expertise"
                value={form.inferredExpertise}
                onChange={(tags) => update('inferredExpertise', tags)}
                suggestions={[]}
                maxTags={6}
                placeholder="Type a skill and press Enter…"
              />
            </div>

            {/* Stage + Completeness — side by side on desktop, stacked on mobile */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 flex items-center">
                  <span className="text-sm font-semibold text-gray-800">
                    Inferred Stage
                  </span>
                  {isAiGenerated('inferredStage') && <AiBadge />}
                </div>
                <div className="flex flex-wrap gap-2">
                  {STAGES.map((stage) => {
                    const selected = form.inferredStage === stage
                    return (
                      <button
                        key={stage}
                        type="button"
                        onClick={() => update('inferredStage', stage)}
                        aria-pressed={selected}
                        className={`cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                          selected
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {stage}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">
                    Profile Completeness
                  </span>
                  <span className="text-sm font-semibold text-blue-700">
                    {completeness}%
                  </span>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{ width: `${completeness}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-gray-400">
                  Higher completeness improves your match quality in ecosystem
                  events.
                </p>
              </div>
            </div>

            {/* Contribution Signals */}
            <div>
              <div className="mb-1.5 flex items-center">
                <span className="text-sm font-semibold text-gray-800">
                  Contribution Signals
                </span>
                {isAiGenerated('contributionSignals') && <AiBadge />}
              </div>
              <TagInput
                label="Contribution Signals"
                value={form.contributionSignals}
                onChange={(tags) => update('contributionSignals', tags)}
                suggestions={SIGNAL_OPTIONS}
                maxTags={5}
                placeholder="Add what you can offer…"
              />
            </div>
          </div>

          {saveError && (
            <p className="mt-5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {saveError}
            </p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-6 h-12 w-full cursor-pointer rounded-xl bg-blue-600 text-base font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving your profile…' : 'Save Profile'}
          </button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-gray-400">
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            You can edit these details anytime later.
          </p>
        </div>
      </div>
    </div>
  )
}
