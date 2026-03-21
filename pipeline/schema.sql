-- ============================================================
-- Stock Simulator — Supabase Schema
-- Run this in the Supabase SQL editor before executing the pipeline.
-- ============================================================

-- ----------------------------------------------------------------
-- companies
-- ----------------------------------------------------------------
create table if not exists companies (
  ticker      text primary key,
  name        text not null,
  sector      text,
  industry    text,
  market_cap  bigint,
  updated_at  timestamptz default now()
);

-- ----------------------------------------------------------------
-- daily_prices
-- Raw OHLCV from yfinance.
-- ----------------------------------------------------------------
create table if not exists daily_prices (
  ticker     text        not null references companies(ticker),
  date       date        not null,
  open       numeric,
  high       numeric,
  low        numeric,
  close      numeric,
  adj_close  numeric,
  volume     bigint,
  primary key (ticker, date)
);

create index if not exists idx_daily_prices_ticker on daily_prices(ticker);
create index if not exists idx_daily_prices_date   on daily_prices(date);

-- ----------------------------------------------------------------
-- daily_returns
-- Pre-computed log returns: ln(adj_close[t] / adj_close[t-1])
-- ----------------------------------------------------------------
create table if not exists daily_returns (
  ticker      text    not null references companies(ticker),
  date        date    not null,
  log_return  numeric not null,
  primary key (ticker, date)
);

create index if not exists idx_daily_returns_ticker on daily_returns(ticker);
create index if not exists idx_daily_returns_date   on daily_returns(date);

-- ----------------------------------------------------------------
-- influence_edges
-- Pairwise bivariate VAR coefficients (directed: A→B ≠ B→A).
-- One row per (from_ticker, to_ticker, lag).
-- ----------------------------------------------------------------
create table if not exists influence_edges (
  from_ticker  text    not null references companies(ticker),
  to_ticker    text    not null references companies(ticker),
  lag          int     not null,
  coefficient  numeric not null,
  p_value      numeric,
  computed_at  timestamptz not null,
  primary key (from_ticker, to_ticker, lag)
);

create index if not exists idx_edges_from      on influence_edges(from_ticker);
create index if not exists idx_edges_to        on influence_edges(to_ticker);
create index if not exists idx_edges_coef      on influence_edges(coefficient);
create index if not exists idx_edges_pvalue    on influence_edges(p_value);

-- ----------------------------------------------------------------
-- impulse_responses
-- Pre-computed orthogonalized IRF values for each directed pair
-- at each time horizon (1..IRF_HORIZON days).
-- Used directly by the simulation engine — avoids real-time VAR fitting.
-- ----------------------------------------------------------------
create table if not exists impulse_responses (
  from_ticker  text    not null references companies(ticker),
  to_ticker    text    not null references companies(ticker),
  horizon      int     not null,   -- days ahead (1, 2, ... IRF_HORIZON)
  irf_value    numeric not null,   -- response of to_ticker to unit shock in from_ticker
  computed_at  timestamptz not null,
  primary key (from_ticker, to_ticker, horizon)
);

create index if not exists idx_irf_from on impulse_responses(from_ticker);
create index if not exists idx_irf_to   on impulse_responses(to_ticker);

-- ----------------------------------------------------------------
-- Row Level Security
-- Pipeline writes with service role key (bypasses RLS).
-- Frontend reads with anon key — grant read-only access.
-- ----------------------------------------------------------------
alter table companies         enable row level security;
alter table daily_prices      enable row level security;
alter table daily_returns     enable row level security;
alter table influence_edges   enable row level security;
alter table impulse_responses enable row level security;

-- Allow anonymous read on all tables
create policy "anon read companies"
  on companies for select using (true);

create policy "anon read daily_prices"
  on daily_prices for select using (true);

create policy "anon read daily_returns"
  on daily_returns for select using (true);

create policy "anon read influence_edges"
  on influence_edges for select using (true);

create policy "anon read impulse_responses"
  on impulse_responses for select using (true);
