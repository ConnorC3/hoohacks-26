@../AGENTS.md

# Pipeline — Implemented

## What this does
Standalone Python pipeline that populates Supabase with all data needed by the simulation engine. Runs independently of Next.js.

## Files
| File | Purpose |
|---|---|
| `schema.sql` | Run once in Supabase SQL editor to create all tables, indexes, and RLS policies |
| `config.py` | Global constants (lookback window, VAR lag order, IRF horizon, parallelism) |
| `db.py` | Supabase client singleton (reads `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` from `.env`) |
| `fetch_prices.py` | Step 1 — scrapes S&P 500 tickers from Wikipedia, fetches 3yr OHLCV via yfinance, upserts `companies` + `daily_prices` |
| `compute_returns.py` | Step 2 — computes log returns from `daily_prices`, upserts `daily_returns` |
| `compute_var.py` | Step 3 — fits pairwise bivariate VAR for all ~250k directed pairs, upserts `influence_edges` + `impulse_responses`. Resumable. |
| `run.py` | Orchestrator — `python run.py` runs all steps; `--step prices/returns/var` runs one |

## Setup
```bash
cd pipeline
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.local.example .env.local
# Fill in SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.local
```

## Running
```bash
# Full pipeline (takes hours for Step 3)
python run.py

# Individual steps (Step 3 is resumable — safe to interrupt and re-run)
python run.py --step prices
python run.py --step returns
python run.py --step var
```

## Key design decisions
- **Pairwise bivariate VAR** — full 500-stock VAR is intractable (~250k params/lag). Each directed pair is fit independently.
- **Pre-computed IRFs** — impulse response functions stored in `impulse_responses` so the sim engine does a DB lookup, not real-time VAR fitting.
- **Resumable Step 3** — already-computed pairs are skipped on re-run.
- **Parallelism** — Step 3 uses `joblib.Parallel` with all available CPU cores.
- **No frontend writes** — Next.js uses anon key (read-only). Pipeline uses service role key.

## Next steps
- [ ] Add `.env` file with real Supabase credentials (user provides keys)
- [ ] Run `schema.sql` in Supabase SQL editor
- [ ] Run `python run.py --step prices` and validate data in Supabase
- [ ] Run `python run.py --step returns` and validate
- [ ] Run `python run.py --step var` (long-running, can be interrupted and resumed)
- [ ] After data is validated, begin Phase 2: Next.js data layer
