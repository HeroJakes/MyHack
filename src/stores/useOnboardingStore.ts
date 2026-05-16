/**
 * useOnboardingStore — Zustand store that carries onboarding state across the
 * three onboarding steps so the pages do not need to prop-drill.
 *
 *  - `input` holds whatever the user pasted on step 1.
 *  - `extractedProfile` is the untouched Gemini output (used to flag which
 *     fields are still AI-generated on step 3).
 *  - `editedProfile` is the working copy the user reviews and edits.
 */
import { create } from 'zustand'
import type { ExtractedProfile } from '../types'

interface OnboardingInput {
  linkedinUrl: string
  websiteUrl: string
  bio: string
}

interface OnboardingStore {
  step: 1 | 2 | 3
  input: OnboardingInput
  extractedProfile: ExtractedProfile | null
  editedProfile: ExtractedProfile | null
  setStep: (step: 1 | 2 | 3) => void
  setInput: (input: Partial<OnboardingInput>) => void
  setExtractedProfile: (profile: ExtractedProfile) => void
  setEditedProfile: (profile: ExtractedProfile) => void
  reset: () => void
}

const initialInput: OnboardingInput = {
  linkedinUrl: '',
  websiteUrl: '',
  bio: '',
}

export const useOnboardingStore = create<OnboardingStore>()((set) => ({
  step: 1,
  input: initialInput,
  extractedProfile: null,
  editedProfile: null,
  setStep: (step) => set({ step }),
  setInput: (input) => set((state) => ({ input: { ...state.input, ...input } })),
  setExtractedProfile: (profile) => set({ extractedProfile: profile }),
  setEditedProfile: (profile) => set({ editedProfile: profile }),
  reset: () =>
    set({
      step: 1,
      input: initialInput,
      extractedProfile: null,
      editedProfile: null,
    }),
}))
