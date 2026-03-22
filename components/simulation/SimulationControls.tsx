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
  // Risk analysis
  onRiskAnalysis?: () => void
  hasPortfolio?: boolean
  riskModalOpen?: boolean
  // Canvas
  onClearCanvas?: () => void
  canvasEmpty?: boolean
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
  onRiskAnalysis,
  hasPortfolio,
  riskModalOpen,
  onClearCanvas,
  canvasEmpty,
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
              {loading ? "Loading\u2026" : "\u25B6 Run Simulation"}
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

        {/* Risk analysis button */}
        {onRiskAnalysis && (
          <button
            onClick={onRiskAnalysis}
            disabled={!hasPortfolio}
            className="px-2 py-1 text-xs rounded-md transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: riskModalOpen ? 'var(--accent-purple)' : 'rgba(255,255,255,0.04)',
              color: riskModalOpen ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${riskModalOpen ? 'var(--accent-purple)' : 'var(--glass-border)'}`,
              boxShadow: riskModalOpen ? '0 0 10px rgba(123,97,255,0.4)' : 'none',
            }}
            title={hasPortfolio ? "Analyse portfolio risk" : "Enter shares in the Investment tab first"}
          >
            Risk Analysis
          </button>
        )}

        {/* Clear canvas button */}
        {onClearCanvas && (
          <button
            onClick={onClearCanvas}
            disabled={canvasEmpty}
            className="px-2 py-1 text-xs rounded-md transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--glass-border)',
            }}
            title={canvasEmpty ? "Canvas is already empty" : "Remove all nodes from canvas"}
          >
            Clear Canvas
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
