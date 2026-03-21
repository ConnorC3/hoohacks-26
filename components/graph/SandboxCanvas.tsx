"use client"

import { useRef, useEffect } from "react"
import CytoscapeComponent from "react-cytoscapejs"
import type { Core, ElementDefinition, Stylesheet } from "cytoscape"
import type { GraphEdge } from "@/lib/supabase/types"
import { SECTOR_COLORS, DEFAULT_SECTOR_COLOR } from "./constants"

export interface CanvasNode {
  ticker: string
  sector: string | null
  name: string
  position: { x: number; y: number }
}

interface Props {
  nodes: CanvasNode[]
  edges: GraphEdge[]
  selectedTicker: string | null
  onNodeClick: (ticker: string | null) => void
  onDrop: (ticker: string, modelPosition: { x: number; y: number }) => void
}

const STYLESHEET: Stylesheet[] = [
  {
    selector: "node",
    style: {
      width: 52,
      height: 52,
      label: "data(label)",
      "font-size": 10,
      "font-weight": "bold",
      "text-valign": "center",
      "text-halign": "center",
      color: "#fff",
      "text-outline-width": 1.5,
      "text-outline-color": "#00000066",
      "background-color": (ele: any) =>
        SECTOR_COLORS[ele.data("sector")] ?? DEFAULT_SECTOR_COLOR,
      "border-width": 2,
      "border-color": "#ffffff22",
    },
  },
  {
    selector: "node:selected",
    style: {
      "border-width": 3,
      "border-color": "#ffffff",
      "background-color": "#6366f1",
      color: "#ffffff",
    },
  },
  {
    selector: "edge",
    style: {
      width: (ele: any) => Math.min(Math.max(ele.data("weight") * 5, 1), 5),
      "line-color": "#475569",
      "target-arrow-color": "#475569",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      opacity: 0.8,
    },
  },
  {
    selector: "edge:selected",
    style: {
      "line-color": "#818cf8",
      "target-arrow-color": "#818cf8",
      opacity: 1,
    },
  },
]

export default function SandboxCanvas({
  nodes,
  edges,
  selectedTicker,
  onNodeClick,
  onDrop,
}: Props) {
  const cyRef = useRef<Core | null>(null)

  // Build elements from props — declarative, survives re-renders
  const elements: ElementDefinition[] = [
    ...nodes.map((n) => ({
      data: { id: n.ticker, label: n.ticker, sector: n.sector ?? "Unknown", name: n.name },
      position: n.position,
    })),
    ...edges
      .filter((e) =>
        nodes.some((n) => n.ticker === e.from_ticker) &&
        nodes.some((n) => n.ticker === e.to_ticker)
      )
      .map((e) => ({
        data: {
          id: `${e.from_ticker}__${e.to_ticker}`,
          source: e.from_ticker,
          target: e.to_ticker,
          weight: e.total_weight,
        },
      })),
  ]

  // Sync selected node
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.elements().unselect()
    if (selectedTicker) cy.getElementById(selectedTicker).select()
  }, [selectedTicker])

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const ticker = e.dataTransfer.getData("ticker")
    if (!ticker || !cyRef.current) return

    const cy = cyRef.current
    const container = cy.container()
    if (!container) return

    const rect = container.getBoundingClientRect()
    const zoom = cy.zoom()
    const pan = cy.pan()
    const modelPosition = {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    }

    onDrop(ticker, modelPosition)
  }

  return (
    <div
      className="w-full h-full relative bg-zinc-950"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <p className="text-zinc-700 text-sm">Drag companies from the sidebar to add them</p>
        </div>
      )}

      <CytoscapeComponent
        elements={elements}
        style={{ width: "100%", height: "100%" }}
        stylesheet={STYLESHEET}
        layout={{ name: "preset" }}
        cy={(cy) => {
          cyRef.current = cy
          cy.removeAllListeners()
          cy.on("tap", "node", (evt) => {
            console.log("[SandboxCanvas] node tapped:", evt.target.id())
            onNodeClick(evt.target.id())
          })
          cy.on("tap", (evt) => {
            if (evt.target === cy) onNodeClick(null)
          })
        }}
      />
    </div>
  )
}
