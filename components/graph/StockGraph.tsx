"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"

import type { Company, GraphEdge } from "@/lib/supabase/types"
import { getAllCompanies, getLatestPrices, getEdgesBetween } from "@/lib/supabase/queries"
import CompanySidebar from "./CompanySidebar"
import type { PortfolioEntry } from "./NodeDetailPanel"
import type { CanvasNode } from "./SandboxCanvas"

import NodeDetailPanel from "./NodeDetailPanel"

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
    if (selectedTicker === ticker) setSelectedTicker(null)
  }

  const selectedCompany = companies.find((c) => c.ticker === selectedTicker) ?? null

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

      <div className="flex-1 relative">
        <SandboxCanvas
          nodes={canvasNodes}
          edges={edges}
          selectedTicker={selectedTicker}
          onNodeClick={setSelectedTicker}
          onDrop={handleDrop}
        />
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
      />
    </div>
  )
}
