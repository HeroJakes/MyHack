/**
 * useCreateContext — the single source of truth for the Create Context page.
 *
 * The page is a fully controlled component: every form field lives here.
 * Submitting calls the `createContext` callable Cloud Function (never
 * Firestore directly) and returns the new contextId.
 */
import { useCallback, useMemo, useState } from 'react'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../lib/firebase'
import type { RelationshipRole, RelationshipType } from '../types'

export type ContextType =
  | 'Event'
  | 'Programme'
  | 'Initiative'
  | 'Cohort'
  | 'CountryExpansion'

export type LocationType = 'Physical' | 'Virtual' | 'Hybrid'

export type ContextStatus = 'draft' | 'open'

/** A relationship need as edited on the page (keywords always present). */
export interface ContextRelationshipNeed {
  role: RelationshipRole
  count: number
  relationshipType: RelationshipType
  requirements: string
  keywords: string[]
}

/** The full Create Context form state. */
export interface ContextFormData {
  name: string
  contextType: ContextType
  field: string
  description: string
  locationType: LocationType
  location: string
  startDate: string
  endDate: string
  status: ContextStatus
  imageUrl: string
  targetOutcomes: string[]
  relationshipNeeds: ContextRelationshipNeed[]
}

/** Keys of the inline validation checklist shown in the right rail. */
export type ValidationKey =
  | 'nameProvided'
  | 'typeSelected'
  | 'fieldSelected'
  | 'descriptionAdded'
  | 'dateSelected'
  | 'locationProvided'
  | 'needAdded'
  | 'countValid'

/** Role -> default relationship type. Selecting a role auto-couples this. */
export const ROLE_TO_RELATIONSHIP: Record<RelationshipRole, RelationshipType> = {
  Mentor: 'mentor_match',
  Partner: 'partner_linkage',
  'Service Provider': 'service_support',
  'Startup/Company': 'programme_fit',
  'Programme Admin': 'participant_orchestration',
}

const DESCRIPTION_MIN = 20

/** A fresh, empty relationship need row. */
export function emptyNeed(): ContextRelationshipNeed {
  return {
    role: 'Mentor',
    count: 1,
    relationshipType: 'mentor_match',
    requirements: '',
    keywords: [],
  }
}

/** A pristine form — also used as the baseline for the dirty check. */
function freshForm(): ContextFormData {
  return {
    name: '',
    contextType: 'Event',
    field: '',
    description: '',
    locationType: 'Physical',
    location: '',
    startDate: '',
    endDate: '',
    status: 'draft',
    imageUrl: '',
    targetOutcomes: [],
    relationshipNeeds: [],
  }
}

const PRISTINE_SNAPSHOT = JSON.stringify(freshForm())

function computeValidation(
  data: ContextFormData,
): Record<ValidationKey, boolean> {
  return {
    nameProvided: data.name.trim().length > 0,
    typeSelected: data.contextType.trim().length > 0,
    fieldSelected: data.field.trim().length > 0,
    descriptionAdded: data.description.trim().length >= DESCRIPTION_MIN,
    dateSelected: data.startDate.length > 0 && data.endDate.length > 0,
    locationProvided:
      data.locationType === 'Virtual' || data.location.trim().length > 0,
    needAdded: data.relationshipNeeds.length >= 1,
    countValid: data.relationshipNeeds.every((need) => need.count >= 1),
  }
}

interface CreateContextInput {
  name: string
  contextType: ContextType
  field: string
  description: string
  locationType: LocationType
  location: string
  startDate: string
  endDate: string
  status: ContextStatus
  imageUrl?: string
  targetOutcomes: string[]
  relationshipNeeds: ContextRelationshipNeed[]
}

interface CreateContextResult {
  contextId: string
}

export interface ExistingContextTarget {
  id: string
  collection: 'ecosystemContexts' | 'events'
}

