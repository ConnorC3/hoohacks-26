@../../AGENTS.md

# lib/supabase — Implemented

## Files
| File | Purpose |
|---|---|
| `client.ts` | Supabase browser client singleton (anon key, read-only) |
| `types.ts` | TypeScript interfaces for all DB tables + frontend-derived types (`GraphNode`, `GraphEdge`) |
| `queries.ts` | Query helpers consumed by the frontend |

## Key queries
| Function | Returns | Used by |
|---|---|---|
| `getGraphNodes()` | All 500 companies with latest price | Graph renderer |
| `getGraphEdges(filters?)` | Aggregated directed edges with weight + p-value | Graph renderer |
| `getImpulseResponses(fromTicker)` | IRF map for a shocked stock | Simulation engine |
| `getLatestPrices()` | ticker → latest adj_close | Graph nodes |
| `getPriceHistory(ticker)` | Full OHLCV history for one stock | Side panel chart |
| `getCompany(ticker)` | Single company metadata | Side panel |

## Edge aggregation
`getGraphEdges` aggregates per-lag `influence_edges` rows into one edge per (from, to) pair:
- `total_weight` = sum of |coefficient| across all lags
- `min_p_value` = most significant p-value across all lags
- Supports filtering by `minWeight`, `maxPValue`, and `sectors`

## Next steps
- [ ] Phase 3: consume `getGraphNodes()` and `getGraphEdges()` in Cytoscape.js graph component
- [ ] Phase 4: consume `getImpulseResponses()` in simulation engine
- [ ] Phase 5: consume `getPriceHistory()` and `getCompany()` in side panel
