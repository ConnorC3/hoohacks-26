"use client"

import { useState, useCallback } from "react"
import { runSimulation } from "@/lib/simulation/engine"
import { getImpulseResponses, getIncomingImpulseResponses } from "@/lib/supabase/queries"

export type SimulationStatus = "idle" | "complete"

export interface UseSimulationReturn {
  // Shock inputs — set per ticker
  shocks: Record<string, number>
  setShock: (ticker: string, pct: number | null) => void

  // Playback state
  status: SimulationStatus

  // Final impact for each canvas ticker (instant snapshot)
  currentImpacts: Record<string, number>

  // Controls
  play: (overrideShocks?: Record<string, number>) => Promise<void>
  reset: () => void

  loading: boolean
  error: string | null
}

// We compute the full 20-horizon IRF but only display the final cumulative result.
// This represents the near-instant repricing (~2s) that occurs via EMH + HFT.
const COMPUTE_HORIZON = 20

export function useSimulation(canvasTickers: string[]): UseSimulationReturn {
  const [shocks, setShocks] = useState<Record<string, number>>({})
  const [status, setStatus] = useState<SimulationStatus>("idle")
  const [currentImpacts, setCurrentImpacts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const play = useCallback(async (overrideShocks?: Record<string, number>) => {
    const effectiveShocks = overrideShocks ?? shocks
    const shockedTickers = Object.keys(effectiveShocks).filter((t) => effectiveShocks[t] !== 0)
    if (shockedTickers.length === 0) {
      setError("Apply a shock to at least one stock before running.")
      return
    }

    setStatus("idle")
    setCurrentImpacts({})
    setLoading(true)
    setError(null)

    try {
      // Fetch outgoing IRFs (from each canvas/shocked ticker to all ~503 targets)
      // AND incoming IRFs (from all ~503 sources to each canvas ticker).
      // This allows every node in the market to serve as an intermediary.
      const irfs: Record<string, Record<string, number[]>> = {}
      const incomingIrfs: Record<string, Record<string, number[]>> = {}

      // Ensure shocked tickers are included in outgoing IRF fetch
      const outgoingSet = new Set([...canvasTickers, ...shockedTickers])

      await Promise.all([
        // Outgoing IRFs: each canvas/shocked ticker → all ~503 targets
        ...Array.from(outgoingSet).map(async (ticker) => {
          irfs[ticker] = await getImpulseResponses(ticker)
          console.log(`[sim] outgoing IRF for ${ticker}:`, Object.keys(irfs[ticker]).length, "targets")
        }),
        // Incoming IRFs: all ~503 sources → each canvas ticker
        ...canvasTickers.map(async (ticker) => {
          incomingIrfs[ticker] = await getIncomingImpulseResponses(ticker)
          console.log(`[sim] incoming IRF for ${ticker}:`, Object.keys(incomingIrfs[ticker]).length, "sources")
        }),
      ])

      const result = runSimulation({
        shocks: effectiveShocks,
        irfs,
        incomingIrfs,
        canvasTickers,
        maxHorizon: COMPUTE_HORIZON,
      })

      // Use the final horizon as the instant repricing result
      const finalImpacts: Record<string, number> = {}
      for (const [ticker, timeline] of Object.entries(result.impacts)) {
        finalImpacts[ticker] = timeline[timeline.length - 1] ?? 0
      }

      console.log("[sim] final impacts:", Object.fromEntries(
        Object.entries(finalImpacts).map(([t, v]) => [t, v.toFixed(4)])
      ))

      setCurrentImpacts(finalImpacts)
      setStatus("complete")
    } catch (e: any) {
      console.error("[sim] play() failed:", e)
      setError(String(e?.message ?? e))
    } finally {
      setLoading(false)
    }
  }, [shocks, canvasTickers])

  const reset = useCallback(() => {
    setStatus("idle")
    setCurrentImpacts({})
    setError(null)
  }, [])

  const setShock = useCallback((ticker: string, pct: number | null) => {
    setShocks((prev) => {
      const next = { ...prev }
      if (pct === null || pct === 0) {
        delete next[ticker]
      } else {
        next[ticker] = pct / 100 // convert % to decimal
      }
      return next
    })
  }, [])

  return {
    shocks,
    setShock,
    status,
    currentImpacts,
    play,
    reset,
    loading,
    error,
  }
}
