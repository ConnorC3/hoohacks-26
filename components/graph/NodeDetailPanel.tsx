"use client"

import { useState, useMemo } from "react"
import type { Company } from "@/lib/supabase/types"
import { SECTOR_COLORS, DEFAULT_SECTOR_COLOR } from "./constants"

export interface PortfolioEntry {
  shares: string
  costBasis: string
  purchaseDate: string
  notes: string
}

interface PricePoint {
  date: string
  price: number
}

interface Props {
  company: Company | null
  ticker: string | null
  latestPrice: number | null
  portfolio: PortfolioEntry | null
  onPortfolioChange: (entry: PortfolioEntry) => void
  onRemove: () => void
  // Simulation
  shock: number | null          // current shock in % (e.g. -10)
  onShockChange: (pct: number | null) => void
  simulatedImpact: number | null // current impact at active horizon
  simulationActive: boolean
  // Price history for chart
  priceHistory?: PricePoint[]
}

type Tab = "overview" | "investment" | "simulate"

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

function formatMarketCap(value: number | null): string {
  if (value === null) return "\u2014"
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  return `$${value.toLocaleString()}`
}

export default function NodeDetailPanel({
  company,
  ticker,
  latestPrice,
  portfolio,
  onPortfolioChange,
  onRemove,
  shock,
  onShockChange,
  simulatedImpact,
  simulationActive,
  priceHistory = [],
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const sectorColor = SECTOR_COLORS[company?.sector ?? ""] ?? DEFAULT_SECTOR_COLOR

  const shares = parseFloat(portfolio?.shares ?? "")
  const costBasis = parseFloat(portfolio?.costBasis ?? "")
  const hasShares = !isNaN(shares) && shares > 0
  const hasCostBasis = !isNaN(costBasis) && costBasis > 0
  const totalInvested = hasShares && hasCostBasis ? shares * costBasis : null
  const currentValue = hasShares && latestPrice !== null ? shares * latestPrice : null
  const pnl = totalInvested !== null && currentValue !== null ? currentValue - totalInvested : null
  const pnlPct =
    pnl !== null && totalInvested !== null && totalInvested > 0
      ? (pnl / totalInvested) * 100
      : null

  return (
    <div className="flex flex-col w-80 glass-panel-solid border-l flex-shrink-0 h-full"
      style={{ borderColor: 'var(--glass-border)' }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b" style={{ borderColor: 'var(--glass-border)' }}>
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-300"
          style={{
            backgroundColor: ticker ? sectorColor : 'var(--text-muted)',
            boxShadow: ticker ? `0 0 8px ${sectorColor}50` : 'none',
          }}
        />
        <span className="font-mono font-bold text-base tracking-wide" style={{ color: 'var(--text-primary)' }}>
          {ticker ?? "No selection"}
        </span>
        {company?.sector && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full"
            style={{
              color: sectorColor,
              background: `${sectorColor}15`,
              border: `1px solid ${sectorColor}25`,
            }}>
            {company.sector}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: 'var(--glass-border)' }}>
        {(["overview", "investment", "simulate"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`tab-underline flex-1 py-2.5 text-xs font-medium uppercase tracking-wider ${
              activeTab === tab ? "active" : ""
            }`}
            style={{
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {!ticker ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6"
            style={{ animation: 'fade-in-up 0.4s ease-out' }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)' }}>
                <path d="M15 15l6 6m-11-4a7 7 0 110-14 7 7 0 010 14z"/>
              </svg>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No stock selected</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Click a node on the canvas to view details and enter your investment
            </p>
          </div>
        ) : activeTab === "overview" ? (
          <OverviewTab company={company} latestPrice={latestPrice} />
        ) : activeTab === "investment" ? (
          <InvestmentTab
            portfolio={portfolio ?? { shares: "", costBasis: "", purchaseDate: "", notes: "" }}
            onChange={onPortfolioChange}
            latestPrice={latestPrice}
            totalInvested={totalInvested}
            currentValue={currentValue}
            pnl={pnl}
            pnlPct={pnlPct}
          />
        ) : (
          <SimulateTab
            ticker={ticker}
            shock={shock}
            onShockChange={onShockChange}
            simulatedImpact={simulatedImpact}
            simulationActive={simulationActive}
            latestPrice={latestPrice}
            priceHistory={priceHistory}
          />
        )}
      </div>

      {/* Footer */}
      {ticker && (
        <div className="px-5 py-3 border-t" style={{ borderColor: 'var(--glass-border)' }}>
          <button
            onClick={onRemove}
            className="text-xs transition-all duration-200"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent-red)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
          >
            Remove from canvas
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------------

function OverviewTab({
  company,
  latestPrice,
}: {
  company: Company | null
  latestPrice: number | null
}) {
  if (!company) return null
  return (
    <div className="flex flex-col gap-5 px-5 py-5" style={{ animation: 'fade-in-up 0.3s ease-out' }}>
      <p className="font-semibold text-sm leading-snug" style={{ color: 'var(--text-primary)' }}>{company.name}</p>

      <div className="flex flex-col gap-0">
        <StatRow label="Latest Price" value={latestPrice !== null ? formatCurrency(latestPrice) : "\u2014"} accent />
        <StatRow label="Market Cap" value={formatMarketCap(company.market_cap)} />
        <StatRow label="Sector" value={company.sector ?? "\u2014"} />
        <StatRow label="Industry" value={company.industry ?? "\u2014"} />
        <StatRow label="Ticker" value={company.ticker} mono />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Investment tab
// ---------------------------------------------------------------------------

function InvestmentTab({
  portfolio,
  onChange,
  latestPrice,
  totalInvested,
  currentValue,
  pnl,
  pnlPct,
}: {
  portfolio: PortfolioEntry
  onChange: (entry: PortfolioEntry) => void
  latestPrice: number | null
  totalInvested: number | null
  currentValue: number | null
  pnl: number | null
  pnlPct: number | null
}) {
  function update(patch: Partial<PortfolioEntry>) {
    onChange({ ...portfolio, ...patch })
  }

  return (
    <div className="flex flex-col gap-6 px-5 py-5" style={{ animation: 'fade-in-up 0.3s ease-out' }}>
      <SurveyField
        question="How many shares do you own?"
        hint="Enter 0 if you're tracking a position you don't hold yet."
      >
        <input
          type="number"
          min={0}
          step="any"
          placeholder="e.g. 10"
          value={portfolio.shares}
          onChange={(e) => update({ shares: e.target.value })}
          className="w-full input-dark text-sm rounded-lg px-3 py-2.5"
        />
      </SurveyField>

      <SurveyField
        question="What is your average cost basis?"
        hint="Average price per share you paid, including fees."
      >
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }}>$</span>
          <input
            type="number"
            min={0}
            step="any"
            placeholder="e.g. 150.00"
            value={portfolio.costBasis}
            onChange={(e) => update({ costBasis: e.target.value })}
            className="w-full input-dark text-sm rounded-lg pl-7 pr-3 py-2.5"
          />
        </div>
      </SurveyField>

      <SurveyField
        question="When did you first purchase?"
        hint="Optional — used for time-weighted return calculations."
      >
        <input
          type="date"
          value={portfolio.purchaseDate}
          onChange={(e) => update({ purchaseDate: e.target.value })}
          className="w-full input-dark text-sm rounded-lg px-3 py-2.5"
        />
      </SurveyField>

      <SurveyField
        question="Any notes on this position?"
        hint="Optional — investment thesis, reminders, etc."
      >
        <textarea
          rows={3}
          placeholder="e.g. Long-term hold, bought on dip..."
          value={portfolio.notes}
          onChange={(e) => update({ notes: e.target.value })}
          className="w-full input-dark text-sm rounded-lg px-3 py-2.5 resize-none"
        />
      </SurveyField>

      {/* P&L summary */}
      {(totalInvested !== null || currentValue !== null) && (
        <div className="rounded-xl px-4 py-4 flex flex-col gap-2.5"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--glass-border)',
          }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Summary</p>
          {totalInvested !== null && (
            <SummaryRow label="Total Invested" value={formatCurrency(totalInvested)} />
          )}
          {currentValue !== null && (
            <SummaryRow label="Current Value" value={formatCurrency(currentValue)} />
          )}
          {latestPrice !== null && (
            <SummaryRow label="Current Price" value={formatCurrency(latestPrice)} />
          )}
          {pnl !== null && (
            <SummaryRow
              label="Unrealised P&L"
              value={`${pnl >= 0 ? "+" : ""}${formatCurrency(pnl)}${
                pnlPct !== null
                  ? ` (${pnl >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%)`
                  : ""
              }`}
              highlight={pnl >= 0 ? "green" : "red"}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small shared components
// ---------------------------------------------------------------------------

function SurveyField({
  question,
  hint,
  children,
}: {
  question: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{question}</p>
      {hint && <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
      {children}
    </div>
  )
}

function StatRow({
  label,
  value,
  mono,
  accent,
}: {
  label: string
  value: string
  mono?: boolean
  accent?: boolean
}) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b"
      style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span
        className={`text-xs font-medium ${mono ? "font-mono" : ""}`}
        style={{ color: accent ? 'var(--accent-green)' : 'var(--text-primary)' }}
      >
        {value}
      </span>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: "green" | "red"
}) {
  const color =
    highlight === "green"
      ? "var(--accent-green)"
      : highlight === "red"
      ? "var(--accent-red)"
      : "var(--text-primary)"
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-xs font-medium font-mono" style={{ color }}>{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Price Chart — SVG sparkline with real historical data + shock projection
// ---------------------------------------------------------------------------

function PriceChart({
  priceHistory,
  latestPrice,
  simulatedImpact,
  simulationActive,
}: {
  priceHistory: PricePoint[]
  latestPrice: number | null
  simulatedImpact: number | null
  simulationActive: boolean
}) {
  const chartData = useMemo(() => {
    if (priceHistory.length === 0 || latestPrice === null) return null

    // Use last 60 trading days of data
    const recentPrices = priceHistory.slice(-60)
    const prices = recentPrices.map((p) => p.price)
    const dates = recentPrices.map((p) => p.date)

    const postShockPrice = simulationActive && simulatedImpact !== null
      ? latestPrice * (1 + simulatedImpact)
      : null

    // Compute Y range including post-shock price
    const allValues = [...prices]
    if (postShockPrice !== null) allValues.push(postShockPrice)
    const minPrice = Math.min(...allValues)
    const maxPrice = Math.max(...allValues)
    const yPadding = (maxPrice - minPrice) * 0.1 || 1
    const yMin = minPrice - yPadding
    const yMax = maxPrice + yPadding

    return { prices, dates, postShockPrice, yMin, yMax }
  }, [priceHistory, latestPrice, simulatedImpact, simulationActive])

  if (!chartData) return null

  const { prices, dates, postShockPrice, yMin, yMax } = chartData
  const W = 260
  const H = 140
  const PAD_L = 40
  const PAD_R = postShockPrice !== null ? 30 : 8
  const PAD_T = 12
  const PAD_B = 20
  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B

  const toX = (i: number) => PAD_L + (i / (prices.length - 1)) * plotW
  const toY = (v: number) => PAD_T + plotH - ((v - yMin) / (yMax - yMin)) * plotH

  // Build the historical price polyline
  const points = prices.map((p, i) => `${toX(i).toFixed(1)},${toY(p).toFixed(1)}`).join(" ")

  // Y-axis labels (4 ticks)
  const yTicks = Array.from({ length: 4 }, (_, i) => {
    const val = yMin + ((yMax - yMin) * i) / 3
    return { val, y: toY(val) }
  })

  // X-axis labels (first, middle, last)
  const xLabels = [
    { idx: 0, label: dates[0]?.slice(5) ?? "" },
    { idx: Math.floor(dates.length / 2), label: dates[Math.floor(dates.length / 2)]?.slice(5) ?? "" },
    { idx: dates.length - 1, label: dates[dates.length - 1]?.slice(5) ?? "" },
  ]

  const lastX = toX(prices.length - 1)
  const lastY = toY(prices[prices.length - 1])
  const shockX = lastX + 20
  const shockY = postShockPrice !== null ? toY(postShockPrice) : lastY
  const isPositive = postShockPrice !== null && postShockPrice >= prices[prices.length - 1]

  return (
    <div className="rounded-xl px-3 py-3" style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid var(--glass-border)',
    }}>
      <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
        Price History (60d){postShockPrice !== null ? " + Shock" : ""}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={t.y} y2={t.y}
              stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
            <text x={PAD_L - 4} y={t.y + 3} textAnchor="end"
              fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">
              ${t.val.toFixed(0)}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {xLabels.map((xl, i) => (
          <text key={i} x={toX(xl.idx)} y={H - 4} textAnchor="middle"
            fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="monospace">
            {xl.label}
          </text>
        ))}

        {/* Historical price line */}
        <polyline
          points={points}
          fill="none"
          stroke="var(--accent-purple)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Area fill under line */}
        <polygon
          points={`${toX(0).toFixed(1)},${toY(yMin).toFixed(1)} ${points} ${lastX.toFixed(1)},${toY(yMin).toFixed(1)}`}
          fill="url(#areaGrad)"
          opacity="0.3"
        />

        {/* Gradient definition */}
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-purple)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--accent-purple)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Latest price dot */}
        <circle cx={lastX} cy={lastY} r="3" fill="var(--accent-purple)" />

        {/* Post-shock projection */}
        {postShockPrice !== null && (
          <>
            {/* Shock line */}
            <line x1={lastX} y1={lastY} x2={shockX} y2={shockY}
              stroke={isPositive ? "var(--accent-green)" : "var(--accent-red)"}
              strokeWidth="1.5"
              strokeDasharray="3,2"
            />

            {/* Shock dot */}
            <circle cx={shockX} cy={shockY} r="3.5"
              fill={isPositive ? "var(--accent-green)" : "var(--accent-red)"}
            />
            <circle cx={shockX} cy={shockY} r="6"
              fill="none"
              stroke={isPositive ? "var(--accent-green)" : "var(--accent-red)"}
              strokeWidth="0.5"
              opacity="0.5"
            />

            {/* Post-shock price label */}
            <text x={shockX} y={shockY - 8} textAnchor="middle"
              fill={isPositive ? "var(--accent-green)" : "var(--accent-red)"}
              fontSize="8" fontFamily="monospace" fontWeight="bold">
              ${postShockPrice.toFixed(2)}
            </text>
          </>
        )}
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Simulate tab
// ---------------------------------------------------------------------------

function SimulateTab({
  ticker,
  shock,
  onShockChange,
  simulatedImpact,
  simulationActive,
  latestPrice,
  priceHistory,
}: {
  ticker: string
  shock: number | null
  onShockChange: (pct: number | null) => void
  simulatedImpact: number | null
  simulationActive: boolean
  latestPrice: number | null
  priceHistory: PricePoint[]
}) {
  const impactPct = simulatedImpact !== null ? simulatedImpact * 100 : null
  const impliedPrice =
    latestPrice !== null && simulatedImpact !== null
      ? latestPrice * (1 + simulatedImpact)
      : null

  return (
    <div className="flex flex-col gap-6 px-5 py-5" style={{ animation: 'fade-in-up 0.3s ease-out' }}>
      <SurveyField
        question={`Apply a price shock to ${ticker}`}
        hint="Enter a positive or negative percentage. This shock will propagate to all other stocks on the canvas via their VAR influence relationships."
      >
        <div className="relative">
          <input
            type="number"
            step="any"
            placeholder="e.g. -10"
            value={shock ?? ""}
            onChange={(e) => {
              const val = e.target.value === "" ? null : parseFloat(e.target.value)
              onShockChange(isNaN(val as number) ? null : val)
            }}
            className="w-full input-dark text-sm rounded-lg px-3 py-2.5 pr-8"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }}>%</span>
        </div>
      </SurveyField>

      {shock !== null && shock !== 0 && (
        <div className="rounded-xl px-4 py-3 flex flex-col gap-1"
          style={{
            background: shock < 0 ? 'rgba(255, 51, 102, 0.06)' : 'rgba(0, 255, 135, 0.06)',
            border: `1px solid ${shock < 0 ? 'rgba(255, 51, 102, 0.15)' : 'rgba(0, 255, 135, 0.15)'}`,
          }}>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Shock applied</p>
          <p className="text-lg font-bold font-mono"
            style={{ color: shock < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
            {shock > 0 ? "+" : ""}{Math.round(shock)}%
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Press Run Simulation above to propagate this shock.
          </p>
        </div>
      )}

      {/* Price chart — always visible when we have data */}
      <PriceChart
        priceHistory={priceHistory}
        latestPrice={latestPrice}
        simulatedImpact={simulatedImpact}
        simulationActive={simulationActive}
      />

      {simulationActive && impactPct !== null && (
        <div className="rounded-xl px-4 py-4 flex flex-col gap-2.5"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--glass-border)',
          }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            Simulated Impact
          </p>
          {latestPrice !== null && (
            <SummaryRow label="Before" value={formatCurrency(latestPrice)} />
          )}
          {impliedPrice !== null && (
            <SummaryRow
              label="After"
              value={formatCurrency(impliedPrice)}
              highlight={impactPct >= 0 ? "green" : "red"}
            />
          )}
          {latestPrice !== null && impliedPrice !== null && (
            <SummaryRow
              label="Difference"
              value={`${impactPct! >= 0 ? "+" : ""}${formatCurrency(impliedPrice - latestPrice)} (${impactPct! >= 0 ? "+" : ""}${impactPct!.toFixed(2)}%)`}
              highlight={impactPct! >= 0 ? "green" : "red"}
            />
          )}
        </div>
      )}
    </div>
  )
}