export function useCreateContext() {
  const [formData, setFormData] = useState<ContextFormData>(freshForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setField = useCallback(
    <K extends keyof ContextFormData>(key: K, value: ContextFormData[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const replaceForm = useCallback((next: ContextFormData) => {
    setFormData(next)
  }, [])

  const addNeed = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      relationshipNeeds: [...prev.relationshipNeeds, emptyNeed()],
    }))
  }, [])

  const updateNeed = useCallback(
    (index: number, need: ContextRelationshipNeed) => {
      setFormData((prev) => ({
        ...prev,
        relationshipNeeds: prev.relationshipNeeds.map((existing, i) => {
          if (i !== index) return existing
          const next: ContextRelationshipNeed = { ...need }
          // Auto-couple the relationship type whenever the role changes.
          if (next.role !== existing.role) {
            next.relationshipType = ROLE_TO_RELATIONSHIP[next.role]
          }
          return next
        }),
      }))
    },
    [],
  )

  const removeNeed = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      relationshipNeeds: prev.relationshipNeeds.filter((_, i) => i !== index),
    }))
  }, [])

  const validationState = useMemo(
    () => computeValidation(formData),
    [formData],
  )

  const isValid = useMemo(
    () => Object.values(validationState).every(Boolean),
    [validationState],
  )

  const isDirty = useMemo(
    () => JSON.stringify(formData) !== PRISTINE_SNAPSHOT,
    [formData],
  )

  const submit = useCallback(
    async (
      status: ContextStatus,
      existing?: ExistingContextTarget | null,
    ): Promise<string | null> => {
      setError(null)

      // Required-field validation (the checklist) gates both buttons.
      if (!Object.values(computeValidation(formData)).every(Boolean)) {
        setError('Please complete every required field before saving.')
        return null
      }

      setFormData((prev) => ({ ...prev, status }))
      setLoading(true)
      try {
        const payload: CreateContextInput = {
          name: formData.name.trim(),
          contextType: formData.contextType,
          field: formData.field.trim(),
          description: formData.description.trim(),
          locationType: formData.locationType,
          location: formData.location.trim(),
          startDate: formData.startDate,
          endDate: formData.endDate,
          status,
          targetOutcomes: formData.targetOutcomes,
          relationshipNeeds: formData.relationshipNeeds.map((need) => ({
            role: need.role,
            count: need.count,
            relationshipType: need.relationshipType,
            requirements: need.requirements.trim(),
            keywords: need.keywords,
          })),
        }
        if (formData.imageUrl) {
          payload.imageUrl = formData.imageUrl
        }

        if (existing) {
          if (existing.collection === 'ecosystemContexts') {
            await updateDoc(doc(db, 'ecosystemContexts', existing.id), {
              name: payload.name,
              contextType: payload.contextType,
              field: payload.field,
              description: payload.description,
              locationType: payload.locationType,
              location: payload.location,
              startDate: new Date(`${payload.startDate}T00:00:00`),
              endDate: new Date(`${payload.endDate}T00:00:00`),
              status,
              imageUrl: payload.imageUrl ?? '',
              targetOutcomes: payload.targetOutcomes,
              relationshipNeeds: payload.relationshipNeeds,
              updatedAt: serverTimestamp(),
            })
          } else {
            await updateDoc(doc(db, 'events', existing.id), {
              name: payload.name,
              type: payload.contextType,
              field: payload.field,
              description: payload.description,
              status,
              eventDate: new Date(`${payload.startDate}T00:00:00`),
              roleRequirements: payload.relationshipNeeds,
            })
          }
          return existing.id
        }

        const callable = httpsCallable<
          CreateContextInput,
          CreateContextResult
        >(functions, 'createContext')
        const result = await callable(payload)
        return result.data.contextId
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not create the context. Please try again.',
        )
        return null
      } finally {
        setLoading(false)
      }
    },
    [formData],
  )

  return {
    formData,
    setField,
    replaceForm,
    relationshipNeeds: formData.relationshipNeeds,
    addNeed,
    updateNeed,
    removeNeed,
    validationState,
    isValid,
    isDirty,
    loading,
    error,
    submit,
  }
}
