-- Fix timestamp columns to properly store timezone information
-- This ensures consistent timezone handling across backend and frontend

-- Convert entry_time and exit_time to TIMESTAMP WITH TIME ZONE
-- Assumes existing data is in UTC
ALTER TABLE live_trades
    ALTER COLUMN entry_time TYPE TIMESTAMP WITH TIME ZONE USING entry_time AT TIME ZONE 'UTC',
    ALTER COLUMN exit_time TYPE TIMESTAMP WITH TIME ZONE USING exit_time AT TIME ZONE 'UTC';

-- Also fix created_at and updated_at for consistency
ALTER TABLE live_trades
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'UTC';

COMMENT ON COLUMN live_trades.entry_time IS 'Entry timestamp (UTC with timezone)';
COMMENT ON COLUMN live_trades.exit_time IS 'Exit timestamp (UTC with timezone)';
