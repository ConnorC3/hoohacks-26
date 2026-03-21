"use client"

import { SPEED_OPTIONS, SimulationStatus } from "./useSimulation"

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
}: Props) {
  const progress = maxHorizon > 0 ? (currentHorizon / (maxHorizon - 1)) * 100 : 0
  const today = new Date()
  const currentDate = new Date(today)
  currentDate.setDate(today.getDate() + Math.round(currentHorizon / 0.71))
  const minDate = new Date(today)
  minDate.setDate(today.getDate() + 2)

  return (
    <div className="flex flex-col gap-2 px-4 py-3 bg-zinc-900 border-b border-zinc-700">
      <div className="flex items-center gap-4 flex-wrap">

        {/* Play / Pause / Resume / Reset */}
        <div className="flex items-center gap-2">
          {status === "idle" || status === "complete" ? (
            <button
              onClick={onPlay}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded transition-colors"
            >
              {loading ? "Loading IRFs…" : "▶ Run Simulation"}
            </button>
          ) : status === "running" ? (
            <button
              onClick={onPause}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-medium rounded transition-colors"
            >
              ⏸ Pause
            </button>
          ) : (
            <button
              onClick={onResume}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded transition-colors"
            >
              ▶ Resume
            </button>
          )}

          {status !== "idle" && (
            <button
              onClick={onReset}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded transition-colors"
            >
              ↺ Reset
            </button>
          )}
        </div>

        {/* Speed selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500 text-xs">Speed:</span>
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.ms}
              onClick={() => onSpeedChange(opt.ms)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                speed === opt.ms
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Run-to date */}
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500 text-xs">Run to:</span>
          <input
            type="date"
            value={runToDate}
            min={minDate.toISOString().split("T")[0]}
            onChange={(e) => onRunToDateChange(e.target.value)}
            className="bg-zinc-800 text-white text-xs rounded px-2 py-1 border border-zinc-700 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Current day label */}
        {status !== "idle" && (
          <span className="text-zinc-400 text-xs ml-auto">
            Day {currentHorizon} / {maxHorizon - 1}
            {" · "}
            {currentDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {status !== "idle" && (
        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-red-400 text-xs">{error}</p>
      )}
    </div>
  )
}
