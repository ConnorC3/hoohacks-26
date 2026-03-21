"""
Global constants for the pipeline.
"""

# Historical data
LOOKBACK_YEARS = 3
PRICE_INTERVAL = "1d"  # daily OHLCV

# VAR model
VAR_MAX_LAGS = 5        # AIC selects optimal lag <= this
IRF_HORIZON = 20        # impulse response periods (days) to pre-compute
MIN_OBSERVATIONS = 100  # minimum non-null return observations required to fit VAR

# Parallelism
NUM_WORKERS = -1        # -1 = all available CPU cores (joblib convention)
BATCH_SIZE = 500        # pairs per DB upsert batch

# S&P 500 ticker source
SP500_WIKI_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
