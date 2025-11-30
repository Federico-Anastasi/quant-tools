"""
Zone Snapshots Historical Backfill
Calculates AUTHENTIC zone snapshots from historical data using triple barrier analysis
"""

import sys
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import DatabaseService, CVDCandle, ZoneSnapshot
from app.zone_analysis import analyze_zone, generate_barriers, generate_entry_zones
import pandas as pd


def calculate_zone_snapshot_at_time(target_time: datetime, symbol: str = "BTC") -> Optional[Dict]:
    """
    Calculate AUTHENTIC zone analysis at a specific point in time using data available BEFORE that point

    Uses the same triple barrier logic from zone_analysis.py to ensure authenticity

    Args:
        target_time: Timestamp to calculate zones for (uses candles BEFORE this time)
        symbol: Trading symbol

    Returns:
        Dict with cumulative_v2 and cumulative_v3 zone data, or None if insufficient data
    """
    print(f"[ZONE BACKFILL] Calculating zones at {target_time.isoformat()}")

    # Get candles BEFORE target_time (use last 960 candles = 2 days @ 3min)
    with DatabaseService.get_session() as session:
        candles = session.query(CVDCandle).filter(
            CVDCandle.symbol == symbol,
            CVDCandle.timestamp < target_time,  # STRICT < (not <=)
            CVDCandle.finalized == True
        ).order_by(CVDCandle.timestamp.desc()).limit(960).all()

        if len(candles) < 120:  # At least 6 hours of data
            print(f"[ZONE BACKFILL] Insufficient data: {len(candles)} candles (need 120+)")
            return None

        # Reverse to chronological order and extract data INSIDE session
        candles = list(reversed(candles))

        # Convert to DataFrame (extract data while in session)
        df = pd.DataFrame([{
            'timestamp': c.timestamp,
            'price_close': float(c.price_close),
            'cumulative_v2': float(c.cumulative_v2) if c.cumulative_v2 is not None else 0,
            'cumulative_v3': float(c.cumulative_v3) if c.cumulative_v3 is not None else 0
        } for c in candles])

    print(f"[ZONE BACKFILL] Analyzing {len(df)} candles for zone analysis")

    # Generate configurations (same as zone_analysis.py)
    barriers = generate_barriers()
    entry_zones = generate_entry_zones()

    results = {}

    # Analyze each signal (cumulative_v2, cumulative_v3)
    for signal_col in ['cumulative_v2', 'cumulative_v3']:
        best_overall = None
        best_overall_sharpe = -float('inf')

        for zone_min, zone_max in entry_zones:
            # Analyze LONG with all 45 barriers
            long_config = analyze_zone(df, signal_col, zone_min, zone_max,
                                      barriers, 'LONG', min_samples=10)

            # Analyze SHORT with all 45 barriers
            short_config = analyze_zone(df, signal_col, zone_min, zone_max,
                                       barriers, 'SHORT', min_samples=10)

            # Pick best between LONG and SHORT for this zone
            zone_best = None
            if long_config and short_config:
                zone_best = long_config if long_config['sharpe'] > short_config['sharpe'] else short_config
            elif long_config:
                zone_best = long_config
            elif short_config:
                zone_best = short_config

            # Check if this is best overall
            if zone_best and zone_best['sharpe'] > best_overall_sharpe:
                best_overall_sharpe = zone_best['sharpe']
                best_overall = zone_best

        # Apply minimum sample filter (same as zone_pipeline.py)
        if best_overall and best_overall['n_trades'] >= 10:
            results[signal_col] = {
                'is_long': best_overall['direction'] == 'LONG',
                'zone_min': float(best_overall['zone_min']),
                'zone_max': float(best_overall['zone_max']),
                'sharpe': float(best_overall['sharpe']),
                'win_rate': float(best_overall['win_rate']),
                'mean_return': float(best_overall['mean_return']),
                'n_trades': int(best_overall['n_trades']),
                'tp_pct': float(best_overall['tp_pct']),
                'sl_pct': float(abs(best_overall['sl_pct'])),  # Convert to positive value
                'max_candles': int(best_overall['max_candles']),
                'ci_95_lower': float(best_overall['ci_95_lower']),
                'ci_95_upper': float(best_overall['ci_95_upper'])
            }

            direction_label = "LONG" if results[signal_col]['is_long'] else "SHORT"
            print(f"  ✓ {signal_col}: {direction_label} Zone [{best_overall['zone_min']}, {best_overall['zone_max']}) "
                  f"Sharpe={best_overall['sharpe']:.2f} WinRate={best_overall['win_rate']*100:.1f}% "
                  f"MeanReturn={best_overall['mean_return']:.2f}% N={best_overall['n_trades']}")
        else:
            if best_overall:
                print(f"  ✗ {signal_col} REJECTED: n={best_overall.get('n_trades', 0)}, "
                      f"mean_return={best_overall.get('mean_return', 0):.2f}%")
            else:
                print(f"  ✗ {signal_col}: No valid zone found")

    if not results:
        print(f"[ZONE BACKFILL] No zones passed minimum sample filter (n>=10)")
        return None

    return results


