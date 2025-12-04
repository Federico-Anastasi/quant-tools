-- Migration 005: Add trade_id to trades table
-- Purpose: Store Hyperliquid unique trade ID to prevent duplicate insertions
-- Date: 2025-12-04

-- Add trade_id column (Hyperliquid unique identifier)
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS trade_id BIGINT;

-- Create unique constraint on trade_id
-- This prevents duplicate trades from being inserted
ALTER TABLE trades
ADD CONSTRAINT trades_trade_id_key UNIQUE (trade_id);

-- Create index for faster lookups by trade_id
CREATE INDEX IF NOT EXISTS idx_trades_trade_id ON trades(trade_id);

-- Add comment to document the column
COMMENT ON COLUMN trades.trade_id IS 'Hyperliquid unique trade identifier (tid field from WebSocket)';
