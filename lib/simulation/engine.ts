/**
 * Pure simulation engine — no React, no side effects.
 *
 * Given user-applied shocks and pre-fetched IRFs, computes the full
 * cumulative price impact on every canvas stock at every time horizon.
 *
 * Two-pass propagation model using pairwise VAR impulse responses:
 *
 *   Pass 1 (direct): for each shocked ticker A and each canvas ticker B,
 *     impact_B(h) += shock_A * Σ_{k=0}^{h} irf(A→B, k)
 *     Direct bilateral effect via pre-computed IRF.
 *
 *   Pass 2 (network cascade): for each shocked ticker A, iterate ALL ~503
 *     intermediaries M (not just canvas nodes) to propagate 2nd-order effects:
 *       midEffect = shock_A × Σ irf(A→M)            (total effect of A on M)
 *       cascade_B(h) += midEffect × Σ_{k=0}^{h} irf(M→B, k) × CASCADE_DECAY
 *
 *     This captures network transmission: A shocks M, M then influences B.
 *     Since pairwise VARs don't capture multi-hop effects, this cascade
 *     adds genuine network information on top of the direct IRFs.
 *
 *   Uses `incomingIrfs` (IRFs targeting canvas tickers from all ~503 sources)
 *   so that every node in the market can serve as an intermediary.
 */

export interface SimulationInput {
  /** ticker → decimal shock (e.g. -0.10 for -10%) */
  shocks: Record<string, number>
  /** from_ticker → to_ticker → irf_values indexed by horizon-1 (outgoing) */
  irfs: Record<string, Record<string, number[]>>
  /** to_ticker → from_ticker → irf_values indexed by horizon-1 (incoming to canvas) */
  incomingIrfs: Record<string, Record<string, number[]>>
  /** all tickers currently on canvas */
  canvasTickers: string[]
  maxHorizon: number
}

export interface SimulationOutput {
  /** impacts[ticker][horizon] = cumulative % price impact at that horizon (0-indexed) */
  impacts: Record<string, number[]>
}

// Discount for 2nd-order network cascade contributions.
// Kept conservative to avoid overamplification from ~500 intermediary paths.
const CASCADE_DECAY = 0.25

export function runSimulation(input: SimulationInput): SimulationOutput {
  const { shocks, irfs, incomingIrfs, canvasTickers, maxHorizon } = input
  const impacts: Record<string, number[]> = {}

  // Initialize timelines for all canvas tickers
  for (const t of canvasTickers) {
    impacts[t] = new Array<number>(maxHorizon).fill(0)
  }

  // ── Pass 1: Direct propagation from shocks ──────────────────────────────
  for (const target of canvasTickers) {
    for (const [source, shockPct] of Object.entries(shocks)) {
      if (source === target) {
        // Self-shock: constant impact at every horizon
        for (let h = 0; h < maxHorizon; h++) impacts[target][h] += shockPct
        continue
      }

      const irfValues = irfs[source]?.[target]
      if (!irfValues || irfValues.length === 0) continue

      // Cumulative sum of IRF × shock = total price change from t=0 to t=h
      let cumulative = 0
      for (let h = 0; h < maxHorizon; h++) {
        cumulative += (irfValues[h] ?? 0) * shockPct
        impacts[target][h] += cumulative
      }
    }
  }

  // ── Pass 2: Network cascade through ALL ~503 intermediaries ─────────────
  // For pairwise VARs, the direct IRF(A→B) only captures the A-B bilateral
  // relationship. Network effects (A shocks M, M then moves B) are genuine
  // additional information. We add them on top of direct effects.
  //
  // Uses incoming IRFs so that ANY node in the market — not just nodes on
  // canvas — can serve as an intermediary routing influence.
  for (const [source, shockPct] of Object.entries(shocks)) {
    const sourceOutgoing = irfs[source]
    if (!sourceOutgoing) continue

    for (const target of canvasTickers) {
      if (target === source) continue

      const targetIncoming = incomingIrfs[target]
      if (!targetIncoming) continue

      // Iterate ALL intermediaries reachable from the source ticker.
      // sourceOutgoing has entries for all ~503 tickers the source has IRFs to.
      for (const mid of Object.keys(sourceOutgoing)) {
        if (mid === source || mid === target) continue

        const sourceToMid = sourceOutgoing[mid]
        const midToTarget = targetIncoming[mid]
        if (!sourceToMid?.length || !midToTarget?.length) continue

        // Skip intermediaries with noise-level IRFs on either leg
        const hasMeaningfulSource = sourceToMid.some((v) => Math.abs(v) > 1e-8)
        const hasMeaningfulTarget = midToTarget.some((v) => Math.abs(v) > 1e-8)
        if (!hasMeaningfulSource || !hasMeaningfulTarget) continue

        // midEffect: total cumulative effect of the source shock on intermediary M
        // (sum of all IRF values across all horizons × shock magnitude)
        const midEffect = sourceToMid.reduce((s, v) => s + v, 0) * shockPct

        // Skip negligible intermediary effects
        if (Math.abs(midEffect) < 1e-12) continue

        // Propagate M's impact to the target using M→target IRF
        // Cumulative sum gives total price change at each horizon
        let cumulative = 0
        for (let h = 0; h < maxHorizon; h++) {
          cumulative += (midToTarget[h] ?? 0) * midEffect * CASCADE_DECAY
          impacts[target][h] += cumulative
        }
      }
    }
  }

  return { impacts }
}
