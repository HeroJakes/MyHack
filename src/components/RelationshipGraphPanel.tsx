/**
 * RelationshipGraphPanel — D3 force-directed graph of ecosystem links.
 *
 * Actors become nodes (sized by how many links touch them, coloured by actor
 * type); links become edges (coloured by relationship type, dashed by status,
 * with a dot travelling along each one). Supports zoom/pan and node drag.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as d3 from 'd3'
import type { ResolvedEcosystemLink } from '../hooks/useEcosystemLinks'
import { Info, Share2 } from './icons'

interface RelationshipGraphPanelProps {
  links: ResolvedEcosystemLink[]
  isLoading: boolean
  onNodeClick?: (userId: string, userName: string) => void
  /** Optional header link, e.g. "View full graph" on the dashboard. */
  actionLabel?: string
  actionHref?: string
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  name: string
  role: string
  type: string
  linkCount: number
}

interface GraphEdge extends d3.SimulationLinkDatum<GraphNode> {
  relationshipType: string
  confidence: number
  status: string
}

interface TooltipState {
  x: number
  y: number
  name: string
  role: string
  linkCount: number
}

const HEIGHT = 260

const RELATIONSHIP_COLOR: Record<string, string> = {
  mentor_match: '#7C3AED',
  partner_linkage: '#EA580C',
  service_support: '#0891B2',
  programme_fit: '#16A34A',
  participant_orchestration: '#6B7280',
}

const RELATIONSHIP_LABEL: Record<string, string> = {
  mentor_match: 'Mentor Match',
  partner_linkage: 'Partner Linkage',
  service_support: 'Service Support',
  programme_fit: 'Programme Fit',
  participant_orchestration: 'Participant Orchestration',
}

/** Colour for an actor node, tolerant of "Programme Admin" / "ProgrammeAdmin". */
function actorColor(type: string): string {
  const normalized = type.toLowerCase().replace(/[^a-z]/g, '')
  if (normalized === 'mentor' || normalized === 'programmeadmin') return '#7C3AED'
  if (normalized === 'partner') return '#EA580C'
  if (normalized === 'company' || normalized === 'startupcompany') return '#16A34A'
  if (normalized === 'serviceprovider') return '#0891B2'
  return '#6B7280'
}

/** Two-letter initials from the first and last word of a name. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/** Builds fresh node/edge arrays (d3 mutates them in place). */
function buildGraph(links: ResolvedEcosystemLink[]) {
  const nodeMap = new Map<string, GraphNode>()
  const register = (id: string, name: string, role: string, type: string) => {
    const existing = nodeMap.get(id)
    if (existing) {
      existing.linkCount += 1
      return
    }
    nodeMap.set(id, { id, name, role, type, linkCount: 1 })
  }
  for (const link of links) {
    register(link.sourceUserId, link.sourceUserName, link.sourceUserRole, link.sourceType)
    register(link.targetUserId, link.targetUserName, link.targetUserRole, link.targetType)
  }
  const edges: GraphEdge[] = links.map((link) => ({
    source: link.sourceUserId,
    target: link.targetUserId,
    relationshipType: link.relationshipType,
    confidence: link.confidence,
    status: link.status,
  }))
  return { nodes: [...nodeMap.values()], edges }
}

function nodeRadius(node: GraphNode): number {
  return Math.max(20, Math.min(40, 16 + node.linkCount * 4))
}

