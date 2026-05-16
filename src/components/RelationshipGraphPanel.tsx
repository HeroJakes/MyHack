/**
 * RelationshipGraphPanel — visualizes EcosystemLink[] two ways:
 *
 *  - "Graph": a d3 force-directed node-link diagram (actors as nodes,
 *    links as edges).
 *  - "Cards": a flat list of EcosystemLinkCard.
 *
 * The d3 simulation is recreated whenever the links change and is torn down
 * on unmount / view switch.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import EcosystemLinkCard from './EcosystemLinkCard'
import type { EcosystemLink } from '../types'

interface RelationshipGraphPanelProps {
  links: EcosystemLink[]
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string
}

interface GraphEdge extends d3.SimulationLinkDatum<GraphNode> {
  type: string
}

type View = 'graph' | 'cards'

const WIDTH = 640
const HEIGHT = 420

export default function RelationshipGraphPanel({
  links,
}: RelationshipGraphPanelProps) {
  const [view, setView] = useState<View>('graph')
  const svgRef = useRef<SVGSVGElement | null>(null)

  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, GraphNode>()
    for (const link of links) {
      if (!nodeMap.has(link.sourceUserId)) {
        nodeMap.set(link.sourceUserId, { id: link.sourceUserId })
      }
      if (!nodeMap.has(link.targetUserId)) {
        nodeMap.set(link.targetUserId, { id: link.targetUserId })
      }
    }
    return {
      nodes: [...nodeMap.values()],
      edges: links.map<GraphEdge>((link) => ({
        source: link.sourceUserId,
        target: link.targetUserId,
        type: link.relationshipType,
      })),
    }
  }, [links])

  useEffect(() => {
    if (view !== 'graph' || !svgRef.current || nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphEdge>(edges)
          .id((d) => d.id)
          .distance(120),
      )
      .force('charge', d3.forceManyBody().strength(-320))
      .force('center', d3.forceCenter(WIDTH / 2, HEIGHT / 2))
      .force('collide', d3.forceCollide(36))

    const edgeSelection = svg
      .append('g')
      .attr('stroke', '#cbd5e1')
      .attr('stroke-width', 2)
      .selectAll('line')
      .data(edges)
      .join('line')

    const nodeGroup = svg
      .append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(
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

    nodeGroup
      .append('circle')
      .attr('r', 22)
      .attr('fill', '#2563eb')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)

    nodeGroup
      .append('text')
      .text((d) => d.id.replace(/^user-/, ''))
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('fill', '#fff')
      .attr('font-size', 10)
      .attr('font-weight', 600)

    simulation.on('tick', () => {
      edgeSelection
        .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as GraphNode).y ?? 0)
      nodeGroup.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => {
      simulation.stop()
    }
  }, [view, nodes, edges])

  return (
    <div>
      <div className="mb-3 inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
        {(['graph', 'cards'] as View[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setView(option)}
            className={`rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors ${
              view === option
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {links.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
          No ecosystem links yet. Confirmed matches will appear here.
        </p>
      ) : view === 'graph' ? (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="h-[420px] w-full"
            role="img"
            aria-label="Ecosystem relationship graph"
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {links.map((link) => (
            <EcosystemLinkCard key={link.id} link={link} />
          ))}
        </div>
      )}
    </div>
  )
}
