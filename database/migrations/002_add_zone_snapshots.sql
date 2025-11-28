-- Zone Snapshots Table
-- Stores optimal trading zones calculated hourly from Triple Barrier analysis
-- Zone selection: Best performing direction (LONG or SHORT) based on Sharpe ratio
-- The opposite direction uses symmetric zone (negated boundaries)

CREATE TABLE zone_snapshots (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    symbol VARCHAR(20) DEFAULT 'BTC',
    signal_type VARCHAR(20) NOT NULL,  -- 'cumulative_v2' or 'cumulative_v3'

    -- Best performing zone (can be LONG or SHORT)
    is_long BOOLEAN NOT NULL,  -- TRUE if best performance is LONG, FALSE if SHORT
    zone_min DECIMAL(8, 2) NOT NULL,
    zone_max DECIMAL(8, 2) NOT NULL,
    sharpe DECIMAL(8, 2) NOT NULL,
    win_rate DECIMAL(5, 4) NOT NULL,
    mean_return DECIMAL(8, 4) NOT NULL,
    n_trades INTEGER NOT NULL,
    tp_pct DECIMAL(6, 3) NOT NULL,
    sl_pct DECIMAL(6, 3) NOT NULL,
    max_candles INTEGER NOT NULL,

    -- Confidence intervals
    ci_95_lower DECIMAL(8, 4),
    ci_95_upper DECIMAL(8, 4),

    -- Analysis metadata
    analysis_window_candles INTEGER NOT NULL,  -- 960 (2 days @ 3min)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookup
CREATE INDEX idx_zone_snapshots_timestamp ON zone_snapshots(timestamp DESC);
CREATE INDEX idx_zone_snapshots_symbol_signal ON zone_snapshots(symbol, signal_type);

-- Comments
COMMENT ON TABLE zone_snapshots IS 'Optimal trading zones from Triple Barrier analysis, updated hourly';
COMMENT ON COLUMN zone_snapshots.is_long IS 'TRUE if LONG has best Sharpe, FALSE if SHORT. Opposite direction uses symmetric zone (negated boundaries).';
COMMENT ON COLUMN zone_snapshots.sharpe IS 'Sharpe ratio of the best performing direction';
COMMENT ON COLUMN zone_snapshots.win_rate IS 'Win rate (TP hit rate) of the best performing direction';