export default function RelationshipGraphPanel({
  links,
  isLoading,
  onNodeClick,
  actionLabel,
  actionHref,
}: RelationshipGraphPanelProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const onNodeClickRef = useRef(onNodeClick)
  onNodeClickRef.current = onNodeClick

  const [width, setWidth] = useState(0)
  const [legendVisible, setLegendVisible] = useState(true)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const meta = useMemo(() => {
    const { nodes, edges } = buildGraph(links)
    const typesPresent = [...new Set(edges.map((edge) => edge.relationshipType))]
    return { nodeCount: nodes.length, edgeCount: edges.length, typesPresent }
  }, [links])

  // Track the container width so the simulation can centre itself.
  useEffect(() => {
    const element = wrapperRef.current
    if (!element) return
    setWidth(element.clientWidth)
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Build (and tear down) the D3 force simulation.
  useEffect(() => {
    const svgElement = svgRef.current
    if (!svgElement || width === 0 || isLoading || links.length === 0) return

    const { nodes, edges } = buildGraph(links)
    const svg = d3.select(svgElement)
    svg.selectAll('*').remove()
    const root = svg.append('g')

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 2.5])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        root.attr('transform', event.transform.toString())
      })
    svg.call(zoom)

    const edgeSelection = root
      .append('g')
      .selectAll<SVGLineElement, GraphEdge>('line')
      .data(edges)
      .join('line')
      .attr('stroke', (d) => RELATIONSHIP_COLOR[d.relationshipType] ?? '#6B7280')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6)
      .attr('stroke-dasharray', (d) =>
        d.status === 'invited' ? '4,3' : d.status === 'completed' ? '2,2' : '',
      )

    const dotSelection = root
      .append('g')
      .selectAll<SVGCircleElement, GraphEdge>('circle')
      .data(edges)
      .join('circle')
      .attr('r', 3)
      .attr('fill', (d) => RELATIONSHIP_COLOR[d.relationshipType] ?? '#6B7280')

    const nodeSelection = root
      .append('g')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')

    nodeSelection
      .append('circle')
      .attr('r', nodeRadius)
      .attr('fill', (d) => actorColor(d.type))
      .attr('fill-opacity', 0.2)
      .attr('stroke', (d) => actorColor(d.type))
      .attr('stroke-width', 2)

    nodeSelection
      .append('text')
      .text((d) => initials(d.name))
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('font-size', 12)
      .attr('font-weight', 700)
      .attr('fill', (d) => actorColor(d.type))

    nodeSelection
      .on('mouseenter mousemove', (event: PointerEvent, d) => {
        const [px, py] = d3.pointer(event, svgElement)
        setTooltip({ x: px, y: py, name: d.name, role: d.role, linkCount: d.linkCount })
      })
      .on('mouseleave', () => setTooltip(null))
      .on('click', (_event, d) => onNodeClickRef.current?.(d.id, d.name))

    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphEdge>(edges)
          .id((d) => d.id)
          .distance(120),
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, HEIGHT / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius(40))

    simulation.on('tick', () => {
      edgeSelection
        .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as GraphNode).y ?? 0)
      nodeSelection.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    nodeSelection.call(
      d3
        .drag<SVGGElement, GraphNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        }),
    )

    // Continuous timer so the edge dots keep travelling after the layout cools.
    const ticker = d3.timer((elapsed) => {
      const t = (elapsed % 2400) / 2400
      dotSelection
        .attr('cx', (d) => {
          const source = d.source as GraphNode
          const target = d.target as GraphNode
          return (source.x ?? 0) + ((target.x ?? 0) - (source.x ?? 0)) * t
        })
        .attr('cy', (d) => {
          const source = d.source as GraphNode
          const target = d.target as GraphNode
          return (source.y ?? 0) + ((target.y ?? 0) - (source.y ?? 0)) * t
        })
    })

    return () => {
      simulation.stop()
      ticker.stop()
      svg.on('.zoom', null)
    }
  }, [links, width, isLoading])

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h2 className="text-base font-bold text-gray-900">
            Ecosystem Relationship Graph
          </h2>
          <span
            title="Each line represents a confirmed ecosystem link between actors."
            className="inline-flex"
          >
            <Info className="h-4 w-4 text-gray-400" />
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
            {meta.nodeCount} actors · {meta.edgeCount} links
          </span>
          <button
            type="button"
            onClick={() => setLegendVisible((visible) => !visible)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
            aria-pressed={legendVisible}
          >
            Legend
          </button>
          {actionLabel && actionHref && (
            <Link
              to={actionHref}
              className="text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700"
            >
              {actionLabel} →
            </Link>
          )}
        </div>
      </div>

      <div ref={wrapperRef} className="relative mt-3">
        {isLoading ? (
          <div className="flex h-[260px] flex-col items-center justify-center gap-3 text-gray-400">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
            <p className="text-sm">Loading relationship graph...</p>
          </div>
        ) : links.length === 0 ? (
          <div className="flex h-[260px] flex-col items-center justify-center gap-3 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-gray-100 text-gray-400">
              <Share2 className="h-7 w-7" />
            </div>
            <p className="max-w-xs text-sm text-gray-500">
              No ecosystem links yet. Accept an invite to create the first link.
            </p>
          </div>
        ) : (
          <svg
            ref={svgRef}
            width="100%"
            height={HEIGHT}
            viewBox={`0 0 ${width || 100} ${HEIGHT}`}
            preserveAspectRatio="xMidYMid meet"
            className="touch-none select-none"
            role="img"
            aria-label="Force-directed graph of ecosystem relationships"
          />
        )}

        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
            style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
          >
            <p className="font-semibold">{tooltip.name}</p>
            {tooltip.role && <p className="text-gray-300">{tooltip.role}</p>}
            <p className="text-gray-400">
              {tooltip.linkCount} link{tooltip.linkCount === 1 ? '' : 's'}
            </p>
          </div>
        )}
      </div>

      {legendVisible && links.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-3">
          {meta.typesPresent.map((type) => (
            <span
              key={type}
              className="flex items-center gap-1.5 text-xs text-gray-600"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: RELATIONSHIP_COLOR[type] ?? '#6B7280' }}
              />
              {RELATIONSHIP_LABEL[type] ?? type}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
