import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { updateProfile } from 'firebase/auth'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import type { InferredStage } from '../types'

type EditForm = {
  name: string
  email: string
  headline: string
  bio: string
  image: string
  profileImageBase64: string
  inferredSector: string[]
  inferredExpertise: string[]
  inferredStage: InferredStage
  contributionSignals: string[]
  hasAddedAISignals: boolean
  profileCompleteness: number
}

const emptyForm: EditForm = {
  name: '',
  email: '',
  headline: '',
  bio: '',
  image: '',
  profileImageBase64: '',
  inferredSector: [],
  inferredExpertise: [],
  inferredStage: 'ecosystem',
  contributionSignals: [],
  hasAddedAISignals: false,
  profileCompleteness: 0,
}

const maxPhotoSizeBytes = 2 * 1024 * 1024
const maxBase64Bytes = 700 * 1024
const maxPhotoDimension = 720
const stages: InferredStage[] = [
  'pre-seed',
  'seed',
  'series-a',
  'growth',
  'established',
  'ecosystem',
]

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the selected image.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not prepare the selected image.'))
    image.src = src
  })
}

async function compressProfileImage(file: File): Promise<string> {
  const dataUrl = await readImageAsDataUrl(file)
  const image = await loadImage(dataUrl)
  const scale = Math.min(
    1,
    maxPhotoDimension / Math.max(image.width, image.height),
  )
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not process the selected image.')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  return canvas.toDataURL('image/jpeg', 0.82)
}

function estimateDataUrlBytes(dataUrl: string): number {
  return Math.ceil(dataUrl.length * 0.75)
}

function isImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:image/')
}

function calculateProfileCompleteness(profile: EditForm): number {
  const fields = [
    profile.profileImageBase64 || profile.image,
    profile.name.trim(),
    profile.email.trim(),
    profile.headline.trim(),
    profile.bio.trim(),
    profile.inferredSector.length,
    profile.inferredExpertise.length,
    profile.inferredStage,
    profile.contributionSignals.length,
    profile.hasAddedAISignals,
  ]

  const completed = fields.filter(Boolean).length
  return Math.round((completed / fields.length) * 100)
}

function dedupe(tags: string[]): string[] {
  const seen = new Set<string>()
  const clean: string[] = []
  for (const raw of tags) {
    const tag = raw.trim()
    const key = tag.toLowerCase()
    if (!tag || seen.has(key)) continue
    seen.add(key)
    clean.push(tag)
  }
  return clean
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function FieldLabel({ children }: { children: string }) {
  return (
    <label className="text-[12px] font-semibold text-slate-950">
      {children}
    </label>
  )
}

function TextInput({
  value,
  onChange,
  type = 'text',
}: {
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
    />
  )
}

function EditableTags({
  value,
  onChange,
  onStartAdd,
  placeholder = 'Add',
}: {
  value: string[]
  onChange: (value: string[]) => void
  onStartAdd?: () => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  function addTag() {
    const tag = draft.trim()
    if (!tag) return
    onChange(dedupe([...value, tag]))
    setDraft('')
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-blue-50 px-2.5 text-[12px] font-semibold text-blue-700 ring-1 ring-blue-100"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((item) => item !== tag))}
            className="text-blue-500 hover:text-blue-800"
            aria-label={`Remove ${tag}`}
          >
            x
          </button>
        </span>
      ))}
      {isAdding ? (
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={addTag}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              addTag()
            }
            if (event.key === 'Escape') {
              setDraft('')
              setIsAdding(false)
            }
          }}
          placeholder={placeholder}
          autoFocus
          className="h-8 min-w-48 rounded-lg border border-blue-200 bg-white px-3 text-[13px] font-medium text-slate-600 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setIsAdding(true)
            onStartAdd?.()
          }}
          className="inline-flex h-8 items-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-[13px] font-semibold text-blue-600 hover:bg-blue-100"
        >
          + Add
        </button>
      )}
    </div>
  )
}

function SignalIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">
      {children}
    </span>
  )
}

