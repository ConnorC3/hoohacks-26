"use client"

import { useRef, useEffect } from "react"
import CytoscapeComponent from "react-cytoscapejs"
import type { Core, ElementDefinition, Stylesheet } from "cytoscape"
import type { GraphNode, GraphEdge } from "@/lib/supabase/types"
import { SECTOR_COLORS, DEFAULT_SECTOR_COLOR } from "./constants"

interface Props {
  nodes: GraphNode[]
  edges: GraphEdge[]
  selectedTicker: string | null
  onNodeClick: (ticker: string) => void
}

function buildElements(nodes: GraphNode[], edges: GraphEdge[]): ElementDefinition[] {
  const nodeEls: ElementDefinition[] = nodes.map((n) => ({
    data: {
      id: n.ticker,
      label: n.ticker,
      sector: n.sector ?? "Unknown",
      name: n.name,
    },
  }))

  const edgeEls: ElementDefinition[] = edges.map((e) => ({
    data: {
      id: `${e.from_ticker}__${e.to_ticker}`,
      source: e.from_ticker,
      target: e.to_ticker,
      weight: e.total_weight,
    },
  }))

  return [...nodeEls, ...edgeEls]
}

const STYLESHEET: Stylesheet[] = [
  {
    selector: "node",
    style: {
      width: 28,
      height: 28,
      label: "data(label)",
      "font-size": 8,
      "text-valign": "center",
      "text-halign": "center",
      color: "#fff",
      "text-outline-width": 1,
      "text-outline-color": "#00000055",
      "background-color": (ele: any) =>
        SECTOR_COLORS[ele.data("sector")] ?? DEFAULT_SECTOR_COLOR,
      "border-width": 0,
    },
  },
  {
    selector: "node:selected",
    style: {
      "border-width": 3,
      "border-color": "#ffffff",
      "background-color": "#ffffff",
      color: "#000000",
      "text-outline-color": "#ffffff",
    },
  },
  {
    selector: "edge",
    style: {
      width: (ele: any) => Math.min(Math.max(ele.data("weight") * 4, 0.5), 4),
      "line-color": "#334155",
      "target-arrow-color": "#334155",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      opacity: 0.6,
    },
  },
  {
    selector: "edge:selected",
    style: {
      "line-color": "#6366f1",
      "target-arrow-color": "#6366f1",
      opacity: 1,
    },
  },
]

const LAYOUT = {
  name: "cose",
  animate: false,
  randomize: true,
  nodeRepulsion: 400000,
  idealEdgeLength: 80,
  edgeElasticity: 0.1,
  numIter: 1000,
}

export default function GraphCanvas({ nodes, edges, selectedTicker, onNodeClick }: Props) {
  const cyRef = useRef<Core | null>(null)

  // Sync selected node into Cytoscape when it changes externally
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.elements().unselect()
    if (selectedTicker) {
      cy.getElementById(selectedTicker).select()
    }
  }, [selectedTicker])

  const elements = buildElements(nodes, edges)

  return (
    <CytoscapeComponent
      elements={elements}
      style={{ width: "100%", height: "100%" }}
      stylesheet={STYLESHEET}
      layout={LAYOUT}
      cy={(cy) => {
        cyRef.current = cy
        cy.on("tap", "node", (evt) => {
          onNodeClick(evt.target.id())
        })
        // Deselect on background tap
        cy.on("tap", (evt) => {
          if (evt.target === cy) onNodeClick("")
        })
      }}
    />
  )
}
