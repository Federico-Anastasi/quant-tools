-- Migration 008: Add LOB Snapshots table for historical density storage
-- Created: 2025-12-17
-- Purpose: Store LOB density snapshots every 3 minutes for 2D heatmap visualization

CREATE TABLE lob_snapshots (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    p_current NUMERIC(12,2) NOT NULL,
    price_bins NUMERIC(12,2)[] NOT NULL,
    v_diff NUMERIC(12,6)[] NOT NULL,
    CONSTRAINT unique_lob_snapshot UNIQUE (symbol, timestamp)
);

-- Index for efficient time-range queries (symbol + timestamp DESC)
CREATE INDEX idx_lob_symbol_time ON lob_snapshots(symbol, timestamp DESC);

-- Verify table creation
SELECT
    tablename,
    schemaname
FROM pg_tables
WHERE tablename = 'lob_snapshots';

-- Verify index creation
SELECT
    indexname,
    tablename,
    indexdef
FROM pg_indexes
WHERE tablename = 'lob_snapshots';
