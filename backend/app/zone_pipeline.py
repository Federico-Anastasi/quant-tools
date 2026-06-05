"""
Zone Pipeline - Hourly Triple Barrier Zone Analysis
Calculates optimal trading zones and saves to database
"""

import asyncio
from datetime import datetime, timezone
from typing import Dict

from app.zone_analysis import analyze_optimal_zones
from app.database import DatabaseService


def _to_python_type(value):
    """Convert numpy/pandas types to native Python types"""
    import numpy as np
    import pandas as pd

    if value is None:
        return None
    elif isinstance(value, (np.integer, np.int64, np.int32)):
        return int(value)
    elif isinstance(value, (np.floating, np.float64, np.float32)):
        return float(value)
    elif isinstance(value, np.ndarray):
        return value.tolist()
    elif isinstance(value, (pd.Timestamp, pd.DatetimeTZDtype)):
        return value.to_pydatetime()
    elif isinstance(value, bool):  # Must check before int/float
        return bool(value)
    elif isinstance(value, (int, float, str)):
        return value
    else:
        # Fallback: try to convert to float if numeric-like
        try:
            return float(value)
        except:
            return value


async def zone_pipeline_loop():
    """
    Background task that runs every hour to update optimal zones

    Logic:
    1. Sleep 5 seconds on startup (let DB initialize)
    2. Run zone analysis in separate thread (non-blocking)
    3. Save results to database
    4. Sleep 3600 seconds (1 hour)
    5. Repeat

    IMPORTANT: Uses asyncio.to_thread() to run CPU-intensive analysis
    without blocking the FastAPI event loop and API endpoints.
    """
    print("[ZONE PIPELINE] Starting zone analysis pipeline", flush=True)

    # Initial delay
    await asyncio.sleep(5)

    while True:
        try:
            print(f"[ZONE PIPELINE] Running zone analysis at {datetime.now(timezone.utc)}", flush=True)

            # Run analysis in separate thread to avoid blocking the event loop
            # This allows the API to continue serving requests during analysis
            results = await asyncio.to_thread(
                analyze_optimal_zones,
                symbol='BTC',
                window_days=2,
                min_samples=10
            )

            if not results:
                print("[ZONE PIPELINE] WARNING: Zone analysis returned EMPTY results for ALL signals. "
                      "No zone snapshots saved. Bots will use stale zones until next run.", flush=True)
                await asyncio.sleep(3600)
                continue

            # Warn loudly for any signal_type that yielded no zone
            for expected_signal in ('cumulative_v2', 'cumulative_v3'):
                if expected_signal not in results:
                    print(
                        f"[ZONE PIPELINE] WARNING: No valid zone found for {expected_signal!r}. "
                        f"Possible cause: too few candles in analysis window or all zones have "
                        f"< min_samples entries (after central-noise exclusion). "
                        f"Bots will trade on the previous {expected_signal} zone snapshot until next run.",
                        flush=True
                    )

            # Save results to database
            timestamp_now = datetime.now(timezone.utc)

            for signal_type, zone_data in results.items():
                # Convert all numpy types to native Python types
                zone_snapshot = {
                    'timestamp': timestamp_now,
                    'symbol': 'BTC',
                    'signal_type': signal_type,
                    'is_long': _to_python_type(zone_data['is_long']),
                    'zone_min': _to_python_type(zone_data['zone_min']),
                    'zone_max': _to_python_type(zone_data['zone_max']),
                    'sharpe': _to_python_type(zone_data['sharpe']),
                    'win_rate': _to_python_type(zone_data['win_rate']),
                    'mean_return': _to_python_type(zone_data['mean_return']),
                    'n_trades': _to_python_type(zone_data['n_trades']),
                    'tp_pct': _to_python_type(zone_data['tp_pct']),
                    'sl_pct': abs(_to_python_type(zone_data['sl_pct'])),
                    'max_candles': _to_python_type(zone_data['max_candles']),
                    'ci_95_lower': _to_python_type(zone_data.get('ci_95_lower')),
                    'ci_95_upper': _to_python_type(zone_data.get('ci_95_upper')),
                    'analysis_window_candles': _to_python_type(zone_data['analysis_window_candles'])
                }

                zone_id = await asyncio.to_thread(
                    DatabaseService.insert_zone_snapshot, zone_snapshot
                )

                direction = "LONG" if zone_snapshot['is_long'] else "SHORT"
                print(f"[ZONE PIPELINE] Saved {signal_type}: {direction} zone [{zone_snapshot['zone_min']}, {zone_snapshot['zone_max']}) "
                      f"Sharpe={zone_snapshot['sharpe']:.2f} WinRate={zone_snapshot['win_rate']*100:.1f}% (ID: {zone_id})",
                      flush=True)

            print(f"[ZONE PIPELINE] Analysis complete, sleeping 3600s", flush=True)

        except Exception as e:
            print(f"[ZONE PIPELINE] ERROR: {e}", flush=True)
            import traceback
            traceback.print_exc()

        # Sleep 1 hour
        await asyncio.sleep(3600)
