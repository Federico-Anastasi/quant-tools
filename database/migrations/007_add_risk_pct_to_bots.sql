-- Migration 007: Add risk_pct column to bots table
-- Implements fixed risk percentage for v3_momentum_risk_fixed strategy

-- Add risk_pct column to bots table
ALTER TABLE bots
ADD COLUMN risk_pct DECIMAL(5,2) DEFAULT 2.00;

-- Update existing bots with default 2% risk
UPDATE bots SET risk_pct = 2.00;

-- Add comment for clarity
COMMENT ON COLUMN bots.risk_pct IS 'Fixed risk percentage per trade (for fixed_risk strategies)';
