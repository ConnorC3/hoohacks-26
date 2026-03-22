"use client"

import { useState, useEffect } from "react"
import { getReturnStats } from "@/lib/supabase/queries"
import type { CanvasNode } from "@/components/graph/SandboxCanvas"
import type { PortfolioEntry } from "@/components/graph/NodeDetailPanel"
import type { GraphEdge } from "@/lib/supabase/types"
import type { RiskMetrics, HoldingMetric, SectorBreakdown, CorrelatedPair } from "@/app/api/risk-analysis/route"
import { SECTOR_COLORS, DEFAULT_SECTOR_COLOR } from "@/components/graph/constants"

interface Props {
  isOpen: boolean
  onClose: () => void
  canvasNodes: CanvasNode[]
  portfolio: Record<string, PortfolioEntry>
  latestPrices: Record<string, number>
  edges: GraphEdge[]
}

interface AiResult {
  riskLevel: "Low" | "Medium" | "High"
  summary: string
  bullets: string[]
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
}

function computeMetrics(
  canvasNodes: CanvasNode[],
  portfolio: Record<string, PortfolioEntry>,
  latestPrices: Record<string, number>,
  edges: GraphEdge[],
  returnStats: Record<string, { stdDev: number; mean: number; count: number }>
): RiskMetrics {
  // Build holdings with values
  const holdings: Array<{ node: CanvasNode; shares: number; value: number }> = []
  for (const node of canvasNodes) {
    const entry = portfolio[node.ticker]
    const shares = parseFloat(entry?.shares ?? "")
    const price = latestPrices[node.ticker] ?? 0
    if (!isNaN(shares) && shares > 0 && price > 0) {
      holdings.push({ node, shares, value: shares * price })
    }
  }

  const totalValue = holdings.reduce((s, h) => s + h.value, 0)

  // Holdings metrics
  const holdingMetrics: HoldingMetric[] = holdings.map((h) => ({
    ticker: h.node.ticker,
    name: h.node.name,
    weightPct: totalValue > 0 ? (h.value / totalValue) * 100 : 0,
    value: h.value,
    annualisedVolPct: (returnStats[h.node.ticker]?.stdDev ?? 0) * 100,
  })).sort((a, b) => b.weightPct - a.weightPct)

  // Sector concentration
  const sectorMap = new Map<string, { weightPct: number; tickers: string[] }>()
  for (const hm of holdingMetrics) {
    const sector = canvasNodes.find((n) => n.ticker === hm.ticker)?.sector ?? "Unknown"
    const existing = sectorMap.get(sector)
    if (existing) {
      existing.weightPct += hm.weightPct
      existing.tickers.push(hm.ticker)
    } else {
      sectorMap.set(sector, { weightPct: hm.weightPct, tickers: [hm.ticker] })
    }
  }
  const sectorBreakdown: SectorBreakdown[] = Array.from(sectorMap.entries())
    .map(([sector, v]) => ({ sector, ...v }))
    .sort((a, b) => b.weightPct - a.weightPct)

  // Top correlated pairs (edges between holdings only)
  const holdingTickers = new Set(holdingMetrics.map((h) => h.ticker))
  const topPairs: CorrelatedPair[] = edges
    .filter((e) => holdingTickers.has(e.from_ticker) && holdingTickers.has(e.to_ticker) && e.total_weight > 0)
    .sort((a, b) => b.total_weight - a.total_weight)
    .slice(0, 3)
    .map((e) => ({
      from: e.from_ticker,
      to: e.to_ticker,
      fromName: canvasNodes.find((n) => n.ticker === e.from_ticker)?.name ?? e.from_ticker,
      toName: canvasNodes.find((n) => n.ticker === e.to_ticker)?.name ?? e.to_ticker,
      strength: e.total_weight,
    }))

  // Most exposed stock (highest sum of inbound edge weights from other holdings)
  const inboundWeights: Record<string, number> = {}
  for (const e of edges) {
    if (holdingTickers.has(e.from_ticker) && holdingTickers.has(e.to_ticker) && e.from_ticker !== e.to_ticker) {
      inboundWeights[e.to_ticker] = (inboundWeights[e.to_ticker] ?? 0) + e.total_weight
    }
  }
  const mostExposedTicker = Object.entries(inboundWeights).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const mostExposedName = mostExposedTicker
    ? (canvasNodes.find((n) => n.ticker === mostExposedTicker)?.name ?? mostExposedTicker)
    : null

  // Weighted portfolio volatility (approximation)
  const portfolioVolPct = holdingMetrics.reduce((sum, h) => {
    return sum + (h.weightPct / 100) * h.annualisedVolPct
  }, 0)

  return {
    totalValue,
    portfolioVolPct,
    holdings: holdingMetrics,
    sectorBreakdown,
    topPairs,
    mostExposedTicker,
    mostExposedName,
  }
}

