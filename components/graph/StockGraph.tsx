"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import type { Company, GraphEdge } from "@/lib/supabase/types"
import { getAllCompanies, getLatestPrices, getEdgesBetween } from "@/lib/supabase/queries"
import CompanySidebar from "./CompanySidebar"
import NodeDetailPanel from "./NodeDetailPanel"
import SimulationControls from "@/components/simulation/SimulationControls"
import { useSimulation } from "@/components/simulation/useSimulation"
import ScenarioPanel from "./ScenarioPanel"
import type { PortfolioEntry } from "./NodeDetailPanel"
import type { CanvasNode } from "./SandboxCanvas"

const SandboxCanvas = dynamic(() => import("./SandboxCanvas"), { ssr: false })

export default function StockGraph() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [latestPrices, setLatestPrices] = useState<Record<string, number>>({})
  const [canvasNodes, setCanvasNodes] = useState<CanvasNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const [portfolio, setPortfolio] = useState<Record<string, PortfolioEntry>>({})
  const [error, setError] = useState<string | null>(null)

  const companyMap = useRef<Map<string, Company>>(new Map())
  const addedTickers = new Set(canvasNodes.map((n) => n.ticker))

  const sim = useSimulation(canvasNodes.map((n) => n.ticker))

  // Load all companies + latest prices on mount
  useEffect(() => {
    Promise.all([getAllCompanies(), getLatestPrices()])
      .then(([cos, prices]) => {
        setCompanies(cos)
        setLatestPrices(prices)
        companyMap.current = new Map(cos.map((c) => [c.ticker, c]))
      })
      .catch((e) => setError(e.message))
  }, [])

  // Refresh edges whenever canvas nodes change
  useEffect(() => {
    const tickers = canvasNodes.map((n) => n.ticker)
    if (tickers.length < 2) { setEdges([]); return }
    getEdgesBetween(tickers)
      .then(setEdges)
      .catch((e) => setError(e.message))
  }, [canvasNodes])

  function handleDrop(ticker: string, position: { x: number; y: number }) {
    const company = companyMap.current.get(ticker)
    if (!company || addedTickers.has(ticker)) return
    setCanvasNodes((prev) => [
      ...prev,
      { ticker, sector: company.sector, name: company.name, position },
    ])
  }

  function handleScenarioApply(sectorShocks: Record<string, number>) {
    // Clear all existing shocks so stale values from previous scenarios don't carry over
    for (const node of canvasNodes) sim.setShock(node.ticker, null)
    // Build per-ticker shock map and update UI shock display
    const tickerShocks: Record<string, number> = {}
    for (const node of canvasNodes) {
      const pct = sectorShocks[node.sector ?? ""] ?? 0
      if (pct !== 0) {
        sim.setShock(node.ticker, pct)
        tickerShocks[node.ticker] = pct / 100
      }
    }
    // play() resets all visual state itself before running
    sim.play(tickerShocks)
  }

  function handleScenarioClear() {
    for (const node of canvasNodes) sim.setShock(node.ticker, null)
    sim.reset()
  }

  function handleRemoveNode(ticker: string) {
    setCanvasNodes((prev) => prev.filter((n) => n.ticker !== ticker))
    setPortfolio((prev) => { const next = { ...prev }; delete next[ticker]; return next })
    sim.setShock(ticker, null)
    if (selectedTicker === ticker) setSelectedTicker(null)
  }

  const selectedCompany = companies.find((c) => c.ticker === selectedTicker) ?? null
  const simulationActive = sim.status !== "idle"

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400 text-sm">
        Error: {error}
      </div>
    )
  }

  return (
    <div className="flex h-full bg-zinc-950 overflow-hidden">
      <CompanySidebar companies={companies} addedTickers={addedTickers} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <ScenarioPanel
          canvasNodes={canvasNodes}
          onApply={handleScenarioApply}
          onClear={handleScenarioClear}
        />
        <SimulationControls
          status={sim.status}
          currentHorizon={sim.currentHorizon}
          maxHorizon={sim.maxHorizon}
          speed={sim.speed}
          runToDate={sim.runToDate}
          loading={sim.loading}
          error={sim.error}
          onPlay={() => sim.play()}
          onPause={sim.pause}
          onResume={sim.resume}
          onReset={sim.reset}
          onSpeedChange={sim.setSpeed}
          onRunToDateChange={sim.setRunToDate}
        />

        <div className="flex flex-1 overflow-hidden">
          <SandboxCanvas
            nodes={canvasNodes}
            edges={edges}
            selectedTicker={selectedTicker}
            onNodeClick={setSelectedTicker}
            onDrop={handleDrop}
            impacts={simulationActive ? sim.currentImpacts : {}}
          />
        </div>
      </div>

      <NodeDetailPanel
        company={selectedCompany}
        ticker={selectedTicker}
        latestPrice={selectedTicker ? latestPrices[selectedTicker] ?? null : null}
        portfolio={selectedTicker ? portfolio[selectedTicker] ?? { shares: "", costBasis: "", purchaseDate: "", notes: "" } : null}
        onPortfolioChange={(entry) => {
          if (selectedTicker) setPortfolio((prev) => ({ ...prev, [selectedTicker]: entry }))
        }}
        onRemove={() => { if (selectedTicker) handleRemoveNode(selectedTicker) }}
        shock={selectedTicker && sim.shocks[selectedTicker] != null ? sim.shocks[selectedTicker] * 100 : null}
        onShockChange={(pct) => { if (selectedTicker) sim.setShock(selectedTicker, pct) }}
        simulatedImpact={selectedTicker && simulationActive ? sim.currentImpacts[selectedTicker] ?? null : null}
        simulationActive={simulationActive}
      />
    </div>
  )
}
