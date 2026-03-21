"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { runSimulation, dateToHorizon } from "@/lib/simulation/engine"
import { getImpulseResponses } from "@/lib/supabase/queries"

export type SimulationStatus = "idle" | "running" | "paused" | "complete"

export const SPEED_OPTIONS = [
  { label: "0.5×", ms: 2000 },
  { label: "1×",   ms: 1000 },
  { label: "2×",   ms: 500  },
  { label: "5×",   ms: 200  },
  { label: "10×",  ms: 100  },
]

const MAX_HORIZON = 20

export interface UseSimulationReturn {
  // Shock inputs — set per ticker
  shocks: Record<string, number>
  setShock: (ticker: string, pct: number | null) => void

  // Playback state
  status: SimulationStatus
  currentHorizon: number
  maxHorizon: number
  speed: number
  setSpeed: (ms: number) => void
  runToDate: string
  setRunToDate: (date: string) => void

  // Current impact at currentHorizon for each canvas ticker
  currentImpacts: Record<string, number>

  // Controls
  play: () => Promise<void>
  pause: () => void
  resume: () => void
  reset: () => void

  loading: boolean
  error: string | null
}

export function useSimulation(canvasTickers: string[]): UseSimulationReturn {
  const [shocks, setShocks] = useState<Record<string, number>>({})
  const [status, setStatus] = useState<SimulationStatus>("idle")
  const [currentHorizon, setCurrentHorizon] = useState(0)
  const [speed, setSpeed] = useState(SPEED_OPTIONS[1].ms)
  const [runToDate, setRunToDate] = useState("")
  const [allImpacts, setAllImpacts] = useState<Record<string, number[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const horizonLimit = runToDate ? dateToHorizon(runToDate, MAX_HORIZON) : MAX_HORIZON

  // Derived: current impacts at the active horizon
  const currentImpacts: Record<string, number> = {}
  for (const ticker of canvasTickers) {
    currentImpacts[ticker] = allImpacts[ticker]?.[currentHorizon] ?? 0
  }

  // Timer — advances horizon while running
  useEffect(() => {
    if (status !== "running") {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    timerRef.current = setInterval(() => {
      setCurrentHorizon((h) => {
        if (h >= horizonLimit - 1) {
          setStatus("complete")
          return h
        }
        return h + 1
      })
    }, speed)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [status, speed, horizonLimit])

  const play = useCallback(async () => {
    const shockedTickers = Object.keys(shocks).filter((t) => shocks[t] !== 0)
    if (shockedTickers.length === 0) {
      setError("Apply a shock to at least one stock before running.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Fetch IRFs for all shocked tickers
      const irfs: Record<string, Record<string, number[]>> = {}
      await Promise.all(
        shockedTickers.map(async (ticker) => {
          irfs[ticker] = await getImpulseResponses(ticker)
        })
      )

      const result = runSimulation({
        shocks,
        irfs,
        canvasTickers,
        maxHorizon: MAX_HORIZON,
      })

      setAllImpacts(result.impacts)
      setCurrentHorizon(0)
      setStatus("running")
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [shocks, canvasTickers])

  const pause = useCallback(() => setStatus("paused"), [])
  const resume = useCallback(() => setStatus("running"), [])

  const reset = useCallback(() => {
    setStatus("idle")
    setCurrentHorizon(0)
    setAllImpacts({})
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
    currentHorizon,
    maxHorizon: horizonLimit,
    speed,
    setSpeed,
    runToDate,
    setRunToDate,
    currentImpacts,
    play,
    pause,
    resume,
    reset,
    loading,
    error,
  }
}
