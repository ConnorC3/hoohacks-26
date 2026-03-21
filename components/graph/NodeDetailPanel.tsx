"use client"

import { useState } from "react"
import type { Company } from "@/lib/supabase/types"
import { SECTOR_COLORS, DEFAULT_SECTOR_COLOR } from "./constants"

export interface PortfolioEntry {
  shares: string
  costBasis: string
  purchaseDate: string
  notes: string
}

interface Props {
  company: Company | null
  ticker: string | null
  latestPrice: number | null
  portfolio: PortfolioEntry | null
  onPortfolioChange: (entry: PortfolioEntry) => void
  onRemove: () => void
}

type Tab = "overview" | "investment"

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

function formatMarketCap(value: number | null): string {
  if (value === null) return "—"
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
    <div className="flex flex-col w-80 bg-zinc-900 border-l border-zinc-700 flex-shrink-0 h-full">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-zinc-700">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors"
          style={{ backgroundColor: ticker ? sectorColor : "#3f3f46" }}
        />
        <span className="font-mono font-bold text-white text-base tracking-wide">
          {ticker ?? "No selection"}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-700">
        {(["overview", "investment"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors ${
              activeTab === tab
                ? "text-white border-b-2 border-indigo-500"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {!ticker ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
            <p className="text-zinc-500 text-sm">No stock selected</p>
            <p className="text-zinc-600 text-xs">Click a node on the canvas to view details and enter your investment</p>
          </div>
        ) : activeTab === "overview" ? (
          <OverviewTab company={company} latestPrice={latestPrice} />
        ) : (
          <InvestmentTab
            portfolio={portfolio ?? { shares: "", costBasis: "", purchaseDate: "", notes: "" }}
            onChange={onPortfolioChange}
            latestPrice={latestPrice}
            totalInvested={totalInvested}
            currentValue={currentValue}
            pnl={pnl}
            pnlPct={pnlPct}
          />
        )}
      </div>

      {/* Footer */}
      {ticker && (
        <div className="px-5 py-3 border-t border-zinc-700">
          <button
            onClick={onRemove}
            className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
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
    <div className="flex flex-col gap-5 px-5 py-5">
      <p className="text-zinc-100 font-semibold text-sm leading-snug">{company.name}</p>

      <div className="flex flex-col gap-3">
        <StatRow label="Latest Price" value={latestPrice !== null ? formatCurrency(latestPrice) : "—"} />
        <StatRow label="Market Cap" value={formatMarketCap(company.market_cap)} />
        <StatRow label="Sector" value={company.sector ?? "—"} />
        <StatRow label="Industry" value={company.industry ?? "—"} />
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
    <div className="flex flex-col gap-6 px-5 py-5">
      {/* Survey questions */}
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
          className={inputClass}
        />
      </SurveyField>

      <SurveyField
        question="What is your average cost basis?"
        hint="Average price per share you paid, including fees."
      >
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
          <input
            type="number"
            min={0}
            step="any"
            placeholder="e.g. 150.00"
            value={portfolio.costBasis}
            onChange={(e) => update({ costBasis: e.target.value })}
            className={`${inputClass} pl-7`}
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
          className={inputClass}
        />
      </SurveyField>

      <SurveyField
        question="Any notes on this position?"
        hint="Optional — investment thesis, reminders, etc."
      >
        <textarea
          rows={3}
          placeholder="e.g. Long-term hold, bought on dip…"
          value={portfolio.notes}
          onChange={(e) => update({ notes: e.target.value })}
          className={`${inputClass} resize-none`}
        />
      </SurveyField>

      {/* P&L summary — only shown when enough data is entered */}
      {(totalInvested !== null || currentValue !== null) && (
        <div className="rounded-lg bg-zinc-800 px-4 py-4 flex flex-col gap-2.5">
          <p className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Summary</p>
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
      <p className="text-zinc-100 text-sm font-medium">{question}</p>
      {hint && <p className="text-zinc-500 text-xs leading-relaxed">{hint}</p>}
      {children}
    </div>
  )
}

function StatRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-zinc-800">
      <span className="text-zinc-500 text-xs">{label}</span>
      <span className={`text-zinc-100 text-xs font-medium ${mono ? "font-mono" : ""}`}>
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
      ? "text-emerald-400"
      : highlight === "red"
      ? "text-red-400"
      : "text-zinc-100"
  return (
    <div className="flex justify-between items-center">
      <span className="text-zinc-400 text-xs">{label}</span>
      <span className={`text-xs font-medium ${color}`}>{value}</span>
    </div>
  )
}

const inputClass =
  "w-full bg-zinc-800 text-white text-sm rounded-lg px-3 py-2.5 border border-zinc-700 focus:outline-none focus:border-indigo-500 placeholder-zinc-600 transition-colors"
