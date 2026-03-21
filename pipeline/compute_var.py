"""
Step 3: Fit pairwise bivariate VAR models for all directed pairs of S&P 500 stocks.
        Pre-compute impulse response functions (IRFs) for each pair.

For each directed pair (A, B):
  - Fit bivariate VAR([r_A, r_B], maxlags=VAR_MAX_LAGS, ic='aic')
  - Store lag coefficients for A→B in influence_edges
  - Store IRF values at horizons 1..IRF_HORIZON in impulse_responses

This step is the most compute-intensive (~250k pairs). It is resumable:
  already-computed (from_ticker, to_ticker) pairs are skipped.

Tables read:   daily_returns, companies
Tables written: influence_edges, impulse_responses
"""

import datetime
import warnings
from itertools import permutations

import numpy as np
import pandas as pd
from joblib import Parallel, delayed
from statsmodels.tsa.vector_ar.var_model import VAR
from tqdm import tqdm

from config import (
    BATCH_SIZE,
    IRF_HORIZON,
    MIN_OBSERVATIONS,
    NUM_WORKERS,
    VAR_MAX_LAGS,
)
from db import get_client

warnings.filterwarnings("ignore")


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_all_returns() -> pd.DataFrame:
    """
    Load all daily_returns from Supabase into a wide DataFrame (date × ticker).
    Uses pagination to handle >1000 row Supabase limit.
    """
    client = get_client()
    rows = []
    page_size = 1000
    offset = 0
    while True:
        resp = (
            client.table("daily_returns")
            .select("ticker, date, log_return")
            .order("date")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = resp.data
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    wide = df.pivot(index="date", columns="ticker", values="log_return")
    return wide.sort_index()


def get_all_tickers() -> list[str]:
    client = get_client()
    resp = client.table("companies").select("ticker").execute()
    return [r["ticker"] for r in resp.data]


def get_completed_pairs() -> set[tuple[str, str]]:
    """Return set of (from_ticker, to_ticker) already in influence_edges."""
    client = get_client()
    rows = []
    page_size = 1000
    offset = 0
    while True:
        resp = (
            client.table("influence_edges")
            .select("from_ticker, to_ticker")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = resp.data
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return {(r["from_ticker"], r["to_ticker"]) for r in rows}


# ---------------------------------------------------------------------------
# VAR fitting
# ---------------------------------------------------------------------------

def fit_pair(
    from_ticker: str,
    to_ticker: str,
    returns_wide: pd.DataFrame,
) -> tuple[list[dict], list[dict]] | None:
    """
    Fit a bivariate VAR on [from_ticker, to_ticker] returns.
    Returns (edge_records, irf_records) or None if fitting fails.

    Edge record fields:
      from_ticker, to_ticker, lag, coefficient, p_value, computed_at

    IRF record fields:
      from_ticker, to_ticker, horizon, irf_value, computed_at
    """
    try:
        # Align and drop NaNs
        series = returns_wide[[from_ticker, to_ticker]].dropna()
        if len(series) < MIN_OBSERVATIONS:
            return None

        model = VAR(series)
        result = model.fit(maxlags=VAR_MAX_LAGS, ic="aic", trend="c")

        now = datetime.datetime.utcnow().isoformat()
        p = result.k_ar  # selected lag order

        # --- influence_edges: one row per lag ---
        edge_records = []
        for lag in range(1, p + 1):
            # Coefficient matrix for this lag: shape (2, 2)
            # Layout: coef_matrices[lag-1][equation_idx, variable_idx]
            # equation 1 (to_ticker), variable 0 (from_ticker) = A→B influence
            coef_matrix = result.coefs[lag - 1]          # (2, 2)
            coef = float(coef_matrix[1, 0])               # to_ticker eq, from_ticker var

            # p-value for the same position
            pval_matrix = result.pvalues                  # DataFrame (2*p+1, 2)
            row_label = f"L{lag}.{from_ticker}"
            try:
                pval = float(pval_matrix.loc[row_label, to_ticker])
            except KeyError:
                pval = None

            edge_records.append({
                "from_ticker": from_ticker,
                "to_ticker": to_ticker,
                "lag": lag,
                "coefficient": coef,
                "p_value": pval,
                "computed_at": now,
            })

        # --- impulse_responses: orthogonalized IRF ---
        irf = result.irf(periods=IRF_HORIZON)
        # irf.irfs shape: (horizon+1, n_vars, n_vars)
        # irf.irfs[h, 1, 0] = response of to_ticker to shock in from_ticker at horizon h
        irf_records = []
        for h in range(1, IRF_HORIZON + 1):
            irf_records.append({
                "from_ticker": from_ticker,
                "to_ticker": to_ticker,
                "horizon": h,
                "irf_value": float(irf.irfs[h, 1, 0]),
                "computed_at": now,
            })

        return edge_records, irf_records

    except Exception:
        return None


# ---------------------------------------------------------------------------
# Batch upsert helpers
# ---------------------------------------------------------------------------

def upsert_edges(records: list[dict]) -> None:
    client = get_client()
    for i in range(0, len(records), BATCH_SIZE):
        client.table("influence_edges").upsert(records[i:i + BATCH_SIZE]).execute()


def upsert_irfs(records: list[dict]) -> None:
    client = get_client()
    for i in range(0, len(records), BATCH_SIZE):
        client.table("impulse_responses").upsert(records[i:i + BATCH_SIZE]).execute()


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def run() -> None:
    print("=== Step 3: Computing pairwise VAR models and IRFs ===")

    print("  Loading all return series into memory...")
    returns_wide = load_all_returns()
    tickers = [t for t in get_all_tickers() if t in returns_wide.columns]
    print(f"  {len(tickers)} tickers with return data.")

    all_pairs = list(permutations(tickers, 2))
    print(f"  Total directed pairs: {len(all_pairs):,}")

    print("  Checking for already-completed pairs (resumability)...")
    completed = get_completed_pairs()
    remaining = [(a, b) for a, b in all_pairs if (a, b) not in completed]
    print(f"  Remaining pairs: {len(remaining):,}  (skipping {len(completed):,})")

    if not remaining:
        print("  All pairs already computed. Nothing to do.")
        print("=== Step 3 complete ===\n")
        return

    # Process in chunks so we can upsert incrementally and not hold everything in RAM
    chunk_size = 1000
    all_edge_records: list[dict] = []
    all_irf_records: list[dict] = []

    for chunk_start in tqdm(range(0, len(remaining), chunk_size), desc="VAR chunks"):
        chunk = remaining[chunk_start:chunk_start + chunk_size]

        results = Parallel(n_jobs=NUM_WORKERS, prefer="threads")(
            delayed(fit_pair)(a, b, returns_wide) for a, b in chunk
        )

        for res in results:
            if res is None:
                continue
            edges, irfs = res
            all_edge_records.extend(edges)
            all_irf_records.extend(irfs)

        # Upsert accumulated records and clear buffers
        if all_edge_records:
            upsert_edges(all_edge_records)
            all_edge_records = []
        if all_irf_records:
            upsert_irfs(all_irf_records)
            all_irf_records = []

    print("=== Step 3 complete ===\n")


if __name__ == "__main__":
    run()
