export interface Company {
  ticker: string
  name: string
  sector: string | null
  industry: string | null
  market_cap: number | null
  updated_at: string | null
}

export interface DailyPrice {
  ticker: string
  date: string
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  adj_close: number | null
  volume: number | null
}

export interface DailyReturn {
  ticker: string
  date: string
  log_return: number
}

export interface InfluenceEdge {
  from_ticker: string
  to_ticker: string
  lag: number
  coefficient: number
  p_value: number | null
  computed_at: string
}

export interface ImpulseResponse {
  from_ticker: string
  to_ticker: string
  horizon: number
  irf_value: number
  computed_at: string
}

// Derived types used by the frontend

export interface GraphNode extends Company {
  // Latest adj_close price, populated at query time
  latest_price: number | null
}

export interface GraphEdge {
  from_ticker: string
  to_ticker: string
  // Sum of absolute coefficients across all lags — used for edge thickness
  total_weight: number
  // Signed sum of coefficients across all lags — used for display label & color
  net_weight: number
  // Minimum p-value across lags — used for significance filtering
  min_p_value: number | null
}
