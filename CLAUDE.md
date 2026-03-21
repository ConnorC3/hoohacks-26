@AGENTS.md

# Stock Simulator

A Next.js 16 app where users simulate how a price shock to one S&P 500 stock propagates through their portfolio via a directed weighted influence graph.

## Architecture overview
```
yfinance → historical prices → log returns → pairwise VAR → influence graph → simulation engine
                ↓
           Supabase DB
                ↓
         Next.js frontend (Cytoscape.js sandbox + VAR impulse response sim)
```

## Tech stack
| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Graph visualization | Cytoscape.js (`react-cytoscapejs`) |
| Database | Supabase (Postgres) |
| Data pipeline | Python (`yfinance`, `statsmodels`, `joblib`) |
| Simulation model | Pre-computed pairwise VAR impulse response functions |

## Project structure
```
/app                    — Next.js App Router pages
/components/graph       — All graph UI components
  CompanySidebar.tsx    — Searchable S&P 500 list, drag source
  SandboxCanvas.tsx     — Cytoscape.js canvas, drop target
  NodeDetailPanel.tsx   — Persistent right panel, tabs + portfolio form
  StockGraph.tsx        — Top-level orchestrator, owns all state
  constants.ts          — Sector colors, default filter values
/lib/supabase           — Supabase client, types, query helpers
/pipeline               — Python data pipeline (runs independently)
  schema.sql            — Run once in Supabase SQL editor
  run.py                — Pipeline entry point
```

## Build phases
| Phase | Status | Description |
|---|---|---|
| 1 — Python pipeline | **Done** | Fetches prices, computes returns, fits VAR models, stores IRFs in Supabase |
| 2 — Next.js data layer | **Done** | Supabase client, typed queries, env setup |
| 3 — Graph UI | **Done** | Drag-drop sandbox, node detail panel, portfolio form |
| 4 — Simulation engine | **Done** | VAR IRF playback at variable speed, "run to" date, node color by impact |
| 5 — P&L overlay | Not started | P&L computed from portfolio inputs shown on graph nodes |

## Current next steps
1. Phase 5: P&L overlay — colour nodes by gain/loss based on portfolio inputs + simulated price changes

## How the UI works (Phase 3)
1. Left sidebar lists all 503 S&P 500 companies, searchable by ticker or name
2. User drags a company onto the center canvas — it appears as a node at the drop position
3. Dragging a second company draws the influence edge(s) between them automatically
4. Already-added companies are dimmed in the sidebar
5. Right panel is always visible:
   - **No selection**: shows empty state prompt
   - **Node selected**: shows two tabs
     - *Overview*: company name, latest price, market cap, sector, industry
     - *Investment*: survey-style form (shares owned, cost basis, purchase date, notes) with live P&L summary

## Key implementation notes

### Cytoscape + Next.js
- `SandboxCanvas` is loaded via `next/dynamic` with `ssr: false` from `StockGraph`
- `CytoscapeComponent` is imported directly inside `SandboxCanvas` (safe because the parent is already client-only)
- `cy.removeAllListeners()` is called before re-registering tap handlers on each render to prevent duplicate handlers
- Elements are passed declaratively via the `elements` prop (not imperatively via `cy.add()`) so nodes survive re-renders
- Layout is `preset` — nodes stay exactly where the user dropped them

### Drag and drop
- `CompanySidebar` sets `dataTransfer.setData('ticker', ticker)` on drag start
- `SandboxCanvas` handles `onDrop`, converts screen → Cytoscape model coordinates using `cy.zoom()` / `cy.pan()`
- Drop position is stored in `StockGraph` state as `CanvasNode[]` with `{ticker, sector, name, position}`

### State ownership (`StockGraph`)
- `canvasNodes: CanvasNode[]` — nodes currently on canvas (with positions)
- `edges: GraphEdge[]` — influence edges between canvas nodes, re-fetched when nodes change
- `selectedTicker: string | null` — currently selected node
- `portfolio: Record<string, PortfolioEntry>` — per-ticker investment data
- `companies: Company[]` — full S&P 500 list (used for sidebar + company lookup)
- `latestPrices: Record<string, number>` — latest adj_close per ticker

## Environment variables
Both `pipeline/.env.local` and root `.env.local` must contain:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=...
SUPABASE_SERVICE_KEY=...        # pipeline only, not needed by Next.js
```

## Supabase tables
| Table | Description |
|---|---|
| `companies` | S&P 500 metadata (ticker, name, sector, industry) |
| `daily_prices` | 3yr daily OHLCV from yfinance |
| `daily_returns` | Pre-computed log returns |
| `influence_edges` | Directed VAR coefficients (A→B ≠ B→A), all pairs, per lag |
| `impulse_responses` | Pre-computed IRF values at horizons 1–20 days, all pairs |
