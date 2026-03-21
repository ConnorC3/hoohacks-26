"""
Step 1: Fetch S&P 500 company metadata and historical OHLCV prices from yfinance,
        then upsert into Supabase.

Tables written:
  - companies
  - daily_prices
"""

import time
import datetime
import pandas as pd
import yfinance as yf
import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

from config import LOOKBACK_YEARS, PRICE_INTERVAL, SP500_WIKI_URL, BATCH_SIZE
from db import get_client

# Seconds to wait between individual ticker downloads (success or failure)
TICKER_SLEEP = 0.5
# Retry attempts on rate limit error
MAX_RETRIES = 3


def fetch_sp500_tickers() -> pd.DataFrame:
    """
    Scrape S&P 500 company list from Wikipedia.
    Returns DataFrame with columns: ticker, name, sector, industry.
    """
    resp = requests.get(SP500_WIKI_URL, headers={"User-Agent": "Mozilla/5.0"})
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")
    table = soup.find("table", {"id": "constituents"})
    df = pd.read_html(str(table))[0]
    df = df.rename(columns={
        "Symbol": "ticker",
        "Security": "name",
        "GICS Sector": "sector",
        "GICS Sub-Industry": "industry",
    })
    # Wikipedia uses '.' in tickers (e.g. BRK.B); yfinance uses '-'
    df["ticker"] = df["ticker"].str.replace(".", "-", regex=False)
    return df[["ticker", "name", "sector", "industry"]]


def upsert_companies(df: pd.DataFrame) -> None:
    client = get_client()
    records = df.to_dict(orient="records")
    for i in range(0, len(records), BATCH_SIZE):
        client.table("companies").upsert(records[i:i + BATCH_SIZE]).execute()
    print(f"  Upserted {len(records)} companies.")


def download_ticker_with_retry(
    ticker: str,
    start: str,
    end: str,
    attempt: int = 0,
) -> pd.DataFrame | None:
    try:
        raw = yf.download(
            ticker,
            start=start,
            end=end,
            interval=PRICE_INTERVAL,
            auto_adjust=False,
            progress=False,
            threads=False,
        )
        return raw if not raw.empty else None
    except Exception as e:
        if attempt < MAX_RETRIES:
            wait = 30 * (attempt + 1)
            print(f"\n  [RATE LIMIT] {ticker} — waiting {wait}s (retry {attempt + 1}/{MAX_RETRIES})...")
            time.sleep(wait)
            return download_ticker_with_retry(ticker, start, end, attempt + 1)
        print(f"\n  [ERROR] {ticker} failed after {MAX_RETRIES} retries: {e}")
        return None


def fetch_and_upsert_prices(tickers: list[str]) -> None:
    client = get_client()
    end = datetime.date.today()
    start = end - datetime.timedelta(days=LOOKBACK_YEARS * 365 + 30)

    # Check which tickers are already in the DB (resumability)
    resp = client.table("daily_prices").select("ticker").execute()
    done = {r["ticker"] for r in resp.data}
    remaining = [t for t in tickers if t not in done]
    print(f"  {len(done)} already in DB, {len(remaining)} remaining.")

    for ticker in tqdm(remaining, desc="Fetching prices"):
        try:
            raw = download_ticker_with_retry(ticker, start.isoformat(), end.isoformat())

            if raw is not None:
                if isinstance(raw.columns, pd.MultiIndex):
                    raw.columns = raw.columns.get_level_values(0)

                raw = raw.reset_index().rename(columns={
                    "Date": "date",
                    "Open": "open",
                    "High": "high",
                    "Low": "low",
                    "Close": "close",
                    "Adj Close": "adj_close",
                    "Volume": "volume",
                })
                raw["ticker"] = ticker
                raw["date"] = raw["date"].astype(str)
                raw = raw.dropna(subset=["adj_close"])

                records = raw[["ticker", "date", "open", "high", "low", "close", "adj_close", "volume"]].to_dict(orient="records")
                for i in range(0, len(records), BATCH_SIZE):
                    client.table("daily_prices").upsert(records[i:i + BATCH_SIZE]).execute()
        finally:
            # Always sleep — even on failure — to avoid cascading rate limit errors
            time.sleep(TICKER_SLEEP)


def run() -> None:
    print("=== Step 1: Fetching S&P 500 metadata and prices ===")

    print("Fetching S&P 500 ticker list from Wikipedia...")
    companies_df = fetch_sp500_tickers()
    print(f"  Found {len(companies_df)} companies.")

    print("Upserting company metadata...")
    upsert_companies(companies_df)

    print("Fetching and upserting historical prices...")
    fetch_and_upsert_prices(companies_df["ticker"].tolist())

    print("=== Step 1 complete ===\n")


if __name__ == "__main__":
    run()
