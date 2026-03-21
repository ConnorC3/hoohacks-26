/**
 * Pure simulation engine — no React, no side effects.
 *
 * Given user-applied shocks and pre-fetched IRFs, computes the full
 * cumulative price impact on every canvas stock at every time horizon.
 *
 * Impact model:
 *   impact_B(h) = Σ_A [ shock_A * Σ_{k=1}^{h} irf(A→B, k) ]
 *
 * Where:
 *   shock_A     = user-specified return shock on stock A (e.g. -0.10 for -10%)
 *   irf(A→B, k) = pre-computed IRF value: response of B's return to unit shock in A at lag k
 *   impact_B(h) = cumulative % price change of B after h days
 */

export interface SimulationInput {
  /** ticker → decimal shock (e.g. -0.10 for -10%) */
  shocks: Record<string, number>
  /** from_ticker → to_ticker → irf_values indexed by horizon-1 */
  irfs: Record<string, Record<string, number[]>>
  /** all tickers currently on canvas */
  canvasTickers: string[]
  maxHorizon: number
}

export interface SimulationOutput {
  /** impacts[ticker][horizon] = cumulative % price impact at that horizon (0-indexed) */
  impacts: Record<string, number[]>
}

export function runSimulation(input: SimulationInput): SimulationOutput {
  const { shocks, irfs, canvasTickers, maxHorizon } = input
  const impacts: Record<string, number[]> = {}

  for (const target of canvasTickers) {
    const timeline = new Array<number>(maxHorizon).fill(0)

    for (const [source, shockPct] of Object.entries(shocks)) {
      if (source === target) {
        // Direct shock — persists at full magnitude throughout horizon
        for (let h = 0; h < maxHorizon; h++) {
          timeline[h] += shockPct
        }
        continue
      }

      const irfValues = irfs[source]?.[target]
      if (!irfValues || irfValues.length === 0) continue

      // Accumulate IRF contributions across horizons
      let cumulative = 0
      for (let h = 0; h < maxHorizon; h++) {
        cumulative += (irfValues[h] ?? 0) * shockPct
        timeline[h] += cumulative
      }
    }

    impacts[target] = timeline
  }

  return { impacts }
}

/** Convert a run-to date string to a horizon count (capped at maxHorizon). */
export function dateToHorizon(runToDate: string, maxHorizon: number): number {
  if (!runToDate) return maxHorizon
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(runToDate)
  target.setHours(0, 0, 0, 0)
  const calendarDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  // Approximate trading days (×0.71) — capped between 1 and maxHorizon
  const tradingDays = Math.round(calendarDays * 0.71)
  return Math.max(1, Math.min(tradingDays, maxHorizon))
}
