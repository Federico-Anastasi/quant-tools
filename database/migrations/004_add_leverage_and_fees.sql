-- Migration 004: Add leverage and trading fees to bot system
-- Implements 10x leverage and 0.04% trading fee

-- Add leverage and fee columns to bots table
ALTER TABLE bots
ADD COLUMN leverage DECIMAL(5,2) DEFAULT 10.00,
ADD COLUMN trading_fee_pct DECIMAL(5,4) DEFAULT 0.04;

-- Add fee tracking columns to bot_trades table
ALTER TABLE bot_trades
ADD COLUMN leverage DECIMAL(5,2),
ADD COLUMN entry_fee DECIMAL(15,6),
ADD COLUMN exit_fee DECIMAL(15,6),
ADD COLUMN total_fees DECIMAL(15,6);

-- Update existing bots with default values
UPDATE bots SET leverage = 10.00, trading_fee_pct = 0.04;

-- Create index for trade fee analysis
CREATE INDEX idx_bot_trades_fees ON bot_trades(bot_id, total_fees);
