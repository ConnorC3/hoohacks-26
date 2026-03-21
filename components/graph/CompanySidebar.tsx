"use client"

import { useState } from "react"
import type { Company } from "@/lib/supabase/types"
import { SECTOR_COLORS, DEFAULT_SECTOR_COLOR } from "./constants"

interface Props {
  companies: Company[]
  addedTickers: Set<string>
}

export default function CompanySidebar({ companies, addedTickers }: Props) {
  const [search, setSearch] = useState("")

  const filtered = search.trim()
    ? companies.filter(
        (c) =>
          c.ticker.toLowerCase().includes(search.toLowerCase()) ||
          c.name.toLowerCase().includes(search.toLowerCase())
      )
    : companies

  function handleDragStart(e: React.DragEvent, ticker: string) {
    e.dataTransfer.setData("ticker", ticker)
    e.dataTransfer.effectAllowed = "copy"
  }

  return (
    <aside className="flex flex-col w-64 bg-zinc-900 border-r border-zinc-700 flex-shrink-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-zinc-700">
        <h2 className="text-white font-semibold text-sm mb-3">S&amp;P 500 Companies</h2>
        <input
          type="text"
          placeholder="Search ticker or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-zinc-800 text-white text-sm rounded px-3 py-2 placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Company list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-zinc-500 text-xs px-4 py-4">No results.</p>
        ) : (
          filtered.map((company) => {
            const added = addedTickers.has(company.ticker)
            const color = SECTOR_COLORS[company.sector ?? ""] ?? DEFAULT_SECTOR_COLOR
            return (
              <div
                key={company.ticker}
                draggable={!added}
                onDragStart={(e) => handleDragStart(e, company.ticker)}
                className={`flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800 select-none transition-colors ${
                  added
                    ? "opacity-40 cursor-default"
                    : "cursor-grab hover:bg-zinc-800 active:cursor-grabbing"
                }`}
                title={added ? "Already on canvas" : `Drag ${company.ticker} onto canvas`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-white text-xs font-mono font-semibold">
                    {company.ticker}
                  </span>
                  <span className="text-zinc-400 text-xs truncate">{company.name}</span>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="px-4 py-3 border-t border-zinc-700 text-zinc-500 text-xs">
        {filtered.length} companies · drag to add
      </div>
    </aside>
  )
}
