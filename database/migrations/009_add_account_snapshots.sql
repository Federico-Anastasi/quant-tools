-- ============================================================================
-- Account Equity Curve Snapshots (every 3min candle)
-- Used for live trading equity visualization and performance tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS account_snapshots (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    equity NUMERIC(20,8) NOT NULL,
    unrealized_pnl NUMERIC(20,8) NOT NULL DEFAULT 0.00,
    total_margin_used NUMERIC(20,8) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Prevent duplicate snapshots for same timestamp
    UNIQUE(timestamp)
);

CREATE INDEX IF NOT EXISTS idx_account_snapshots_timestamp ON account_snapshots(timestamp DESC);

COMMENT ON TABLE account_snapshots IS
'Live account equity snapshots captured every 3min candle. Used for equity curve visualization.';
COMMENT ON COLUMN account_snapshots.equity IS 'Total equity from Hyperliquid accountValue (includes unrealized P&L)';
COMMENT ON COLUMN account_snapshots.unrealized_pnl IS 'Sum of unrealized P&L from all open positions';
COMMENT ON COLUMN account_snapshots.total_margin_used IS 'Total margin allocated across all positions';
