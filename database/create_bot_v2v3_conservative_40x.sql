-- ============================================================================
-- Create Bot: V2 OR V3 Conservative 40x
-- ============================================================================
--
-- Strategy: Same entry logic as V2 OR V3 Conservative BUT:
--   - TP/SL mapped from zone range [0.2%, 1.6%] to [0.4%, 0.6%]
--   - Maintains same RR as zone parameters
--   - Leverage: 40x with 10% capital allocation (400% notional exposure)
--
-- ============================================================================

INSERT INTO bots (
    name,
    strategy_type,
    status,
    starting_capital,
    current_balance,
    current_equity,
    total_pnl,
    total_pnl_pct,
    win_rate,
    total_trades,
    winning_trades,
    losing_trades,
    leverage,
    trading_fee_pct,
    created_at,
    updated_at
) VALUES (
    'V2 OR V3 Conservative 40x',
    'v2v3_or_conservative_40x',
    'active',
    10000.0,        -- Starting capital: $10,000
    10000.0,        -- Current balance
    10000.0,        -- Current equity
    0.0,            -- Total P&L
    0.0,            -- Total P&L %
    0.0,            -- Win rate
    0,              -- Total trades
    0,              -- Winning trades
    0,              -- Losing trades
    40.0,           -- Leverage: 40x
    0.04,           -- Trading fee: 0.04%
    NOW(),
    NOW()
);

-- Verify creation
SELECT
    id,
    name,
    strategy_type,
    leverage,
    starting_capital,
    status
FROM bots
WHERE strategy_type = 'v2v3_or_conservative_40x';
