-- ============================================================================
-- QUANT TOOLS - DATABASE SCHEMA
-- TimescaleDB setup for trades, cvd_candles, runs, zone_snapshots
-- ============================================================================

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- ============================================================================
-- TABLE: trades (Source of Truth)
-- ============================================================================
CREATE TABLE IF NOT EXISTS trades (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) DEFAULT 'BTC',
    price DECIMAL(12,2) NOT NULL,
    size DECIMAL(12,6) NOT NULL,
    side CHAR(1) NOT NULL CHECK (side IN ('B', 'A')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trades_symbol_time ON trades (symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_time ON trades (timestamp DESC) WHERE symbol='BTC';

COMMENT ON TABLE trades IS 'Raw trades from WebSocket (source of truth)';
COMMENT ON COLUMN trades.side IS 'B=Buy, A=Ask/Sell';

-- ============================================================================
-- TABLE: cvd_candles (Aggregated 3min Candles)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cvd_candles (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) DEFAULT 'BTC',

    -- Price OHLC
    price_open DECIMAL(12,2),
    price_high DECIMAL(12,2),
    price_low DECIMAL(12,2),
    price_close DECIMAL(12,2),

    -- CVD OHLC
    cvd_open DECIMAL(18,2),
    cvd_high DECIMAL(18,2),
    cvd_low DECIMAL(18,2),
    cvd_close DECIMAL(18,2),

    -- Volume
    volume_buy DECIMAL(12,4),
    volume_sell DECIMAL(12,4),

    -- Metrics
    efficiency_ratio DECIMAL(8,4),
    signal SMALLINT CHECK (signal BETWEEN -3 AND 3),
    signal_quality DECIMAL(5,2),

    -- Cumulatives (state embedded)
    cumulative_v1 DECIMAL(8,2) DEFAULT 0,
    cumulative_v2 DECIMAL(8,2) DEFAULT 0,
    cumulative_v3 DECIMAL(8,2) DEFAULT 0,
    cumulative_v3_ema DECIMAL(8,2) DEFAULT 0,

    -- Metadata
    finalized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    UNIQUE(symbol, timestamp)
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_cvd_candles_timestamp ON cvd_candles (timestamp);
CREATE INDEX IF NOT EXISTS idx_cvd_timestamp ON cvd_candles (symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cvd_finalized ON cvd_candles (timestamp DESC) WHERE finalized=TRUE;
CREATE INDEX IF NOT EXISTS idx_cvd_signal ON cvd_candles (signal) WHERE signal != 0 AND symbol='BTC';

COMMENT ON TABLE cvd_candles IS 'Pre-aggregated 3min candles with CVD metrics';
COMMENT ON COLUMN cvd_candles.cumulative_v1 IS 'Simple sum of signals (no reset)';
COMMENT ON COLUMN cvd_candles.cumulative_v2 IS 'Weighted sum with decay 0.95';
COMMENT ON COLUMN cvd_candles.cumulative_v3 IS 'Momentum: v1 - EMA(v1, 14)';
COMMENT ON COLUMN cvd_candles.cumulative_v3_ema IS 'EMA state for v3 calculation';
COMMENT ON COLUMN cvd_candles.finalized IS 'TRUE when candle closed (>= 3min elapsed)';

-- ============================================================================
-- TABLE: runs (LOB Density - Directional Sequences)
-- ============================================================================
CREATE TABLE IF NOT EXISTS runs (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) DEFAULT 'BTC',
    t_start TIMESTAMPTZ NOT NULL,
    t_end TIMESTAMPTZ NOT NULL,
    price_start DECIMAL(12,2) NOT NULL,
    price_end DECIMAL(12,2) NOT NULL,
    price_mid DECIMAL(12,2) NOT NULL,
    dir VARCHAR(4) NOT NULL CHECK (dir IN ('up', 'down')),
    delta_p DECIMAL(12,2) NOT NULL,
    "Q" DECIMAL(12,4) NOT NULL,
    q DECIMAL(12,4) NOT NULL,
    "V_eff" DECIMAL(12,6) NOT NULL,
    velocity DECIMAL(12,4) NOT NULL,
    duration DECIMAL(10,2) NOT NULL,
    n_ticks INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_runs_symbol_time ON runs (symbol, t_start DESC);
CREATE INDEX IF NOT EXISTS idx_runs_dir_price ON runs (dir, price_mid);
CREATE INDEX IF NOT EXISTS idx_runs_symbol_tend ON runs (symbol, t_end DESC);

COMMENT ON TABLE runs IS 'Directional price sequences for LOB density analysis';
COMMENT ON COLUMN runs."V_eff" IS 'Effective liquidity: volume required to move price by $1';

-- ============================================================================
-- TABLE: zone_snapshots (Order Flow Zones with Best Sharpe)
-- ============================================================================
CREATE TABLE IF NOT EXISTS zone_snapshots (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) DEFAULT 'BTC',
    signal_type VARCHAR(20) NOT NULL,
    is_long BOOLEAN NOT NULL,
    zone_min DECIMAL(8,2) NOT NULL,
    zone_max DECIMAL(8,2) NOT NULL,
    sharpe DECIMAL(8,2) NOT NULL,
    win_rate DECIMAL(5,4) NOT NULL,
    mean_return DECIMAL(8,4) NOT NULL,
    n_trades INTEGER NOT NULL,
    tp_pct DECIMAL(6,3) NOT NULL,
    sl_pct DECIMAL(6,3) NOT NULL,
    max_candles INTEGER NOT NULL,
    ci_95_lower DECIMAL(8,4),
    ci_95_upper DECIMAL(8,4),
    analysis_window_candles INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_zone_snapshots_timestamp ON zone_snapshots (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_zone_snapshots_symbol_signal ON zone_snapshots (symbol, signal_type);

COMMENT ON TABLE zone_snapshots IS 'Optimal entry zones from backtested signals';
COMMENT ON COLUMN zone_snapshots.is_long IS 'TRUE if LONG has best Sharpe, FALSE if SHORT. Opposite direction uses symmetric zone (negated boundaries).';
COMMENT ON COLUMN zone_snapshots.sharpe IS 'Sharpe ratio of the best performing direction';
COMMENT ON COLUMN zone_snapshots.win_rate IS 'Win rate (TP hit rate) of the best performing direction';
