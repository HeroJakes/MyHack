/**
 * Real-time listener for `ecosystemLinks`.
 *
 * The security rules expose a link to its two actors only, so this hook runs
 * two listeners — one where the user is the source, one where they are the
 * target — and merges the results, deduped by id and sorted newest-first.
 */
import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import type { EcosystemLink } from '../types'

function toMillis(value: unknown): number {
  if (!value) return 0
  const ts = value as { toMillis?: () => number; seconds?: number }
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  return 0
}

export function useEcosystemLinks() {
  const { user } = useAuth()
  const [asSource, setAsSource] = useState<EcosystemLink[]>([])
  const [asTarget, setAsTarget] = useState<EcosystemLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) {
      setAsSource([])
      setAsTarget([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    const linksCol = collection(db, 'ecosystemLinks')

    const mapDocs = (snap: { docs: Array<{ id: string; data: () => unknown }> }) =>
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as EcosystemLink)

    const unsubSource = onSnapshot(
      query(linksCol, where('sourceUserId', '==', user.uid)),
      (snap) => {
        setAsSource(mapDocs(snap))
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )

    const unsubTarget = onSnapshot(
      query(linksCol, where('targetUserId', '==', user.uid)),
      (snap) => {
        setAsTarget(mapDocs(snap))
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )

    return () => {
      unsubSource()
      unsubTarget()
    }
  }, [user])

  const links = useMemo(() => {
    const byId = new Map<string, EcosystemLink>()
    for (const link of [...asSource, ...asTarget]) {
      byId.set(link.id, link)
    }
    return [...byId.values()].sort(
      (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt),
    )
  }, [asSource, asTarget])

  return { links, loading, error }
}
