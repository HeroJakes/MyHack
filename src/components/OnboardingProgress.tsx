/**
 * OnboardingProgress — the three-step stepper shown atop every onboarding page.
 *
 * Active step: filled blue circle, bold label.
 * Completed step: filled blue circle with a checkmark, grey label.
 * Upcoming step: outline circle, grey label.
 */
import { Fragment } from 'react'

interface OnboardingProgressProps {
  currentStep: 1 | 2 | 3
}

const STEPS = [
  { n: 1, label: 'Who you are' },
  { n: 2, label: 'AI Profile Builder' },
  { n: 3, label: 'Review & Edit Profile' },
] as const

export default function OnboardingProgress({
  currentStep,
}: OnboardingProgressProps) {
  return (
    <div className="mx-auto mb-8 flex w-full max-w-[480px] items-start">
      {STEPS.map((step, index) => {
        const isDone = step.n < currentStep
        const isActive = step.n === currentStep
        return (
          <Fragment key={step.n}>
            <div className="flex w-24 flex-col items-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                  isActive || isDone
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 bg-white text-gray-400'
                }`}
              >
                {isDone ? '✓' : step.n}
              </div>
              <span
                className={`mt-2 text-center text-xs leading-tight ${
                  isActive ? 'font-semibold text-blue-700' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`mt-[18px] h-0.5 flex-1 rounded-full ${
                  isDone ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