const RISK_LEVEL_COLORS = {
  Low: { text: "var(--accent-green)", bg: "rgba(0,255,135,0.08)", border: "rgba(0,255,135,0.2)" },
  Medium: { text: "#f59e0b",          bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)" },
  High: { text: "var(--accent-red)",  bg: "rgba(255,51,102,0.08)", border: "rgba(255,51,102,0.2)" },
}

export default function RiskModal({
  isOpen,
  onClose,
  canvasNodes,
  portfolio,
  latestPrices,
  edges,
}: Props) {
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(false)
  const [aiResult, setAiResult] = useState<AiResult | null>(null)
  const [loadingAi, setLoadingAi] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // Compute metrics when modal opens
  useEffect(() => {
    if (!isOpen) return
    setMetrics(null)
    setAiResult(null)
    setAiError(null)
    setLoadingMetrics(true)

    const portfolioTickers = canvasNodes
      .filter((n) => {
        const shares = parseFloat(portfolio[n.ticker]?.shares ?? "")
        return !isNaN(shares) && shares > 0
      })
      .map((n) => n.ticker)

    getReturnStats(portfolioTickers)
      .then((stats) => {
        setMetrics(computeMetrics(canvasNodes, portfolio, latestPrices, edges, stats))
      })
      .catch((e) => console.error("getReturnStats failed", e))
      .finally(() => setLoadingMetrics(false))
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerateAi() {
    if (!metrics) return
    setLoadingAi(true)
    setAiError(null)
    try {
      const res = await fetch("/api/risk-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metrics }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAiResult(data)
    } catch (e: any) {
      setAiError(e.message ?? "Failed to generate summary")
    } finally {
      setLoadingAi(false)
    }
  }

  if (!isOpen) return null

  const riskColors = aiResult ? RISK_LEVEL_COLORS[aiResult.riskLevel] : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="relative z-10 flex flex-col w-full max-w-2xl mx-4 max-h-[85vh] rounded-xl overflow-hidden"
        style={{
          background: '#13131f',
          border: '1px solid rgba(123,97,255,0.35)',
          boxShadow: '0 0 0 1px rgba(123,97,255,0.1), 0 25px 60px rgba(0,0,0,0.7)',
        }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'rgba(123,97,255,0.2)', background: 'rgba(123,97,255,0.06)' }}>
          <div>
            <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
              Risk Analysis
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Portfolio-level risk metrics based on VAR model data
            </p>
          </div>
          <button onClick={onClose} className="text-lg leading-none transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">

          {loadingMetrics && (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading portfolio data…</p>
            </div>
          )}

          {!loadingMetrics && metrics && (
            <>
              {/* Holdings table */}
              <section>
                <p className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                  Holdings
                </p>
                {metrics.holdings.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    No positions entered. Add shares in the Investment tab to analyse your portfolio.
                  </p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        <th className="text-left pb-2 font-medium" style={{ color: 'var(--text-muted)' }}>Stock</th>
                        <th className="text-right pb-2 font-medium" style={{ color: 'var(--text-muted)' }}>Weight</th>
                        <th className="text-right pb-2 font-medium" style={{ color: 'var(--text-muted)' }}>Value</th>
                        <th className="text-right pb-2 font-medium" style={{ color: 'var(--text-muted)' }}>Ann. Vol</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.holdings.map((h) => {
                        const sectorColor = SECTOR_COLORS[
                          canvasNodes.find((n) => n.ticker === h.ticker)?.sector ?? ""
                        ] ?? DEFAULT_SECTOR_COLOR
                        return (
                          <tr key={h.ticker} className="border-b"
                            style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                            <td className="py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: sectorColor }} />
                                <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                                  {h.ticker}
                                </span>
                                <span style={{ color: 'var(--text-muted)' }}>{h.name}</span>
                              </div>
                            </td>
                            <td className="py-2.5 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>
                              {h.weightPct.toFixed(1)}%
                            </td>
                            <td className="py-2.5 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>
                              {formatCurrency(h.value)}
                            </td>
                            <td className="py-2.5 text-right font-mono"
                              style={{ color: h.annualisedVolPct > 40 ? 'var(--accent-red)' : h.annualisedVolPct > 25 ? '#f59e0b' : 'var(--accent-green)' }}>
                              {h.annualisedVolPct.toFixed(1)}%
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="pt-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          Weighted avg vol (approx)
                        </td>
                        <td />
                        <td className="pt-2.5 text-right font-mono text-xs font-medium"
                          style={{ color: 'var(--text-secondary)' }}>
                          {formatCurrency(metrics.totalValue)}
                        </td>
                        <td className="pt-2.5 text-right font-mono text-xs font-semibold"
                          style={{ color: 'var(--text-primary)' }}>
                          {metrics.portfolioVolPct.toFixed(1)}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </section>

              {/* Sector concentration */}
              {metrics.sectorBreakdown.length > 0 && (
                <section>
                  <p className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                    Sector Concentration
                  </p>
                  <div className="flex flex-col gap-2">
                    {metrics.sectorBreakdown.map((s) => {
                      const color = SECTOR_COLORS[s.sector] ?? DEFAULT_SECTOR_COLOR
                      return (
                        <div key={s.sector}>
                          <div className="flex justify-between text-xs mb-1">
                            <span style={{ color: 'var(--text-secondary)' }}>{s.sector}</span>
                            <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                              {s.weightPct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden"
                            style={{ background: 'rgba(255,255,255,0.06)' }}>
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(s.weightPct, 100)}%`, backgroundColor: color, opacity: 0.7 }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Top dependencies */}
              {metrics.topPairs.length > 0 && (
                <section>
                  <p className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                    Strongest Dependencies
                  </p>
                  <div className="flex flex-col gap-2">
                    {metrics.topPairs.map((p) => (
                      <div key={`${p.from}_${p.to}`}
                        className="flex items-center justify-between px-3 py-2.5 rounded-lg text-xs"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{p.from}</span>
                          {" → "}
                          <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{p.to}</span>
                          {` (${p.toName})`}
                        </span>
                        <span className="font-mono" style={{ color: 'var(--accent-purple)' }}>
                          {p.strength.toFixed(3)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* AI Summary */}
              <section>
                <p className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                  AI Risk Summary
                </p>

                {!aiResult && !loadingAi && (
                  <button
                    onClick={handleGenerateAi}
                    disabled={metrics.holdings.length === 0}
                    className="w-full py-2.5 text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: 'var(--accent-purple)',
                      color: 'white',
                      border: '1px solid var(--accent-purple)',
                    }}
                  >
                    Generate AI Summary
                  </button>
                )}

                {loadingAi && (
                  <div className="flex items-center gap-2 py-3">
                    <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: 'var(--accent-purple)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Analysing your portfolio…</p>
                  </div>
                )}

                {aiError && (
                  <p className="text-sm" style={{ color: 'var(--accent-red)' }}>{aiError}</p>
                )}

                {aiResult && riskColors && (
                  <div className="flex flex-col gap-4">
                    {/* Risk level badge + summary */}
                    <div className="flex items-start gap-3 px-4 py-3 rounded-lg"
                      style={{ background: riskColors.bg, border: `1px solid ${riskColors.border}` }}>
                      <span className="px-2 py-0.5 rounded text-xs font-bold flex-shrink-0 mt-0.5"
                        style={{ background: riskColors.border, color: riskColors.text }}>
                        {aiResult.riskLevel} Risk
                      </span>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {aiResult.summary}
                      </p>
                    </div>

                    {/* Bullet insights */}
                    <div className="flex flex-col gap-2.5">
                      {aiResult.bullets.map((bullet, i) => (
                        <div key={i} className="flex gap-3 px-4 py-3 rounded-lg text-sm leading-relaxed"
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--glass-border)',
                            color: 'var(--text-secondary)',
                          }}>
                          <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                            style={{ background: 'rgba(123,97,255,0.15)', color: 'var(--accent-purple)' }}>
                            {i + 1}
                          </span>
                          {bullet}
                        </div>
                      ))}
                    </div>

                    {/* Re-generate */}
                    <button onClick={handleGenerateAi} disabled={loadingAi}
                      className="text-xs self-end transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}>
                      Regenerate
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex-shrink-0" style={{ borderColor: 'rgba(123,97,255,0.2)' }}>
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--glass-border)',
            }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
