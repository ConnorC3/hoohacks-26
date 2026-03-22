"use client"

import { useRef, useEffect, useState, useMemo } from "react"
import CytoscapeComponent from "react-cytoscapejs"
import type { Core, ElementDefinition, StylesheetCSS as Stylesheet } from "cytoscape"
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
  impacts?: Record<string, number>  // ticker → decimal impact (e.g. -0.05 = -5%)
  showWeights?: boolean
}


function impactColor(impact: number, sectorColor: string): string {
  const magnitude = Math.min(Math.abs(impact) * 8, 1)
  if (Math.abs(impact) < 0.001) return sectorColor
  return impact > 0
    ? `rgba(0, 255, 135, ${0.5 + magnitude * 0.5})`    // accent-green
    : `rgba(255, 51, 102, ${0.5 + magnitude * 0.5})`   // accent-red
}

export default function SandboxCanvas({
  nodes,
  edges,
  selectedTicker,
  onNodeClick,
  onDrop,
  impacts = {},
  showWeights = false,
}: Props) {
  const cyRef = useRef<Core | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const stylesheet = useMemo((): Stylesheet[] => [
    {
      selector: "node",
      style: {
        width: 52,
        height: 52,
        label: "data(label)",
        "font-size": 10,
        "font-family": "var(--font-geist-mono), monospace",
        "font-weight": "bold",
        "text-valign": "center",
        "text-halign": "center",
        color: "#f0f0f5",
        "text-outline-width": 2,
        "text-outline-color": "#0a0a0f",
        "text-outline-opacity": 0.8,
        "background-color": (ele: any) => ele.data("impactColor") ?? DEFAULT_SECTOR_COLOR,
        "background-opacity": 0.85,
        "border-width": 1.5,
        "border-color": "rgba(255, 255, 255, 0.12)",
        "overlay-padding": 6,
        "overlay-opacity": 0,
        "shadow-blur": 15,
        "shadow-color": (ele: any) => ele.data("impactColor") ?? DEFAULT_SECTOR_COLOR,
        "shadow-opacity": 0.4,
        "shadow-offset-x": 0,
        "shadow-offset-y": 0,
      },
    },
    {
      selector: "node:selected",
      style: {
        "border-width": 2,
        "border-color": "#7b61ff",
        "background-color": "#7b61ff",
        "shadow-color": "#7b61ff",
        "shadow-opacity": 0.6,
        "shadow-blur": 25,
        color: "#ffffff",
      },
    },
    {
      selector: "edge",
      style: {
        width: (ele: any) => Math.min(Math.max(ele.data("weight") * 5, 0.8), 4),
        "line-color": (ele: any) =>
          ele.data("edgeSign") === "positive" ? "rgba(0, 200, 120, 0.55)"
          : ele.data("edgeSign") === "negative" ? "rgba(255, 70, 100, 0.55)"
          : "#2a2a3f",
        "target-arrow-color": (ele: any) =>
          ele.data("edgeSign") === "positive" ? "rgba(0, 200, 120, 0.55)"
          : ele.data("edgeSign") === "negative" ? "rgba(255, 70, 100, 0.55)"
          : "#2a2a3f",
        "target-arrow-shape": "triangle",
        "arrow-scale": 0.8,
        "curve-style": "bezier",
        opacity: (ele: any) => ele.data("weight") === 0 ? 0.15 : 0.5,
        "line-style": (ele: any) => ele.data("weight") === 0 ? "dashed" : "solid",
        label: showWeights ? "data(weightLabel)" : "",
        "font-size": 9,
        "font-family": "var(--font-geist-mono), monospace",
        color: (ele: any) =>
          ele.data("edgeSign") === "positive" ? "rgba(0, 255, 135, 0.85)"
          : ele.data("edgeSign") === "negative" ? "rgba(255, 100, 130, 0.85)"
          : "rgba(255,255,255,0.65)",
        "text-background-color": "#0d0d18",
        "text-background-opacity": showWeights ? 0.85 : 0,
        "text-background-padding": "2px",
        "text-background-shape": "roundrectangle",
      },
    },
    {
      selector: "edge:selected",
      style: {
        "line-color": "#7b61ff",
        "target-arrow-color": "#7b61ff",
        opacity: 0.9,
        width: (ele: any) => Math.min(Math.max(ele.data("weight") * 5, 1.5), 5),
      },
    },
  ], [showWeights])

  // Build elements from props — declarative, survives re-renders
  const elements: ElementDefinition[] = [
    ...nodes.map((n) => ({
      data: {
        id: n.ticker,
        label: n.ticker,
        sector: n.sector ?? "Unknown",
        name: n.name,
        impact: impacts[n.ticker] ?? 0,
        impactColor: impactColor(impacts[n.ticker] ?? 0, SECTOR_COLORS[n.sector ?? ""] ?? DEFAULT_SECTOR_COLOR),
      },
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
          weight: Math.abs(e.net_weight),
          weightLabel: (e.net_weight >= 0 ? "+" : "") + e.net_weight.toFixed(3),
          edgeSign: e.net_weight >= 0 ? "positive" : "negative",
        },
      })),
  ]

  // Imperatively sync impact colors — react-cytoscapejs doesn't diff existing node data
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.batch(() => {
      for (const node of nodes) {
        const impact = impacts[node.ticker] ?? 0
        const color = impactColor(impact, SECTOR_COLORS[node.sector ?? ""] ?? DEFAULT_SECTOR_COLOR)
        const ele = cy.getElementById(node.ticker)
        if (ele.length > 0) ele.data("impactColor", color)
      }
    })
  }, [impacts, nodes])

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
    setIsDragOver(true)
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
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
      className={`w-full h-full relative dot-grid-bg transition-all duration-300 ${
        isDragOver ? 'ring-1 ring-inset' : ''
      }`}
      style={{
        ...(isDragOver ? {
          ringColor: 'var(--accent-purple)',
          boxShadow: 'inset 0 0 60px rgba(123, 97, 255, 0.06)',
          animation: 'drop-zone-pulse 2s ease-in-out infinite',
        } : {}),
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none gap-4"
          style={{ animation: 'fade-in-up 0.5s ease-out' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: 'rgba(123, 97, 255, 0.08)',
              border: '1px solid rgba(123, 97, 255, 0.15)',
              animation: 'float 4s ease-in-out infinite',
            }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-purple)' }}>
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>
              <path d="m4.93 4.93 2.83 2.83m8.48 8.48 2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83"/>
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Build your portfolio graph
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Drag companies from the sidebar to visualize correlations
            </p>
          </div>
        </div>
      )}

      <CytoscapeComponent
        elements={elements}
        style={{ width: "100%", height: "100%" }}
        stylesheet={stylesheet}
        layout={{ name: "preset" }}
        cy={(cy) => {
          cyRef.current = cy
          cy.removeAllListeners()
          cy.on("tap", "node", (evt) => {
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
