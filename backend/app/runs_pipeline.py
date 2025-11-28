"""
Runs Pipeline - Compute directional runs for LOB density every 5s
"""

import asyncio
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict

from app.database import DatabaseService


async def runs_pipeline_loop():
    """Main runs pipeline - runs every 5 seconds"""
    print("[RUNS] Starting runs pipeline...", flush=True)

    while True:
        try:
            await asyncio.sleep(5)
            await compute_runs()

        except Exception as e:
            print(f"[RUNS] Error in pipeline: {e}", flush=True)


async def compute_runs():
    """Compute runs from new trades"""

    # Step 1: Get last run end time
    from datetime import timezone
    last_run_time = DatabaseService.get_last_run_time()
    if last_run_time:
        since_time = last_run_time
    else:
        since_time = datetime.now(timezone.utc) - timedelta(hours=1)

    # Step 2: Get new trades
    trades = DatabaseService.get_trades_since(since_time)

    if len(trades) < 10:
        return

    # Step 3: Extract arrays
    prices = np.array([t['price'] for t in trades])
    timestamps = np.array([t['timestamp'] for t in trades])
    sizes = np.array([t['size'] for t in trades])
    sides = np.array([t['side'] for t in trades])

    # Step 4: Compute runs
    runs = compute_runs_from_trades(prices, timestamps, sizes, sides)

    if runs:
        # Save closed runs only (exclude last in-progress run)
        if len(runs) > 1:
            closed_runs = runs[:-1]
            DatabaseService.bulk_insert_runs(closed_runs)
            print(f"[RUNS] Saved {len(closed_runs)} closed runs", flush=True)


def compute_runs_from_trades(prices, timestamps, sizes, sides) -> List[Dict]:
    """
    Compute runs from trade arrays (from compute_runs_batch.py logic)
    """
    from datetime import timezone
    runs = []

    dirs = np.sign(np.diff(prices))
    # Convert datetime objects to timestamps (seconds since epoch)
    # Handle both timezone-aware and naive datetimes
    epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
    timestamps_sec = []
    for t in timestamps:
        if t.tzinfo is None:
            # Naive datetime - assume UTC
            t_aware = t.replace(tzinfo=timezone.utc)
        else:
            t_aware = t
        timestamps_sec.append((t_aware - epoch).total_seconds())

    timestamps_sec = np.array(timestamps_sec)
    time_diffs = np.diff(timestamps_sec)
    gaps = np.where(time_diffs > 300)[0]

    start_idx = 0
    cur_dir = None

    for i in range(len(dirs)):
        # Reset on gap
        if i in gaps:
            start_idx = i + 1
            cur_dir = None
            continue

        # Skip flat
        if dirs[i] == 0:
            continue

        # Start new run
        if cur_dir is None:
            cur_dir = dirs[i]
            start_idx = i
            continue

        # Direction change → end run
        if dirs[i] != cur_dir:
            p_start = float(prices[start_idx])
            p_end = float(prices[i])
            delta_p = p_end - p_start
            n_ticks = i - start_idx + 1

            # Filters
            if n_ticks >= 5 and abs(delta_p) >= 1.0:
                Q = float(np.sum(sizes[start_idx:i+1]))

                # Signed volume
                q = float(np.sum(np.where(
                    sides[start_idx:i+1] == 'B',
                    sizes[start_idx:i+1],
                    -sizes[start_idx:i+1]
                )))

                t_start = timestamps[start_idx]
                t_end = timestamps[i]
                duration = max((t_end - t_start).total_seconds(), 1.0)

                runs.append({
                    'symbol': 'BTC',
                    't_start': t_start,
                    't_end': t_end,
                    'price_start': p_start,
                    'price_end': p_end,
                    'price_mid': (p_start + p_end) / 2,
                    'dir': 'up' if cur_dir > 0 else 'down',
                    'delta_p': delta_p,
                    'Q': Q,
                    'q': q,
                    'V_eff': Q / abs(delta_p),
                    'velocity': abs(delta_p) / duration,
                    'duration': duration,
                    'n_ticks': n_ticks
                })

            # Start new run
            start_idx = i
            cur_dir = dirs[i]

    return runs
