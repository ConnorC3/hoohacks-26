"use client"

import { SimulationStatus } from "./useSimulation"
import SimulationResultsSummary from "./SimulationResultsSummary"

interface Props {
  status: SimulationStatus
  loading: boolean
  error: string | null
  onPlay: () => void
  onReset: () => void
  // Simulation results summary
  impactedCount?: number
  onViewResults?: () => void
  // Display toggles
  showWeights?: boolean
  onToggleWeights?: () => void
}

export default function SimulationControls({
  status,
  loading,
  error,
  onPlay,
  onReset,
  impactedCount,
  onViewResults,
  showWeights,
  onToggleWeights,
}: Props) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 glass-panel border-b"
      style={{ borderColor: 'var(--glass-border)' }}>
      <div className="flex items-center gap-4 flex-wrap">

        {/* Run / Reset */}
        <div className="flex items-center gap-2">
          {status === "idle" || status === "complete" ? (
            <button
              onClick={onPlay}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 btn-primary text-xs font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Loading IRFs\u2026" : "\u25B6 Run Simulation"}
            </button>
          ) : null}

          {status !== "idle" && (
            <button
              onClick={onReset}
              className="px-3 py-1.5 btn-ghost text-xs font-medium rounded-lg"
            >
              {"\u21BA"} Reset
            </button>
          )}
        </div>

        {/* Weight label toggle */}
        {onToggleWeights && (
          <button
            onClick={onToggleWeights}
            className="px-2 py-1 text-xs rounded-md transition-all duration-200"
            style={{
              background: showWeights ? 'var(--accent-purple)' : 'rgba(255,255,255,0.04)',
              color: showWeights ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${showWeights ? 'var(--accent-purple)' : 'var(--glass-border)'}`,
            }}
          >
            Weights
          </button>
        )}

        {/* Simulation results summary */}
        {status === "complete" && impactedCount != null && onViewResults && (
          <SimulationResultsSummary impactedCount={impactedCount} onViewResults={onViewResults} />
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs" style={{ color: 'var(--accent-red)' }}>{error}</p>
      )}
    </div>
  )
}
