"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import type { Company, GraphEdge } from "@/lib/supabase/types"
import { getAllCompanies, getLatestPrices, getEdgesBetween } from "@/lib/supabase/queries"
import CompanySidebar from "./CompanySidebar"
import NodeDetailPanel from "./NodeDetailPanel"
import SimulationControls from "@/components/simulation/SimulationControls"
import SimulationModal from "@/components/simulation/SimulationModal"
import { useSimulation } from "@/components/simulation/useSimulation"
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
  const [showSimModal, setShowSimModal] = useState(false)
  const [showWeights, setShowWeights] = useState(false)

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
      <div className="flex items-center justify-center h-full text-sm"
        style={{ color: 'var(--accent-red)', background: 'var(--base)' }}>
        Error: {error}
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--base)' }}>
      <CompanySidebar companies={companies} addedTickers={addedTickers} />

      {/* Left separator */}
      <div className="panel-separator" />

      <div className="flex flex-col flex-1 overflow-hidden">
        <SimulationControls
          status={sim.status}
          currentHorizon={sim.currentHorizon}
          maxHorizon={sim.maxHorizon}
          speed={sim.speed}
          runToDate={sim.runToDate}
          loading={sim.loading}
          error={sim.error}
          onPlay={sim.play}
          onPause={sim.pause}
          onResume={sim.resume}
          onReset={sim.reset}
          onSpeedChange={sim.setSpeed}
          onRunToDateChange={sim.setRunToDate}
          impactedCount={Object.keys(sim.currentImpacts).filter((t) => Math.abs(sim.currentImpacts[t]) > 0.001).length}
          onViewResults={() => setShowSimModal(true)}
          showWeights={showWeights}
          onToggleWeights={() => setShowWeights((v) => !v)}
        />

        <div className="flex flex-1 overflow-hidden">
          <SandboxCanvas
            nodes={canvasNodes}
            edges={edges}
            selectedTicker={selectedTicker}
            onNodeClick={setSelectedTicker}
            onDrop={handleDrop}
            impacts={simulationActive ? sim.currentImpacts : {}}
            showWeights={showWeights}
          />
        </div>
      </div>

      {/* Right separator */}
      <div className="panel-separator" />

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

      <SimulationModal
        open={showSimModal}
        onClose={() => setShowSimModal(false)}
        impacts={sim.currentImpacts}
        shocks={sim.shocks}
        canvasNodes={canvasNodes}
        portfolio={portfolio}
        latestPrices={latestPrices}
      />
    </div>
  )
}
