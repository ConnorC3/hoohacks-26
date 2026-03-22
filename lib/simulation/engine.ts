/**
 * Pure simulation engine — no React, no side effects.
 *
 * Given user-applied shocks and pre-fetched IRFs, computes the full
 * cumulative price impact on every canvas stock at every time horizon.
 *
 * Two-pass propagation model:
 *
 *   Pass 1 (direct): for each shocked ticker A and each canvas ticker B,
 *     impact_B(h) += shock_A * Σ_{k=1}^{h} irf(A→B, k)
 *     (uses direct A→B IRF if it exists in the DB)
 *
 *   Pass 2 (indirect): for pairs A→B missing a direct IRF, route through
 *     canvas intermediaries M that do have A→M and M→B IRFs:
 *     impact_B(h) += [shock_A * Σ irf(A→M)] * Σ_{k=1}^{h} irf(M→B, k) * INDIRECT_DECAY
 *
 * The indirect pass handles the common case where the pipeline has not yet
 * computed all 250k pairs, so some direct A→B edges are absent.
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

// Discount applied to indirect (2-hop) contributions to avoid double-counting
// and reflect that chained IRFs are an approximation.
const INDIRECT_DECAY = 0.4

export function runSimulation(input: SimulationInput): SimulationOutput {
  const { shocks, irfs, canvasTickers, maxHorizon } = input
  const impacts: Record<string, number[]> = {}

  // ── Pass 1: direct propagation ──────────────────────────────────────────
  for (const target of canvasTickers) {
    const timeline = new Array<number>(maxHorizon).fill(0)

    for (const [source, shockPct] of Object.entries(shocks)) {
      if (source === target) {
        for (let h = 0; h < maxHorizon; h++) timeline[h] += shockPct
        continue
      }

      const irfValues = irfs[source]?.[target]
      if (!irfValues || irfValues.length === 0) continue

      let cumulative = 0
      for (let h = 0; h < maxHorizon; h++) {
        cumulative += (irfValues[h] ?? 0) * shockPct
        timeline[h] += cumulative
      }
    }

    impacts[target] = timeline
  }

  // ── Pass 2: indirect propagation through canvas intermediaries ───────────
  // Only fills gaps where no direct IRF exists for a (source → target) pair.
  for (const [source, shockPct] of Object.entries(shocks)) {
    for (const target of canvasTickers) {
      if (source === target) continue
      // Skip if a non-zero direct IRF already covers this pair.
      // Zero IRFs (stored for k_ar=0 pairs) don't count — indirect paths still apply.
      const directIrfs = irfs[source]?.[target]
      const hasDirectImpact = directIrfs?.some((v) => Math.abs(v) > 1e-10)
      if (hasDirectImpact) continue

      // Try every other canvas node as a 1-hop intermediary
      for (const mid of canvasTickers) {
        if (mid === source || mid === target) continue

        const sourceToMid = irfs[source]?.[mid]
        const midToTarget = irfs[mid]?.[target]
        if (!sourceToMid?.length || !midToTarget?.length) continue

        // Scalar effect of source shock on mid (sum of IRF × shock)
        const midEffect = sourceToMid.reduce((s, v) => s + v, 0) * shockPct

        // Propagate mid's effect to target
        let cumulative = 0
        for (let h = 0; h < maxHorizon; h++) {
          cumulative += (midToTarget[h] ?? 0) * midEffect * INDIRECT_DECAY
          impacts[target][h] += cumulative
        }
      }
    }
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
