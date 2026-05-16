/**
 * RelationshipGraph — standalone view of the ecosystem relationship graph.
 *
 * Renders the live D3 `RelationshipGraphPanel`. The full link table and
 * detail panel live on the richer `/ecosystem-links` page.
 */
import { useEcosystemLinks } from '../hooks/useEcosystemLinks'
import RelationshipGraphPanel from '../components/RelationshipGraphPanel'

export default function RelationshipGraph() {
  const { links, isLoading, error } = useEcosystemLinks()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Relationship Graph</h1>
      <p className="mt-1 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
        These are reusable ecosystem relationships created from confirmed
        matches.
      </p>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-5">
        <RelationshipGraphPanel links={links} isLoading={isLoading} />
      </div>
    </div>
  )
}
