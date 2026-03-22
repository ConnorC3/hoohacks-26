"use client"

import { useState } from "react"
import type { Company } from "@/lib/supabase/types"
import { SECTOR_COLORS, DEFAULT_SECTOR_COLOR } from "./constants"

interface Props {
  companies: Company[]
  addedTickers: Set<string>
  onImportClick: () => void
}

export default function CompanySidebar({ companies, addedTickers, onImportClick }: Props) {
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
    <aside className="flex flex-col w-64 glass-panel-solid border-r flex-shrink-0"
      style={{ borderColor: 'var(--glass-border)' }}>
      {/* Header */}
      <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--glass-border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent-green)' }} />
          <h2 className="font-semibold text-sm tracking-wide" style={{ color: 'var(--text-primary)' }}>
            S&amp;P 500
          </h2>
          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
            {companies.length}
          </span>
        </div>
        <input
          type="text"
          placeholder="Search ticker or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full input-dark text-sm rounded-lg px-3 py-2"
        />
      </div>

      {/* Company list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs px-4 py-4" style={{ color: 'var(--text-muted)' }}>No results.</p>
        ) : (
          filtered.map((company) => {
            const added = addedTickers.has(company.ticker)
            const color = SECTOR_COLORS[company.sector ?? ""] ?? DEFAULT_SECTOR_COLOR
            return (
              <div
                key={company.ticker}
                draggable={!added}
                onDragStart={(e) => handleDragStart(e, company.ticker)}
                className={`group flex items-center gap-3 px-4 py-2.5 border-b select-none transition-all duration-200 ${
                  added
                    ? "opacity-30 cursor-default"
                    : "cursor-grab active:cursor-grabbing"
                }`}
                style={{
                  borderColor: 'rgba(255,255,255,0.04)',
                  background: added ? 'transparent' : undefined,
                }}
                onMouseEnter={(e) => {
                  if (!added) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
                title={added ? "Already on canvas" : `Drag ${company.ticker} onto canvas`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0 transition-shadow duration-200"
                  style={{
                    backgroundColor: color,
                    boxShadow: added ? 'none' : `0 0 6px ${color}40`,
                  }}
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {company.ticker}
                  </span>
                  <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                    {company.name}
                  </span>
                </div>
                {added && (
                  <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
                    Added
                  </span>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="px-4 py-3 border-t flex flex-col gap-2" style={{ borderColor: 'var(--glass-border)' }}>
        <button
          onClick={onImportClick}
          className="w-full btn-ghost text-xs rounded-lg px-3 py-2 flex items-center justify-center gap-2"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Import from spreadsheet
        </button>
        <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} companies · drag to add
        </p>
      </div>
    </aside>
  )
}
