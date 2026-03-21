@../../AGENTS.md

# components/graph — Implemented

## Layout
```
┌──────────────┬─────────────────────────┬──────────────┐
│ CompanySidebar│ SandboxCanvas           │NodeDetailPanel│
│ (left, 256px) │ (center, flex-1)        │(right, 288px) │
│               │                         │when selected  │
└──────────────┴─────────────────────────┴──────────────┘
```

## Files
| File | Purpose |
|---|---|
| `constants.ts` | GICS sector color map |
| `CompanySidebar.tsx` | Searchable, scrollable S&P 500 list. Items are draggable. Already-added tickers are dimmed. |
| `SandboxCanvas.tsx` | Cytoscape.js sandbox. Accepts drag-drop, adds nodes at drop position. Draws edges between added nodes. Exposes `addNode` via `forwardRef`. |
| `NodeDetailPanel.tsx` | Right panel for selected node. Shows company stats + portfolio form (shares, cost basis). Computes P&L live. |
| `StockGraph.tsx` | Orchestrator. Owns all state: companies, addedTickers, edges, portfolio, selectedTicker. |

## Data flow
1. On mount: fetch all 500 companies + latest prices
2. User drags ticker from sidebar → drops on canvas → `SandboxCanvas` fires `sandbox:drop` custom event
3. `StockGraph` listens, calls `canvasRef.addNode(company, x, y)` imperatively
4. `addedTickers` set updates → triggers `getEdgesBetween(tickers)` → edges drawn between all added nodes
5. User clicks node → `NodeDetailPanel` opens with portfolio form + live P&L

## Drag and drop
- `CompanySidebar` sets `dataTransfer.setData('ticker', ticker)` on drag start
- `SandboxCanvas` handles `onDragOver` + `onDrop`, fires `sandbox:drop` custom event with ticker + screen coordinates
- `StockGraph` converts screen coordinates to Cytoscape model coordinates via `cy.zoom()` / `cy.pan()`

## Cytoscape notes
- Layout: `preset` — nodes stay exactly where dropped, no auto-layout
- Nodes added/removed imperatively via `cy.add()` / `cy.remove()`
- Edges synced via `useEffect` on `edges` prop — removes all edges then re-adds

## Next steps
- [ ] Phase 4: Simulation engine — shock input on selected node, VAR IRF playback, speed + "run to" date controls
- [ ] Enhancement: highlight connected edges on node hover/select
- [ ] Enhancement: price sparkline in NodeDetailPanel
