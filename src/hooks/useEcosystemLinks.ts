/**
 * useEcosystemLinks — live `ecosystemLinks` joined with `users`.
 *
 * The `ecosystemLinks` documents store only actor *ids*, so this hook also
 * listens to the `users` collection and resolves each id to a name, role and
 * photo. The result is a `ResolvedEcosystemLink[]` the UI can render directly.
 *
 * Reading every link requires the relaxed `ecosystemLinks` read rule (any
 * authenticated user) — see `firestore.rules`.
 */
import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../lib/firebase'
import type { EcosystemLinkStatus, RelationshipType } from '../types'

/** An ecosystem link with its actor ids resolved to display fields. */
export interface ResolvedEcosystemLink {
  id: string
  sourceUserId: string
  sourceUserName: string
  sourceUserRole: string
  sourceUserPhoto: string
  targetUserId: string
  targetUserName: string
  targetUserRole: string
  targetUserPhoto: string
  contextId: string
  contextName: string
  contextType: string
  field: string
  sourceType: string
  targetType: string
  relationshipType: RelationshipType
  assignedRole: string
  aiReason: string
  confidence: number
  riskFlags: string[]
  status: EcosystemLinkStatus
  outcomeScore?: number
  feedbackSummary?: string
  reusableTags: string[]
  createdFromInviteId: string
  createdAt: Date
  updatedAt: Date
}

interface UserLite {
  name: string
  role: string
  photo: string
}

type RawDoc = { id: string } & Record<string, unknown>

/** Coerces a Firestore Timestamp (or plain value) to a JS Date. */
function toDate(value: unknown): Date {
  if (!value) return new Date()
  const ts = value as { toDate?: () => Date; seconds?: number }
  if (typeof ts.toDate === 'function') return ts.toDate()
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000)
  return new Date()
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

export function useEcosystemLinks() {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.uid
  const [rawLinks, setRawLinks] = useState<RawDoc[]>([])
  const [users, setUsers] = useState<Map<string, UserLite>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) {
      setIsLoading(true)
      return
    }

    if (!userId) {
      setRawLinks([])
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    const sourceLinks = new Map<string, RawDoc>()
    const targetLinks = new Map<string, RawDoc>()
    const loaded = { source: false, target: false }
    const updateLinks = () => {
      if (!loaded.source || !loaded.target) return
      const byId = new Map([...sourceLinks, ...targetLinks])
      setRawLinks(
        [...byId.values()].sort(
          (a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime(),
        ),
      )
      setIsLoading(false)
    }

    const makeLinksQuery = (field: 'sourceUserId' | 'targetUserId') =>
      query(
        collection(db, 'ecosystemLinks'),
        where(field, '==', userId),
      )

    const unsubSourceLinks = onSnapshot(
      makeLinksQuery('sourceUserId'),
      (snap) => {
        sourceLinks.clear()
        for (const d of snap.docs) sourceLinks.set(d.id, { id: d.id, ...d.data() })
        loaded.source = true
        setError(null)
        updateLinks()
      },
      (err) => {
        console.error('useEcosystemLinks (source links) error:', err)
        loaded.source = true
        setError(err.message)
        setIsLoading(false)
      },
    )

    const unsubTargetLinks = onSnapshot(
      makeLinksQuery('targetUserId'),
      (snap) => {
        targetLinks.clear()
        for (const d of snap.docs) targetLinks.set(d.id, { id: d.id, ...d.data() })
        loaded.target = true
        setError(null)
        updateLinks()
      },
      (err) => {
        console.error('useEcosystemLinks (target links) error:', err)
        loaded.target = true
        setError(err.message)
        setIsLoading(false)
      },
    )

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const map = new Map<string, UserLite>()
        snap.docs.forEach((d) => {
          const data = d.data()
          map.set(d.id, {
            name: asString(data.name, d.id),
            role: asString(data.headline),
            photo: asString(data.photoURL),
          })
        })
        setUsers(map)
      },
      (err) => {
        // Non-fatal: links still render with ids if user resolution fails.
        console.error('useEcosystemLinks (users) error:', err)
      },
    )

    return () => {
      unsubSourceLinks()
      unsubTargetLinks()
      unsubUsers()
    }
  }, [authLoading, userId])

  const links = useMemo<ResolvedEcosystemLink[]>(() => {
    return rawLinks.map((raw) => {
      const sourceUserId = asString(raw.sourceUserId)
      const targetUserId = asString(raw.targetUserId)
      const sourceType = asString(raw.sourceType)
      const targetType = asString(raw.targetType)
      const sourceUser = users.get(sourceUserId)
      const targetUser = users.get(targetUserId)

      return {
        id: raw.id,
        sourceUserId,
        sourceUserName: sourceUser?.name ?? sourceUserId,
        sourceUserRole: sourceUser?.role || sourceType,
        sourceUserPhoto: sourceUser?.photo ?? '',
        targetUserId,
        targetUserName: targetUser?.name ?? targetUserId,
        targetUserRole: targetUser?.role || targetType,
        targetUserPhoto: targetUser?.photo ?? '',
        contextId: asString(raw.contextId),
        contextName: asString(raw.contextName),
        contextType: asString(raw.contextType),
        field: asString(raw.field),
        sourceType,
        targetType,
        relationshipType: asString(raw.relationshipType, 'mentor_match') as RelationshipType,
        assignedRole: asString(raw.assignedRole),
        aiReason: asString(raw.aiReason),
        confidence: typeof raw.confidence === 'number' ? raw.confidence : 0,
        riskFlags: asStringArray(raw.riskFlags),
        status: asString(raw.status, 'suggested') as EcosystemLinkStatus,
        outcomeScore:
          typeof raw.outcomeScore === 'number' ? raw.outcomeScore : undefined,
        feedbackSummary:
          typeof raw.feedbackSummary === 'string' ? raw.feedbackSummary : undefined,
        reusableTags: asStringArray(raw.reusableTags),
        createdFromInviteId: asString(raw.createdFromInviteId),
        createdAt: toDate(raw.createdAt),
        updatedAt: toDate(raw.updatedAt),
      }
    })
  }, [rawLinks, users])

  return { links, isLoading, error }
}