export default function EditUserProfile() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [form, setForm] = useState<EditForm>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [photoError, setPhotoError] = useState('')

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    return onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        const data = snap.data()
        const profileImageBase64 = isImageDataUrl(data?.profileImageBase64)
          ? data.profileImageBase64
          : isImageDataUrl(data?.image)
            ? data.image
            : ''
        const displayImage =
          profileImageBase64 || data?.image || data?.photoURL || user.photoURL || ''
        const nextForm = {
          name: data?.name ?? user.displayName ?? '',
          email: data?.email ?? user.email ?? '',
          headline: data?.headline ?? '',
          bio: data?.bio ?? '',
          image: displayImage,
          profileImageBase64,
          inferredSector: Array.isArray(data?.inferredSector)
            ? data.inferredSector
            : [],
          inferredExpertise: Array.isArray(data?.inferredExpertise)
            ? data.inferredExpertise
            : [],
          inferredStage: data?.inferredStage ?? 'ecosystem',
          contributionSignals: Array.isArray(data?.contributionSignals)
            ? data.contributionSignals
            : [],
          hasAddedAISignals: data?.hasAddedAISignals === true,
          profileCompleteness: Number(data?.profileCompleteness ?? 0),
        }
        setForm({
          ...nextForm,
          profileCompleteness: calculateProfileCompleteness(nextForm),
        })
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
  }, [user])

  function update<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      return {
        ...next,
        profileCompleteness: calculateProfileCompleteness(next),
      }
    })
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    setPhotoError('')
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose a valid image file.')
      return
    }
    if (file.size > maxPhotoSizeBytes) {
      setPhotoError('Image must be 2MB or smaller before compression.')
      return
    }

    try {
      const image = await compressProfileImage(file)
      if (estimateDataUrlBytes(image) > maxBase64Bytes) {
        setPhotoError('Image is still too large after compression. Try a smaller photo.')
        return
      }
      setForm((prev) => {
        const next = {
          ...prev,
          image,
          profileImageBase64: image,
        }
        return {
          ...next,
          profileCompleteness: calculateProfileCompleteness(next),
        }
      })
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : 'Could not prepare image.',
      )
    }
  }

  function handleStartAddingAISignals() {
    update('hasAddedAISignals', true)
  }

  async function handleSave() {
    if (!user) return
    setSaving(true)
    setError('')

    try {
      const normalizedForm = {
        ...form,
        inferredSector: dedupe(form.inferredSector),
        inferredExpertise: dedupe(form.inferredExpertise),
        contributionSignals: dedupe(form.contributionSignals),
      }
      const profileCompleteness = calculateProfileCompleteness(normalizedForm)
      const profileImage = form.profileImageBase64 || form.image
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        headline: form.headline.trim(),
        bio: form.bio.trim(),
        image: profileImage,
        photoURL: profileImage,
        profileImageBase64: form.profileImageBase64,
        inferredSector: normalizedForm.inferredSector,
        inferredExpertise: normalizedForm.inferredExpertise,
        inferredStage: form.inferredStage,
        contributionSignals: normalizedForm.contributionSignals,
        hasAddedAISignals: form.hasAddedAISignals,
        profileCompleteness,
        updatedAt: serverTimestamp(),
      }

      await Promise.all([
        updateDoc(doc(db, 'users', user.uid), payload),
        updateProfile(user, {
          displayName: payload.name,
        }),
      ])

      navigate('/profile')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile.')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-60 animate-pulse rounded-2xl bg-white" />
        <div className="h-64 animate-pulse rounded-2xl bg-white" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[27px] font-bold tracking-tight text-slate-950">
            Edit Profile
          </h1>
          <p className="mt-1 text-[13px] font-medium text-slate-600 sm:text-[15px]">
            Update your profile information and AI-generated ecosystem signals.
          </p>
        </div>
        <Link
          to="/profile"
          className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Cancel
        </Link>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-6">
        <h2 className="text-sm font-semibold text-slate-950">
          Basic Information
        </h2>
        <div className="mt-5 grid gap-6 lg:grid-cols-[210px_1fr]">
          <div className="flex flex-col items-center border-slate-100 lg:border-r lg:pr-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => void handlePhotoChange(event)}
            />
            <div className="relative h-32 w-32 overflow-hidden rounded-full bg-blue-50">
              {form.image ? (
                <img
                  src={form.image}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-3xl font-bold text-blue-700">
                  {form.name.slice(0, 1).toUpperCase() || 'U'}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                aria-label="Choose profile photo"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-[13px] font-semibold text-blue-600 hover:bg-blue-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="m17 8-5-5-5 5" />
                <path d="M12 3v12" />
              </svg>
              Upload New Photo
            </button>
            <p className="mt-2 text-[11px] font-medium text-slate-500">
              Image file, max 2MB
            </p>
            {photoError ? (
              <p className="mt-2 text-center text-[11px] font-semibold text-red-600">
                {photoError}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Full Name</FieldLabel>
                <TextInput
                  value={form.name}
                  onChange={(value) => update('name', value)}
                />
              </div>
              <div>
                <FieldLabel>Email</FieldLabel>
                <TextInput
                  type="email"
                  value={form.email}
                  onChange={(value) => update('email', value)}
                />
              </div>
            </div>

            <div>
              <FieldLabel>Headline / Current Title</FieldLabel>
              <TextInput
                value={form.headline}
                onChange={(value) => update('headline', value)}
              />
            </div>

            <div>
              <FieldLabel>Bio / Profile Summary</FieldLabel>
              <textarea
                value={form.bio}
                onChange={(event) => update('bio', event.target.value)}
                rows={4}
                className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium leading-5 text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <SignalIcon>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 3 9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5L12 3Z" />
              </svg>
            </SignalIcon>
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                AI-Generated Profile Signals
              </h2>
              <p className="mt-1 text-[12px] font-medium text-slate-500">
                These signals were generated from your onboarding profile. You
                can adjust them to improve match quality.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-[150px_1fr] sm:items-start">
              <div className="flex items-center gap-3">
                <SignalIcon>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M3 21h18" />
                    <path d="M5 21V7l8-4v18" />
                    <path d="M19 21V11l-6-4" />
                  </svg>
                </SignalIcon>
                <p className="text-[13px] font-semibold text-slate-950">
                  Industry / Sector
                </p>
              </div>
              <EditableTags
                value={form.inferredSector}
                onChange={(value) => update('inferredSector', value)}
                onStartAdd={handleStartAddingAISignals}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-[150px_1fr] sm:items-start">
              <div className="flex items-center gap-3">
                <SignalIcon>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="m16 18 6-6-6-6" />
                    <path d="m8 6-6 6 6 6" />
                  </svg>
                </SignalIcon>
                <p className="text-[13px] font-semibold text-slate-950">
                  Skills & Expertise
                </p>
              </div>
              <EditableTags
                value={form.inferredExpertise}
                onChange={(value) => update('inferredExpertise', value)}
                onStartAdd={handleStartAddingAISignals}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-[150px_1fr] sm:items-start">
              <div className="flex items-center gap-3">
                <SignalIcon>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M3 17 9 11l4 4 8-8" />
                    <path d="M14 7h7v7" />
                  </svg>
                </SignalIcon>
                <p className="text-[13px] font-semibold text-slate-950">
                  Growth Stage
                </p>
              </div>
              <select
                value={form.inferredStage}
                onChange={(event) =>
                  update('inferredStage', event.target.value as InferredStage)
                }
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {stages.map((stage) => (
                  <option key={stage} value={stage}>
                    {titleCase(stage)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-[150px_1fr] sm:items-start">
              <div className="flex items-center gap-3">
                <SignalIcon>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <rect width="20" height="14" x="2" y="7" rx="2" />
                    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                  </svg>
                </SignalIcon>
                <p className="text-[13px] font-semibold text-slate-950">
                  Possible Roles
                </p>
              </div>
              <EditableTags
                value={form.contributionSignals}
                onChange={(value) => update('contributionSignals', value)}
                onStartAdd={handleStartAddingAISignals}
              />
            </div>
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.045)]">
          <p className="text-sm font-semibold text-slate-950">
            Profile Completeness
          </p>
          <p className="mt-3 text-[34px] font-bold leading-none text-blue-600">
            {Math.round(form.profileCompleteness)}%
          </p>
          <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${form.profileCompleteness}%` }}
            />
          </div>
          <p className="mt-3 text-[12px] font-medium leading-5 text-slate-500">
            Higher completeness improves your match quality in ecosystem
            contexts.
          </p>
          <div className="mt-5 rounded-lg bg-blue-50 p-4 text-[12px] font-medium leading-5 text-slate-700">
            <p className="font-semibold text-blue-700">Suggested improvement</p>
            <p className="mt-1">Add impact achievements or project outcomes.</p>
          </div>
        </aside>
      </section>

      <footer className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] font-medium text-slate-500">
          You can update these details anytime.
        </p>
        <div className="flex items-center gap-3">
          {error ? (
            <p className="text-[12px] font-semibold text-red-600">{error}</p>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-5 text-[13px] font-semibold text-white shadow-sm shadow-blue-500/20 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
              <path d="M17 21v-8H7v8" />
              <path d="M7 3v5h8" />
            </svg>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </footer>
    </div>
  )
}
