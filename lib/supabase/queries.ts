import { supabase } from "./client"
import type { Company, DailyPrice, ImpulseResponse, GraphEdge, GraphNode } from "./types"

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export async function getAllCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("ticker")

  if (error) throw error
  return data
}

export async function getCompany(ticker: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("ticker", ticker)
    .single()

  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------

export async function getLatestPrices(): Promise<Record<string, number>> {
  // Fetch the single most recent date available across all tickers
  const { data: dateRow, error: dateError } = await supabase
    .from("daily_prices")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .single()

  if (dateError) throw dateError

  const { data, error } = await supabase
    .from("daily_prices")
    .select("ticker, adj_close")
    .eq("date", dateRow.date)

  if (error) throw error

  return Object.fromEntries(
    data.filter((r) => r.adj_close !== null).map((r) => [r.ticker, r.adj_close as number])
  )
}

export async function getPriceHistory(ticker: string): Promise<DailyPrice[]> {
  const { data, error } = await supabase
    .from("daily_prices")
    .select("*")
    .eq("ticker", ticker)
    .order("date")

  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

/**
 * Fetch all companies with their latest price attached.
 * Used to populate graph nodes.
 */
export async function getGraphNodes(): Promise<GraphNode[]> {
  const [companies, latestPrices] = await Promise.all([
    getAllCompanies(),
    getLatestPrices(),
  ])

  return companies.map((c) => ({
    ...c,
    latest_price: latestPrices[c.ticker] ?? null,
  }))
}

/**
 * Fetch aggregated influence edges for graph rendering.
 * Returns one edge per (from, to) pair with total_weight and min_p_value.
 *
 * Filters:
 *   minWeight   — exclude edges where total_weight < minWeight
 *   maxPValue   — exclude edges where min_p_value > maxPValue (significance filter)
 *   sectors     — if provided, only include edges where both endpoints are in these sectors
 */
export async function getGraphEdges(filters?: {
  minWeight?: number
  maxPValue?: number
  sectors?: string[]
}): Promise<GraphEdge[]> {
  let query = supabase
    .from("influence_edges")
    .select("from_ticker, to_ticker, coefficient, p_value")

  if (filters?.maxPValue !== undefined) {
    query = query.lte("p_value", filters.maxPValue)
  }

  const { data, error } = await query
  if (error) throw error

  // Aggregate per (from, to) pair in JS — signed sum + abs sum, track min p_value
  const map = new Map<string, GraphEdge>()
  for (const row of data) {
    const key = `${row.from_ticker}__${row.to_ticker}`
    const existing = map.get(key)
    if (existing) {
      existing.total_weight += Math.abs(row.coefficient)
      existing.net_weight += row.coefficient
      if (row.p_value !== null) {
        existing.min_p_value =
          existing.min_p_value === null
            ? row.p_value
            : Math.min(existing.min_p_value, row.p_value)
      }
    } else {
      map.set(key, {
        from_ticker: row.from_ticker,
        to_ticker: row.to_ticker,
        total_weight: Math.abs(row.coefficient),
        net_weight: row.coefficient,
        min_p_value: row.p_value,
      })
    }
  }

  let edges = Array.from(map.values())

  if (filters?.minWeight !== undefined) {
    edges = edges.filter((e) => e.total_weight >= filters.minWeight!)
  }

  return edges
}

/**
 * Fetch aggregated influence edges between a specific set of tickers only.
 * Used by the sandbox — only draws edges between nodes the user has added.
 */
export async function getEdgesBetween(tickers: string[]): Promise<GraphEdge[]> {
  if (tickers.length < 2) return []

  const { data, error } = await supabase
    .from("influence_edges")
    .select("from_ticker, to_ticker, coefficient, p_value")
    .in("from_ticker", tickers)
    .in("to_ticker", tickers)

  if (error) throw error

  const map = new Map<string, GraphEdge>()
  for (const row of data) {
    const key = `${row.from_ticker}__${row.to_ticker}`
    const existing = map.get(key)
    if (existing) {
      existing.total_weight += Math.abs(row.coefficient)
      existing.net_weight += row.coefficient
      if (row.p_value !== null) {
        existing.min_p_value =
          existing.min_p_value === null
            ? row.p_value
            : Math.min(existing.min_p_value, row.p_value)
      }
    } else {
      map.set(key, {
        from_ticker: row.from_ticker,
        to_ticker: row.to_ticker,
        total_weight: Math.abs(row.coefficient),
        net_weight: row.coefficient,
        min_p_value: row.p_value,
      })
    }
  }

  return Array.from(map.values())
}

// ---------------------------------------------------------------------------
// Impulse responses (used by simulation engine)
// ---------------------------------------------------------------------------

/**
 * Fetch all pre-computed IRF values for a given shock origin ticker.
 * Returns a map: to_ticker → irf_value[] (indexed by horizon 1..N)
 */
export async function getImpulseResponses(
  fromTicker: string
): Promise<Record<string, number[]>> {
  const { data, error } = await supabase
    .from("impulse_responses")
    .select("to_ticker, horizon, irf_value")
    .eq("from_ticker", fromTicker)
    .order("horizon")

  if (error) throw error

  const result: Record<string, number[]> = {}
  for (const row of data) {
    if (!result[row.to_ticker]) result[row.to_ticker] = []
    result[row.to_ticker][row.horizon - 1] = row.irf_value
  }
  return result
}

// ---------------------------------------------------------------------------
// Return statistics (used by risk analysis)
// ---------------------------------------------------------------------------

/**
 * Fetch daily log returns for a set of tickers and compute per-ticker stats.
 * Returns annualised std dev (daily stdDev × √252) and annualised mean.
 */
export async function getReturnStats(
  tickers: string[]
): Promise<Record<string, { stdDev: number; mean: number; count: number }>> {
  if (tickers.length === 0) return {}

  const rows: { ticker: string; log_return: number }[] = []
  const pageSize = 1000
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from("daily_returns")
      .select("ticker, log_return")
      .in("ticker", tickers)
      .range(offset, offset + pageSize - 1)

    if (error) throw error
    if (!data.length) break
    rows.push(...data)
    if (data.length < pageSize) break
    offset += pageSize
  }

  const grouped: Record<string, number[]> = {}
  for (const row of rows) {
    if (!grouped[row.ticker]) grouped[row.ticker] = []
    grouped[row.ticker].push(row.log_return)
  }

  const result: Record<string, { stdDev: number; mean: number; count: number }> = {}
  for (const [ticker, returns] of Object.entries(grouped)) {
    const count = returns.length
    const mean = returns.reduce((s, r) => s + r, 0) / count
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (count - 1)
    result[ticker] = {
      stdDev: Math.sqrt(variance) * Math.sqrt(252), // annualised
      mean: mean * 252,                             // annualised
      count,
    }
  }

  return result
}

/**
 * Fetch all pre-computed IRF values TARGETING a given ticker (from any source).
 * Returns a map: from_ticker → irf_value[] (indexed by horizon 1..N)
 *
 * Used by the simulation engine to allow all ~503 nodes to serve as
 * intermediaries when propagating shocks to canvas targets.
 */
export async function getIncomingImpulseResponses(
  toTicker: string
): Promise<Record<string, number[]>> {
  // Up to 503 sources × 20 horizons ≈ 10k rows
  const { data, error } = await supabase
    .from("impulse_responses")
    .select("from_ticker, horizon, irf_value")
    .eq("to_ticker", toTicker)
    .order("horizon")
    .limit(15000)

  if (error) throw error

  const result: Record<string, number[]> = {}
  for (const row of data) {
    if (!result[row.from_ticker]) result[row.from_ticker] = []
    result[row.from_ticker][row.horizon - 1] = row.irf_value
  }
  return result
}
