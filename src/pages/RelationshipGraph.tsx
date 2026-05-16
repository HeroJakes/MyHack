/**
 * RelationshipGraph — the standalone EcosystemLink view.
 *
 * Renders the user's reusable ecosystem relationships via
 * RelationshipGraphPanel (graph or card view).
 */
import { useEcosystemLinks } from '../hooks/useEcosystemLinks'
import RelationshipGraphPanel from '../components/RelationshipGraphPanel'

export default function RelationshipGraph() {
  const { links, loading, error } = useEcosystemLinks()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Relationship Graph</h1>
      <p className="mt-1 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
        These are reusable ecosystem relationships created from confirmed
        matches.
      </p>

      <div className="mt-5">
        {loading && (
          <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            Loading ecosystem links…
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {!loading && !error && <RelationshipGraphPanel links={links} />}
      </div>
    </div>
  )
}
