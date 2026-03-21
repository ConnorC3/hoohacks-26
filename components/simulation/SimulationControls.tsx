"use client"

import { SPEED_OPTIONS, SimulationStatus } from "./useSimulation"
import SimulationResultsSummary from "./SimulationResultsSummary"

interface Props {
  status: SimulationStatus
  currentHorizon: number
  maxHorizon: number
  speed: number
  runToDate: string
  loading: boolean
  error: string | null
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onReset: () => void
  onSpeedChange: (ms: number) => void
  onRunToDateChange: (date: string) => void
  // Simulation results summary
  impactedCount?: number
  onViewResults?: () => void
}

export default function SimulationControls({
  status,
  currentHorizon,
  maxHorizon,
  speed,
  runToDate,
  loading,
  error,
  onPlay,
  onPause,
  onResume,
  onReset,
  onSpeedChange,
  onRunToDateChange,
  impactedCount,
  onViewResults,
}: Props) {
  const progress = maxHorizon > 0 ? (currentHorizon / (maxHorizon - 1)) * 100 : 0
  const today = new Date()
  const currentDate = new Date(today)
  currentDate.setDate(today.getDate() + Math.round(currentHorizon / 0.71))
  const minDate = new Date(today)
  minDate.setDate(today.getDate() + 2)

  return (
    <div className="flex flex-col gap-2 px-4 py-3 glass-panel border-b"
      style={{ borderColor: 'var(--glass-border)' }}>
      <div className="flex items-center gap-4 flex-wrap">

        {/* Play / Pause / Resume / Reset */}
        <div className="flex items-center gap-2">
          {status === "idle" || status === "complete" ? (
            <button
              onClick={onPlay}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 btn-primary text-xs font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Loading IRFs\u2026" : "\u25B6 Run Simulation"}
            </button>
          ) : status === "running" ? (
            <button
              onClick={onPause}
              className="flex items-center gap-1.5 px-4 py-1.5 btn-ghost text-xs font-medium rounded-lg"
            >
              \u23F8 Pause
            </button>
          ) : (
            <button
              onClick={onResume}
              className="flex items-center gap-1.5 px-4 py-1.5 btn-primary text-xs font-medium rounded-lg"
            >
              \u25B6 Resume
            </button>
          )}

          {status !== "idle" && (
            <button
              onClick={onReset}
              className="px-3 py-1.5 btn-ghost text-xs font-medium rounded-lg"
            >
              \u21BA Reset
            </button>
          )}
        </div>

        {/* Speed selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Speed:</span>
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.ms}
              onClick={() => onSpeedChange(opt.ms)}
              className={`px-2 py-1 text-xs rounded-md transition-all duration-200 ${
                speed === opt.ms
                  ? "text-white"
                  : "hover:bg-white/5"
              }`}
              style={{
                background: speed === opt.ms ? 'var(--accent-purple)' : 'rgba(255,255,255,0.04)',
                color: speed === opt.ms ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${speed === opt.ms ? 'var(--accent-purple)' : 'var(--glass-border)'}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Run-to date */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Run to:</span>
          <input
            type="date"
            value={runToDate}
            min={minDate.toISOString().split("T")[0]}
            onChange={(e) => onRunToDateChange(e.target.value)}
            className="input-dark text-xs rounded-lg px-2 py-1"
          />
        </div>

        {/* Current day label */}
        {status !== "idle" && status !== "complete" && (
          <span className="text-xs ml-auto font-mono" style={{ color: 'var(--text-secondary)' }}>
            Day {currentHorizon} / {maxHorizon - 1}
            {" \u00B7 "}
            {currentDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        )}

        {/* Simulation results summary */}
        {status === "complete" && impactedCount != null && onViewResults && (
          <SimulationResultsSummary impactedCount={impactedCount} onViewResults={onViewResults} />
        )}
      </div>

      {/* Progress bar */}
      {status !== "idle" && (
        <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-100"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, var(--accent-purple), var(--accent-green))`,
            }}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs" style={{ color: 'var(--accent-red)' }}>{error}</p>
      )}
    </div>
  )
}
