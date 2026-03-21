"""
Step 2: Compute daily log returns from adj_close prices and upsert to Supabase.

  log_return(t) = ln(adj_close(t) / adj_close(t-1))

Tables read:   daily_prices
Tables written: daily_returns
"""

import numpy as np
import pandas as pd
from tqdm import tqdm

from config import BATCH_SIZE
from db import get_client


def load_prices(ticker: str) -> pd.DataFrame:
    client = get_client()
    resp = (
        client.table("daily_prices")
        .select("date, adj_close")
        .eq("ticker", ticker)
        .order("date")
        .execute()
    )
    return pd.DataFrame(resp.data)


def compute_log_returns(prices_df: pd.DataFrame) -> pd.DataFrame:
    df = prices_df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").dropna(subset=["adj_close"])
    df["log_return"] = np.log(df["adj_close"] / df["adj_close"].shift(1))
    return df.dropna(subset=["log_return"])[["date", "log_return"]]


def upsert_returns(ticker: str, returns_df: pd.DataFrame) -> None:
    client = get_client()
    records = returns_df.copy()
    records["ticker"] = ticker
    records["date"] = records["date"].astype(str)
    rows = records[["ticker", "date", "log_return"]].to_dict(orient="records")
    for i in range(0, len(rows), BATCH_SIZE):
        client.table("daily_returns").upsert(rows[i:i + BATCH_SIZE]).execute()


def get_all_tickers() -> list[str]:
    client = get_client()
    resp = client.table("companies").select("ticker").execute()
    return [r["ticker"] for r in resp.data]


def run() -> None:
    print("=== Step 2: Computing log returns ===")
    tickers = get_all_tickers()
    print(f"  Processing {len(tickers)} tickers...")

    for ticker in tqdm(tickers, desc="Computing returns"):
        try:
            prices = load_prices(ticker)
            if prices.empty:
                print(f"  [WARN] No prices for {ticker}, skipping.")
                continue
            returns = compute_log_returns(prices)
            if returns.empty:
                print(f"  [WARN] No returns computed for {ticker}, skipping.")
                continue
            upsert_returns(ticker, returns)
        except Exception as e:
            print(f"  [ERROR] {ticker}: {e}")

    print("=== Step 2 complete ===\n")


if __name__ == "__main__":
    run()
