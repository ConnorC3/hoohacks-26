"use client"

interface Props {
  impactedCount: number
  onViewResults: () => void
}

export default function SimulationResultsSummary({ impactedCount, onViewResults }: Props) {
  return (
    <div className="flex items-center gap-3 ml-auto" style={{ animation: "fade-in-up 0.3s ease-out" }}>
      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
        Simulation complete — {impactedCount} stock{impactedCount !== 1 ? "s" : ""} impacted
      </span>
      <button
        onClick={onViewResults}
        className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200"
        style={{
          background: "var(--accent-purple)",
          color: "white",
          boxShadow: "0 0 15px rgba(123, 97, 255, 0.3)",
          animation: "pulse-glow 2s ease-in-out infinite",
        }}
      >
        View Results
      </button>
    </div>
  )
}
