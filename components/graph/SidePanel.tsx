"use client"

import { useEffect, useState } from "react"
import type { Company } from "@/lib/supabase/types"
import { getCompany, getLatestPrices } from "@/lib/supabase/queries"
import { SECTOR_COLORS, DEFAULT_SECTOR_COLOR } from "./constants"

interface Props {
  ticker: string
  onClose: () => void
}

function formatMarketCap(value: number | null): string {
  if (value === null) return "—"
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  return `$${value.toLocaleString()}`
}

function formatPrice(value: number | null): string {
  if (value === null) return "—"
  return `$${value.toFixed(2)}`
}

export default function SidePanel({ ticker, onClose }: Props) {
  const [company, setCompany] = useState<Company | null>(null)
  const [price, setPrice] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    Promise.all([getCompany(ticker), getLatestPrices()])
      .then(([co, prices]) => {
        setCompany(co)
        setPrice(prices[ticker] ?? null)
      })
      .finally(() => setLoading(false))
  }, [ticker])

  const sectorColor = company?.sector
    ? (SECTOR_COLORS[company.sector] ?? DEFAULT_SECTOR_COLOR)
    : DEFAULT_SECTOR_COLOR

  return (
    <div className="flex flex-col h-full bg-zinc-900 text-white w-80 border-l border-zinc-700 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700">
        <div className="flex items-center gap-3">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: sectorColor }}
          />
          <span className="font-mono font-bold text-lg">{ticker}</span>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white transition-colors text-xl leading-none"
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1 text-zinc-500 text-sm">
          Loading…
        </div>
      ) : !company ? (
        <div className="flex items-center justify-center flex-1 text-zinc-500 text-sm">
          No data found.
        </div>
      ) : (
        <div className="flex flex-col gap-6 px-5 py-5">
          {/* Company name */}
          <p className="text-zinc-100 font-semibold text-base leading-snug">{company.name}</p>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Latest Price" value={formatPrice(price)} />
            <Stat label="Market Cap" value={formatMarketCap(company.market_cap)} />
            <Stat label="Sector" value={company.sector ?? "—"} />
            <Stat label="Industry" value={company.industry ?? "—"} />
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm text-zinc-100 font-medium">{value}</span>
    </div>
  )
}
