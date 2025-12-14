-- Migration 006: Create live_trades table for Hyperliquid live trading
-- Table for storing live trading history on Hyperliquid exchange

CREATE TABLE IF NOT EXISTS live_trades (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    side VARCHAR(5) NOT NULL,  -- 'LONG' or 'SHORT'
    entry_price DECIMAL(20,8) NOT NULL,
    entry_time TIMESTAMP NOT NULL,
    exit_price DECIMAL(20,8),
    exit_time TIMESTAMP,
    size DECIMAL(20,8) NOT NULL,
    tp_price DECIMAL(20,8),
    sl_price DECIMAL(20,8),
    unrealized_pnl DECIMAL(20,8),
    realized_pnl DECIMAL(20,8),
    entry_order_id VARCHAR(50),
    sl_order_id VARCHAR(50),
    tp_order_id VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'open',  -- 'open', 'closed', 'error'
    exit_type VARCHAR(10),  -- 'TP', 'SL', 'MANUAL'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes per query veloci
CREATE INDEX idx_live_trades_status ON live_trades(status);
CREATE INDEX idx_live_trades_symbol ON live_trades(symbol);
CREATE INDEX idx_live_trades_entry_time ON live_trades(entry_time DESC);
CREATE INDEX idx_live_trades_symbol_status ON live_trades(symbol, status);

-- Commenti tabella
COMMENT ON TABLE live_trades IS 'Live trading history on Hyperliquid exchange';

-- Commenti colonne
COMMENT ON COLUMN live_trades.side IS 'Trade direction: LONG or SHORT';
COMMENT ON COLUMN live_trades.status IS 'Trade status: open, closed, error';
COMMENT ON COLUMN live_trades.exit_type IS 'Exit type: TP (take profit), SL (stop loss), MANUAL';
COMMENT ON COLUMN live_trades.entry_order_id IS 'Hyperliquid order ID for entry';
COMMENT ON COLUMN live_trades.sl_order_id IS 'Hyperliquid order ID for stop loss trigger';
COMMENT ON COLUMN live_trades.tp_order_id IS 'Hyperliquid order ID for take profit trigger';
