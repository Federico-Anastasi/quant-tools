-- Add fee tracking to live_trades table

ALTER TABLE live_trades
ADD COLUMN entry_fee NUMERIC(20, 8),
ADD COLUMN exit_fee NUMERIC(20, 8),
ADD COLUMN gross_pnl NUMERIC(20, 8);

-- Update existing records: copy realized_pnl to gross_pnl
UPDATE live_trades
SET gross_pnl = realized_pnl
WHERE realized_pnl IS NOT NULL;

COMMENT ON COLUMN live_trades.entry_fee IS 'Entry fill fee from Hyperliquid (USDC)';
COMMENT ON COLUMN live_trades.exit_fee IS 'Exit fill fee from Hyperliquid (USDC)';
COMMENT ON COLUMN live_trades.gross_pnl IS 'Gross PnL before fees (closedPnl from Hyperliquid)';
COMMENT ON COLUMN live_trades.realized_pnl IS 'Net PnL after fees (gross_pnl - entry_fee - exit_fee)';