def save_zone_snapshot(zones: Dict, timestamp: datetime, symbol: str = "BTC"):
    """Save zone snapshot to database"""
    for signal_type, zone_data in zones.items():
        snapshot_data = {
            'timestamp': timestamp,
            'symbol': symbol,
            'signal_type': signal_type,
            'is_long': zone_data['is_long'],
            'zone_min': zone_data['zone_min'],
            'zone_max': zone_data['zone_max'],
            'sharpe': zone_data['sharpe'],
            'win_rate': zone_data['win_rate'],
            'mean_return': zone_data['mean_return'],
            'n_trades': zone_data['n_trades'],
            'tp_pct': zone_data['tp_pct'],
            'sl_pct': zone_data['sl_pct'],
            'max_candles': zone_data['max_candles'],
            'ci_95_lower': zone_data.get('ci_95_lower'),
            'ci_95_upper': zone_data.get('ci_95_upper'),
            'analysis_window_candles': 960
        }

        snapshot_id = DatabaseService.insert_zone_snapshot(snapshot_data)
        print(f"[ZONE BACKFILL] ✓ SAVED: ID={snapshot_id} | timestamp={timestamp.isoformat()} | signal={signal_type}", flush=True)


def run_zone_backfill():
    """
    Main zone backfill function

    CORRECT Strategy:
    1. Find first candle in database
    2. X = first_candle + 6 hours (starting point)
    3. Loop: For each hour from X until NOW:
       - Get all candles with timestamp < X (strict less than)
       - Calculate zones using those candles
       - Save zone snapshot with timestamp = X
       - X = X + 1 hour
    4. Stop when X >= NOW
    """
    print("=" * 80)
    print("[ZONE BACKFILL] Starting Zone Snapshots Historical Backfill")
    print("=" * 80)

    # Get first and last candle timestamps
    with DatabaseService.get_session() as session:
        first_candle = session.query(CVDCandle).filter(
            CVDCandle.symbol == 'BTC',
            CVDCandle.finalized == True
        ).order_by(CVDCandle.timestamp.asc()).first()

        last_candle = session.query(CVDCandle).filter(
            CVDCandle.symbol == 'BTC',
            CVDCandle.finalized == True
        ).order_by(CVDCandle.timestamp.desc()).first()

        if not first_candle:
            print(f"[ZONE BACKFILL] ERROR: No finalized candles found")
            return

        first_candle_time = first_candle.timestamp
        last_candle_time = last_candle.timestamp

    print(f"[ZONE BACKFILL] First candle: {first_candle_time.isoformat()}")
    print(f"[ZONE BACKFILL] Last candle: {last_candle_time.isoformat()}")

    # Start from 6 hours after first candle
    X = first_candle_time + timedelta(hours=6)

    # NOW is the last candle timestamp (we only process historical data)
    NOW = last_candle_time

    print(f"[ZONE BACKFILL] Starting zone calculation at: {X.isoformat()}")
    print(f"[ZONE BACKFILL] Will process until: {NOW.isoformat()}")

    # Calculate expected zones (1 per hour)
    total_hours = int((NOW - X).total_seconds() / 3600)
    print(f"[ZONE BACKFILL] Expected zones: {total_hours}")

    # Loop: X, X+1h, X+2h, ... until X >= NOW
    zone_count = 0
    hour_count = 0

    while X < NOW:
        hour_count += 1
        print(f"\n[ZONE BACKFILL] === Hour #{hour_count} | X={X.isoformat()} ===", flush=True)

        zones = calculate_zone_snapshot_at_time(X, 'BTC')

        if zones:
            print(f"[ZONE BACKFILL] About to save zones for timestamp: {X.isoformat()}", flush=True)
            save_zone_snapshot(zones, X, 'BTC')
            zone_count += 1
        else:
            print(f"[ZONE BACKFILL] No valid zones at {X.isoformat()}", flush=True)

        # Increment by 1 hour
        X = X + timedelta(hours=1)
        print(f"[ZONE BACKFILL] Next X will be: {X.isoformat()}", flush=True)

    print("\n" + "=" * 80)
    print(f"[ZONE BACKFILL] Zone backfill completed!")
    print(f"[ZONE BACKFILL] Processed {hour_count} hours")
    print(f"[ZONE BACKFILL] Created {zone_count} zone snapshots")
    print("=" * 80)


if __name__ == '__main__':
    run_zone_backfill()
