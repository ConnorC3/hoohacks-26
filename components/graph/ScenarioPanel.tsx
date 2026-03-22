"use client"

import { useState } from "react"
import type { CanvasNode } from "./SandboxCanvas"

interface ScenarioResult {
  explanation: string
  sectorShocks: Record<string, number>
}

interface Props {
  canvasNodes: CanvasNode[]
  onApply: (sectorShocks: Record<string, number>) => void
  onClear: () => void
}

export default function ScenarioPanel({ canvasNodes, onApply, onClear }: Props) {
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ScenarioResult | null>(null)

  const uniqueSectors = Array.from(
    new Set(canvasNodes.map((n) => n.sector).filter(Boolean))
  ) as string[]

  async function handleAnalyze() {
    if (!prompt.trim() || uniqueSectors.length === 0) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/api/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, sectors: uniqueSectors }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? res.statusText)
      setResult(json)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleApply() {
    if (result) onApply(result.sectorShocks)
  }

  function handleClear() {
    setResult(null)
    setPrompt("")
    setError(null)
    onClear()
  }

  return (
    <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-3 flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 bg-zinc-800 text-zinc-100 text-sm rounded px-3 py-1.5 placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:border-indigo-500"
          placeholder="e.g. What happens if there is a trade war with China?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
          disabled={loading || canvasNodes.length === 0}
        />
        <button
          onClick={handleAnalyze}
          disabled={loading || !prompt.trim() || canvasNodes.length === 0}
          className="px-3 py-1.5 text-sm rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors"
        >
          {loading ? "Analyzing…" : "Analyze"}
        </button>
        {result && (
          <button
            onClick={handleClear}
            className="px-3 py-1.5 text-sm rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {canvasNodes.length === 0 && (
        <p className="text-xs text-zinc-600">Add stocks to the canvas to use scenario analysis.</p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {result && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-zinc-400 leading-relaxed">{result.explanation}</p>
          <div className="flex flex-wrap gap-2 items-center">
            {Object.entries(result.sectorShocks)
              .sort((a, b) => a[1] - b[1])
              .map(([sector, pct]) => (
                <span
                  key={sector}
                  className={`text-xs font-mono px-2 py-0.5 rounded ${
                    pct < 0
                      ? "bg-red-900/50 text-red-300"
                      : "bg-emerald-900/50 text-emerald-300"
                  }`}
                >
                  {sector}: {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
                </span>
              ))}
            <button
              onClick={handleApply}
              className="ml-auto px-3 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
            >
              Apply &amp; Run
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
