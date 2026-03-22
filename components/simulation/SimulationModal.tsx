"use client"

import { useEffect, useRef } from "react"
import type { CanvasNode } from "@/components/graph/SandboxCanvas"
import type { PortfolioEntry } from "@/components/graph/NodeDetailPanel"
import { SECTOR_COLORS, DEFAULT_SECTOR_COLOR } from "@/components/graph/constants"

interface Props {
  open: boolean
  onClose: () => void
  impacts: Record<string, number>        // ticker → decimal impact
  shocks: Record<string, number>         // ticker → decimal shock
  canvasNodes: CanvasNode[]
  portfolio: Record<string, PortfolioEntry>
  latestPrices: Record<string, number>
}

interface StockImpact {
  ticker: string
  name: string
  sector: string | null
  impactPct: number
  dollarPnL: number | null
  shares: number | null
  isShocked: boolean
}

export default function SimulationModal({
  open,
  onClose,
  impacts,
  shocks,
  canvasNodes,
  portfolio,
  latestPrices,
}: Props) {
  const modalRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  // Focus trap
  useEffect(() => {
    if (open && modalRef.current) {
      modalRef.current.focus()
    }
  }, [open])

  if (!open) return null

  // Compute per-stock impact data
  const stockImpacts: StockImpact[] = canvasNodes.map((node) => {
    const impactDecimal = impacts[node.ticker] ?? 0
    const impactPct = impactDecimal * 100
    const price = latestPrices[node.ticker]
    const entry = portfolio[node.ticker]
    const shares = entry ? parseFloat(entry.shares) : NaN
    const hasShares = !isNaN(shares) && shares > 0

    let dollarPnL: number | null = null
    if (hasShares && price) {
      dollarPnL = shares * price * impactDecimal
    }

    return {
      ticker: node.ticker,
      name: node.name,
      sector: node.sector,
      impactPct,
      dollarPnL,
      shares: hasShares ? shares : null,
      isShocked: shocks[node.ticker] != null && shocks[node.ticker] !== 0,
    }
  }).sort((a, b) => Math.abs(b.impactPct) - Math.abs(a.impactPct))

  // Summary stats
  const shockedTickers = Object.keys(shocks).filter((t) => shocks[t] !== 0)
  const shockedStock = shockedTickers.length > 0 ? shockedTickers[0] : "—"
  const shockMagnitude = shockedTickers.length > 0
    ? (shocks[shockedTickers[0]] * 100).toFixed(1) + "%"
    : "—"
  const maxCascade = stockImpacts
    .filter((s) => !s.isShocked)
    .reduce((max, s) => Math.abs(s.impactPct) > Math.abs(max) ? s.impactPct : max, 0)
  const avgImpact = stockImpacts.length > 0
    ? stockImpacts.reduce((sum, s) => sum + Math.abs(s.impactPct), 0) / stockImpacts.length
    : 0

  // Total portfolio impact
  const totalDollarImpact = stockImpacts.reduce((sum, s) => sum + (s.dollarPnL ?? 0), 0)
  const hasPortfolioData = stockImpacts.some((s) => s.dollarPnL !== null)

  // Max absolute impact for bar scaling
  const maxAbsImpact = Math.max(...stockImpacts.map((s) => Math.abs(s.impactPct)), 0.01)

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        animation: "modal-enter 0.3s ease-out",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="w-full max-w-5xl mx-4 rounded-2xl overflow-hidden outline-none"
        style={{
          background: "rgba(15, 15, 25, 0.97)",
          border: "1px solid var(--glass-border)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 80px rgba(123, 97, 255, 0.05)",
          maxHeight: "85vh",
          animation: "modal-enter 0.3s ease-out",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--glass-border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full" style={{ background: "var(--accent-green)", boxShadow: "0 0 8px var(--accent-green)" }} />
            <h2 className="font-semibold text-base tracking-wide" style={{ color: "var(--text-primary)" }}>
              Simulation Results
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-muted)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)"
              e.currentTarget.style.color = "var(--text-primary)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)"
              e.currentTarget.style.color = "var(--text-muted)"
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex" style={{ maxHeight: "calc(85vh - 60px)" }}>
          {/* Left panel — Stock impact list */}
          <div className="w-2/5 border-r overflow-y-auto" style={{ borderColor: "var(--glass-border)" }}>
            <div className="px-5 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Portfolio Impact Analysis
              </p>
            </div>

            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
              {stockImpacts.map((stock, i) => {
                const sectorColor = SECTOR_COLORS[stock.sector ?? ""] ?? DEFAULT_SECTOR_COLOR
                const isPositive = stock.impactPct >= 0
                return (
                  <div
                    key={stock.ticker}
                    className="px-5 py-3 flex items-center gap-3"
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      animation: `fade-in-up 0.3s ease-out ${i * 0.03}s both`,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: sectorColor, boxShadow: `0 0 6px ${sectorColor}40` }}
                    />
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
                          {stock.ticker}
                        </span>
                        {stock.isShocked && (
                          <span className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: "rgba(123,97,255,0.15)", color: "var(--accent-purple)", fontSize: "9px" }}>
                            SHOCKED
                          </span>
                        )}
                      </div>
                      <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                        {stock.name}
                      </span>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className="text-sm font-mono font-bold"
                        style={{ color: isPositive ? "var(--accent-green)" : "var(--accent-red)" }}>
                        {isPositive ? "+" : ""}{stock.impactPct.toFixed(2)}%
                      </span>
                      {stock.dollarPnL !== null && (
                        <span className="text-xs font-mono"
                          style={{ color: stock.dollarPnL >= 0 ? "var(--accent-green)" : "var(--accent-red)", opacity: 0.7 }}>
                          {stock.dollarPnL >= 0 ? "+" : ""}${Math.abs(stock.dollarPnL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Total */}
            {hasPortfolioData && (
              <div className="px-5 py-4 border-t" style={{ borderColor: "var(--glass-border)" }}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    Total Portfolio Impact
                  </span>
                  <span className="text-sm font-mono font-bold"
                    style={{ color: totalDollarImpact >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                    {totalDollarImpact >= 0 ? "+" : ""}${Math.abs(totalDollarImpact).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right panel — Bar chart + stats */}
          <div className="w-3/5 overflow-y-auto">
            {/* Bar chart */}
            <div className="px-6 py-4">
              <p className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
                Impact Distribution
              </p>
              <div className="flex flex-col gap-1.5">
                {stockImpacts.map((stock, i) => {
                  const isPositive = stock.impactPct >= 0
                  const barWidth = Math.max((Math.abs(stock.impactPct) / maxAbsImpact) * 100, 2)
                  return (
                    <div key={stock.ticker} className="flex items-center gap-2 h-7">
                      <span className="text-xs font-mono w-12 text-right flex-shrink-0"
                        style={{ color: "var(--text-secondary)" }}>
                        {stock.ticker}
                      </span>
                      <div className="flex-1 h-4 rounded-sm overflow-hidden relative"
                        style={{ background: "rgba(255,255,255,0.03)" }}>
                        <div
                          className="h-full rounded-sm"
                          style={{
                            width: `${barWidth}%`,
                            background: isPositive
                              ? "linear-gradient(90deg, rgba(0,255,135,0.4), rgba(0,255,135,0.7))"
                              : "linear-gradient(90deg, rgba(255,51,102,0.4), rgba(255,51,102,0.7))",
                            transformOrigin: "left",
                            animation: `bar-enter 0.5s ease-out ${i * 0.04}s both`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono w-16 text-right flex-shrink-0"
                        style={{ color: isPositive ? "var(--accent-green)" : "var(--accent-red)" }}>
                        {isPositive ? "+" : ""}{stock.impactPct.toFixed(2)}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Stats grid */}
            <div className="px-6 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
              <p className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
                Summary Statistics
              </p>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Shocked Stock" value={shockedStock} mono />
                <StatCard label="Shock Magnitude" value={shockMagnitude} color={
                  shockedTickers.length > 0 && shocks[shockedTickers[0]] < 0 ? "var(--accent-red)" : "var(--accent-green)"
                } />
                <StatCard label="Max Cascade" value={`${maxCascade >= 0 ? "+" : ""}${maxCascade.toFixed(2)}%`} color={
                  maxCascade >= 0 ? "var(--accent-green)" : "var(--accent-red)"
                } />
                <StatCard label="Avg Impact" value={`${avgImpact.toFixed(2)}%`} color="var(--accent-purple)" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, mono }: { label: string; value: string; color?: string; mono?: boolean }) {
  return (
    <div className="rounded-xl px-4 py-3"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--glass-border)",
      }}>
      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className={`text-lg font-bold ${mono ? "font-mono" : ""}`}
        style={{ color: color ?? "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  )
}
