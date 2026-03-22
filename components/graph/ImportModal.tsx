"use client"

import { useState, useCallback } from "react"
import type { Company } from "@/lib/supabase/types"

interface ParsedRow {
  ticker: string
  shares: string
  costBasis: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  companies: Company[]
  onImport: (rows: ParsedRow[]) => void
}

export default function ImportModal({ isOpen, onClose, companies, onImport }: Props) {
  const [raw, setRaw] = useState("")
  const [tickerCol, setTickerCol] = useState(0)
  const [sharesCol, setSharesCol] = useState(1)
  const [costCol, setCostCol] = useState(2)

  const companySet = new Set(companies.map((c) => c.ticker.toUpperCase()))

  // Parse tab-separated paste into rows/columns
  // Auto-detect delimiter: use tab if any line contains one, otherwise comma
  const delimiter = raw.includes("\t") ? "\t" : ","
  const rows = raw
    .split("\n")
    .map((line) => line.split(delimiter).map((cell) => cell.trim()))
    .filter((cols) => cols.some((c) => c.length > 0))

  const numCols = rows.length > 0 ? Math.max(...rows.map((r) => r.length)) : 0
  const colOptions = Array.from({ length: numCols }, (_, i) => i)

  // Parse a cell value to a clean number string (strips $, commas, spaces)
  function cleanNumber(val: string): string {
    return val.replace(/[$,\s]/g, "")
  }

  // Derive ticker from a cell (uppercase, strip exchange suffix like "AAPL.O")
  function parseTicker(val: string): string {
    return val.toUpperCase().split(".")[0].trim()
  }

  // If the first row's ticker cell isn't a known S&P 500 symbol, treat it as a header and skip it
  const firstRowTicker = rows[0] ? parseTicker(rows[0][tickerCol] ?? "") : ""
  const dataRows = rows.length > 0 && !companySet.has(firstRowTicker) ? rows.slice(1) : rows

  const parsed: Array<ParsedRow & { valid: boolean }> = dataRows
    .map((cols) => {
      const ticker = parseTicker(cols[tickerCol] ?? "")
      const shares = cleanNumber(cols[sharesCol] ?? "")
      const costBasis = cleanNumber(cols[costCol] ?? "")
      const valid = companySet.has(ticker) && ticker.length > 0 && ticker.length <= 5
      return { ticker, shares, costBasis, valid }
    })
    .filter((r) => r.ticker.length > 0)

  const toAdd = parsed.filter((r) => r.valid)
  const skipped = parsed.filter((r) => !r.valid).map((r) => r.ticker).filter((t) => t.length > 0)

  const handleImport = useCallback(() => {
    if (toAdd.length === 0) return
    onImport(toAdd.map(({ ticker, shares, costBasis }) => ({ ticker, shares, costBasis })))
    setRaw("")
    onClose()
  }, [toAdd, onImport, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        animation: "modal-enter 0.25s ease-out",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-2xl mx-4 rounded-2xl overflow-hidden"
        style={{
          background: "rgba(15,15,25,0.97)",
          border: "1px solid var(--glass-border)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 80px rgba(123,97,255,0.05)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: "var(--glass-border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full"
              style={{ background: "var(--accent-purple)", boxShadow: "0 0 8px var(--accent-purple)" }} />
            <h2 className="font-semibold text-base tracking-wide" style={{ color: "var(--text-primary)" }}>
              Import Portfolio
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--glass-border)", color: "var(--text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "var(--text-primary)" }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "var(--text-muted)" }}
          >✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* Instructions */}
          <div className="rounded-xl px-4 py-3 text-sm"
            style={{ background: "rgba(123,97,255,0.06)", border: "1px solid rgba(123,97,255,0.15)", color: "var(--text-secondary)" }}>
            Open your portfolio in Excel or Google Sheets, highlight the columns for <strong style={{ color: "var(--text-primary)" }}>ticker</strong>, <strong style={{ color: "var(--text-primary)" }}>shares</strong>, and <strong style={{ color: "var(--text-primary)" }}>cost basis</strong>, then paste below. Works with any brokerage export.
          </div>

          {/* Paste area */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Paste from spreadsheet
            </label>
            <textarea
              className="input-dark rounded-xl text-xs font-mono resize-none"
              style={{ minHeight: 120, padding: "12px", lineHeight: 1.6 }}
              placeholder={"AAPL\t50\t142.30\nNVDA\t20\t280.00\nMSFT\t30\t310.50"}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              spellCheck={false}
            />
          </div>

          {/* Column mapping — only show once data is pasted */}
          {numCols > 0 && (
            <div className="flex flex-col gap-3">
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Column mapping
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Ticker symbol", value: tickerCol, onChange: setTickerCol },
                  { label: "Shares / quantity", value: sharesCol, onChange: setSharesCol },
                  { label: "Cost basis (optional)", value: costCol, onChange: setCostCol },
                ].map(({ label, value, onChange }) => (
                  <div key={label} className="flex flex-col gap-1.5">
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
                    <select
                      value={value}
                      onChange={(e) => onChange(Number(e.target.value))}
                      className="input-dark rounded-lg text-xs px-3 py-2"
                      style={{ appearance: "auto" }}
                    >
                      {colOptions.map((i) => (
                        <option key={i} value={i} style={{ background: "#12121a" }}>
                          Column {i + 1}{rows[0]?.[i] ? ` — "${rows[0][i]}"` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Preview table */}
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--glass-border)" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--glass-border)" }}>
                      <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--text-muted)" }}>Ticker</th>
                      <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--text-muted)" }}>Shares</th>
                      <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--text-muted)" }}>Cost Basis</th>
                      <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--text-muted)" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.slice(0, 8).map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td className="px-3 py-2 font-mono font-semibold" style={{ color: "var(--text-primary)" }}>{row.ticker}</td>
                        <td className="px-3 py-2 font-mono" style={{ color: "var(--text-secondary)" }}>{row.shares || "—"}</td>
                        <td className="px-3 py-2 font-mono" style={{ color: "var(--text-secondary)" }}>{row.costBasis || "—"}</td>
                        <td className="px-3 py-2">
                          {row.valid
                            ? <span style={{ color: "var(--accent-green)" }}>✓ Adding</span>
                            : <span style={{ color: "var(--text-muted)" }}>Skipped</span>}
                        </td>
                      </tr>
                    ))}
                    {parsed.length > 8 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-center" style={{ color: "var(--text-muted)" }}>
                          +{parsed.length - 8} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Skipped notice */}
              {skipped.length > 0 && (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  <span style={{ color: "var(--accent-red)" }}>{skipped.length} skipped</span> (not in S&P 500):{" "}
                  {skipped.slice(0, 6).join(", ")}{skipped.length > 6 ? ` +${skipped.length - 6} more` : ""}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between flex-shrink-0"
          style={{ borderColor: "var(--glass-border)" }}>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {toAdd.length > 0 ? `${toAdd.length} stock${toAdd.length !== 1 ? "s" : ""} ready to add` : "Paste data above to begin"}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost text-sm px-4 py-2 rounded-lg">Cancel</button>
            <button
              onClick={handleImport}
              disabled={toAdd.length === 0}
              className="btn-primary text-sm px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add {toAdd.length > 0 ? `${toAdd.length} stock${toAdd.length !== 1 ? "s" : ""}` : "to Canvas"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
