"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import type { Company, GraphEdge } from "@/lib/supabase/types"
import { getAllCompanies, getLatestPrices, getEdgesBetween, getPriceHistory } from "@/lib/supabase/queries"
import CompanySidebar from "./CompanySidebar"
import NodeDetailPanel from "./NodeDetailPanel"
import SimulationControls from "@/components/simulation/SimulationControls"
import SimulationModal from "@/components/simulation/SimulationModal"
import RiskModal from "@/components/simulation/RiskModal"
import { useSimulation } from "@/components/simulation/useSimulation"
import ScenarioPanel from "./ScenarioPanel"
import type { PortfolioEntry } from "./NodeDetailPanel"
import type { CanvasNode } from "./SandboxCanvas"

const SandboxCanvas = dynamic(() => import("./SandboxCanvas"), { ssr: false })

interface PricePoint {
  date: string
  price: number
}

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
  const [showRiskModal, setShowRiskModal] = useState(false)
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([])

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

  // Refresh edges whenever canvas nodes change — fill missing pairs with weight 0
  useEffect(() => {
    const tickers = canvasNodes.map((n) => n.ticker)
    if (tickers.length < 2) { setEdges([]); return }
    getEdgesBetween(tickers)
      .then((dbEdges) => {
        const edgeSet = new Set(dbEdges.map((e) => `${e.from_ticker}__${e.to_ticker}`))
        const zeroEdges: GraphEdge[] = []
        for (const a of tickers) {
          for (const b of tickers) {
            if (a === b) continue
            if (!edgeSet.has(`${a}__${b}`)) {
              zeroEdges.push({ from_ticker: a, to_ticker: b, total_weight: 0, net_weight: 0, min_p_value: null })
            }
          }
        }
        setEdges([...dbEdges, ...zeroEdges])
      })
      .catch((e) => setError(e.message))
  }, [canvasNodes])

  // Fetch price history when a ticker is selected
  useEffect(() => {
    if (!selectedTicker) { setPriceHistory([]); return }
    getPriceHistory(selectedTicker)
      .then((rows) => {
        setPriceHistory(
          rows
            .filter((r) => r.adj_close !== null)
            .map((r) => ({ date: r.date, price: r.adj_close as number }))
        )
      })
      .catch(() => setPriceHistory([]))
  }, [selectedTicker])

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

  function handleClearCanvas() {
    for (const node of canvasNodes) sim.setShock(node.ticker, null)
    sim.reset()
    setCanvasNodes([])
    setPortfolio({})
    setSelectedTicker(null)
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
        <ScenarioPanel
          canvasNodes={canvasNodes}
          onApply={handleScenarioApply}
          onClear={handleScenarioClear}
        />
        <SimulationControls
          status={sim.status}
          loading={sim.loading}
          error={sim.error}
          onPlay={() => sim.play()}
          onReset={sim.reset}
          impactedCount={Object.keys(sim.currentImpacts).filter((t) => Math.abs(sim.currentImpacts[t]) > 0.001).length}
          onViewResults={() => setShowSimModal(true)}
          showWeights={showWeights}
          onToggleWeights={() => setShowWeights((v) => !v)}
          onRiskAnalysis={() => setShowRiskModal((v) => !v)}
          hasPortfolio={Object.values(portfolio).some((e) => parseFloat(e.shares) > 0)}
          onClearCanvas={handleClearCanvas}
          canvasEmpty={canvasNodes.length === 0}
          riskModalOpen={showRiskModal}
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
        priceHistory={priceHistory}
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

      <RiskModal
        isOpen={showRiskModal}
        onClose={() => setShowRiskModal(false)}
        canvasNodes={canvasNodes}
        portfolio={portfolio}
        latestPrices={latestPrices}
        edges={edges}
      />
    </div>
  )
}
