-- Migration: Add bot trading system tables
-- Description: Creates tables for paper trading bots, bot trades, and equity snapshots
-- Date: 2025-11-29

-- Table: bots
-- Description: Stores bot configurations, status, and performance metrics
CREATE TABLE bots (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,  -- Bot display name (e.g., 'V2 Pure', 'V3 Momentum', 'Consensus')
    strategy_type VARCHAR(50) NOT NULL,  -- Strategy identifier: 'v2_pure', 'v3_momentum', 'consensus'
    status VARCHAR(20) NOT NULL,  -- Execution status: 'active', 'paused', 'stopped'

    -- Capital tracking
    starting_capital DECIMAL(15, 2) NOT NULL DEFAULT 10000.00,  -- Initial capital (USD)
    current_balance DECIMAL(15, 2) NOT NULL DEFAULT 10000.00,   -- Available cash (USD)
    current_equity DECIMAL(15, 2) NOT NULL DEFAULT 10000.00,    -- Balance + unrealized P&L (USD)

    -- Performance metrics
    total_pnl DECIMAL(15, 2) NOT NULL DEFAULT 0.00,             -- Cumulative realized P&L (USD)
    total_pnl_pct DECIMAL(10, 4) NOT NULL DEFAULT 0.00,         -- Total P&L as percentage of starting capital
    win_rate DECIMAL(5, 2),                                     -- Percentage of winning trades
    total_trades INTEGER NOT NULL DEFAULT 0,                     -- Total number of trades executed
    winning_trades INTEGER NOT NULL DEFAULT 0,                   -- Number of winning trades
    losing_trades INTEGER NOT NULL DEFAULT 0,                    -- Number of losing trades
    max_drawdown DECIMAL(10, 4),                                -- Maximum drawdown percentage
    sharpe_ratio DECIMAL(10, 4),                                -- Sharpe ratio (risk-adjusted returns)

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for bots table
CREATE INDEX idx_bots_status ON bots(status);
CREATE INDEX idx_bots_strategy_type ON bots(strategy_type);

-- Table: bot_trades
-- Description: Stores all bot trade executions (entry and exit details)
CREATE TABLE bot_trades (
    id SERIAL PRIMARY KEY,
    bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL DEFAULT 'BTC',

    -- Entry details
    entry_timestamp TIMESTAMP NOT NULL,                         -- When position was opened
    entry_price DECIMAL(15, 2) NOT NULL,                       -- Entry price (USD)
    entry_signal_v2 DECIMAL(15, 8),                            -- cumulative_v2 value at entry
    entry_signal_v3 DECIMAL(15, 8),                            -- cumulative_v3 value at entry
    direction VARCHAR(10) NOT NULL,                            -- Position direction: 'LONG' or 'SHORT'
    position_size DECIMAL(15, 8) NOT NULL,                     -- Position size in BTC
    capital_allocated DECIMAL(15, 2) NOT NULL,                 -- Capital allocated to this trade (USD)

    -- Exit configuration (from zone_snapshots)
    tp_pct DECIMAL(10, 4) NOT NULL,                            -- Take profit percentage
    sl_pct DECIMAL(10, 4) NOT NULL,                            -- Stop loss percentage
    max_candles INTEGER NOT NULL,                              -- Maximum candles to hold (time-based exit)
    tp_price DECIMAL(15, 2) NOT NULL,                          -- Calculated TP price
    sl_price DECIMAL(15, 2) NOT NULL,                          -- Calculated SL price

    -- Exit details (NULL if position still open)
    exit_timestamp TIMESTAMP,                                   -- When position was closed
    exit_price DECIMAL(15, 2),                                 -- Exit price (USD)
    exit_type VARCHAR(10),                                      -- Exit trigger: 'TP', 'SL', 'TIME'
    candles_held INTEGER,                                       -- Number of candles position was held

    -- Trade results
    pnl DECIMAL(15, 2),                                        -- Realized P&L in USD
    pnl_pct DECIMAL(10, 4),                                    -- P&L as percentage of capital_allocated
    status VARCHAR(20) NOT NULL DEFAULT 'open',                -- Trade status: 'open', 'closed'

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for bot_trades table
CREATE INDEX idx_bot_trades_bot_id ON bot_trades(bot_id);
CREATE INDEX idx_bot_trades_status ON bot_trades(status);
CREATE INDEX idx_bot_trades_entry_timestamp ON bot_trades(entry_timestamp DESC);
CREATE INDEX idx_bot_trades_exit_timestamp ON bot_trades(exit_timestamp DESC);
CREATE INDEX idx_bot_trades_bot_status ON bot_trades(bot_id, status);  -- Composite for open trades query

-- Table: bot_equity_snapshots
-- Description: Time-series equity curve data for bot performance visualization
CREATE TABLE bot_equity_snapshots (
    id SERIAL PRIMARY KEY,
    bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL,                               -- Snapshot timestamp (aligned with candle finalization)

    -- Equity components
    balance DECIMAL(15, 2) NOT NULL,                           -- Available cash (USD)
    equity DECIMAL(15, 2) NOT NULL,                            -- Balance + unrealized P&L (USD)
    unrealized_pnl DECIMAL(15, 2) NOT NULL DEFAULT 0.00,       -- Unrealized P&L from open positions (USD)
    open_positions INTEGER NOT NULL DEFAULT 0,                  -- Number of open positions at snapshot time

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for bot_equity_snapshots table
CREATE INDEX idx_bot_equity_bot_id ON bot_equity_snapshots(bot_id);
CREATE INDEX idx_bot_equity_timestamp ON bot_equity_snapshots(timestamp DESC);
CREATE INDEX idx_bot_equity_bot_timestamp ON bot_equity_snapshots(bot_id, timestamp DESC);  -- Composite for time-range queries

-- OPTIONAL: Convert to TimescaleDB hypertable for time-series optimization
-- Uncomment if TimescaleDB extension is enabled
-- SELECT create_hypertable('bot_equity_snapshots', 'timestamp', if_not_exists => TRUE);

-- Insert initial 3 bots (V2 Pure, V3 Momentum, Consensus)
INSERT INTO bots (name, strategy_type, status, starting_capital, current_balance, current_equity)
VALUES
    ('V2 Pure', 'v2_pure', 'active', 10000.00, 10000.00, 10000.00),
    ('V3 Momentum', 'v3_momentum', 'active', 10000.00, 10000.00, 10000.00),
    ('Consensus', 'consensus', 'active', 10000.00, 10000.00, 10000.00)
ON CONFLICT (name) DO NOTHING;  -- Prevent duplicate insertion if migration re-run
