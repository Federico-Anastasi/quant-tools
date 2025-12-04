"""
CVD Pipeline - Process trades → candles every 5s
"""

import asyncio
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List
from collections import defaultdict

from app.database import DatabaseService
from app.cvd_engine import floor_to_3min, build_frames, calculate_cumulative_v1, calculate_cumulative_v2, calculate_cumulative_v3


async def cvd_pipeline_loop():
    """Main CVD pipeline - runs every 5 seconds"""
    print("[CVD] Starting CVD pipeline...", flush=True)

    while True:
        try:
            await asyncio.sleep(5)
            await process_candles()

        except Exception as e:
            print(f"[CVD] Error in pipeline: {e}", flush=True)


async def process_candles():
    """Process trades into candles"""

    # Step 1: Get last finalized candle timestamp
    last_candle = DatabaseService.get_last_finalized_candle()
    if last_candle:
        since_time = last_candle['timestamp']
    else:
        since_time = datetime.utcnow() - timedelta(hours=1)

    # Step 2: Get all trades since last finalized
    trades = DatabaseService.get_trades_since(since_time)

    if not trades:
        return

    # Step 3: Group trades by candle (3min boundaries)
    candles_map = defaultdict(list)
    for trade in trades:
        candle_start = floor_to_3min(pd.Timestamp(trade['timestamp']))
        candles_map[candle_start].append(trade)

    # Step 4: Determine latest trade timestamp
    latest_trade_ts = max(pd.Timestamp(t['timestamp']) for t in trades)
    latest_candle = floor_to_3min(latest_trade_ts)

    # Step 5: Get historical candles for rolling avg (last 10 finalized)
    historical = DatabaseService.get_candles(symbol="BTC", limit=10)

    # Step 5.5: Get last finalized candle BEFORE loop (for continuity)
    last_finalized = DatabaseService.get_last_finalized_candle()

    # Step 6: Process each candle
    # Track CVD continuity across candles in this loop
    last_cvd_close = last_finalized['cvd_close'] if last_finalized and 'cvd_close' in last_finalized else 0.0

    for candle_start, candle_trades in sorted(candles_map.items()):
        is_finalized = (latest_candle > candle_start)

        # Build frames with CVD continuity
        metrics = build_frames(candle_trades, historical, last_cvd_close)

        if not metrics:
            continue

        # CRITICAL: Skip candles that are already finalized in DB
        # Check if this specific candle already exists and is finalized
        if is_finalized:
            # Query to check if this candle exists and is finalized
            from app.database import CVDCandle
            with DatabaseService.get_session() as session:
                existing = session.query(CVDCandle).filter(
                    CVDCandle.timestamp == candle_start,
                    CVDCandle.finalized == True
                ).first()

                if existing:
                    # Already finalized - skip processing to avoid recalculation
                    continue

        if is_finalized:
            # FINALIZED CANDLE
            if last_finalized:
                # Incremental calculation
                cumulative_v1 = calculate_cumulative_v1(
                    last_finalized['cumulative_v1'],
                    metrics['signal']
                )

                cumulative_v2, signal_quality = calculate_cumulative_v2(
                    last_finalized['cumulative_v2'],
                    metrics['signal'],
                    metrics['efficiency_ratio']
                )

                cumulative_v3, cumulative_v3_ema = calculate_cumulative_v3(
                    cumulative_v1,
                    last_finalized['cumulative_v3_ema']
                )
            else:
                # First candle
                cumulative_v1 = float(metrics['signal'])
                cumulative_v2, signal_quality = calculate_cumulative_v2(0, metrics['signal'], metrics['efficiency_ratio'])
                cumulative_v3, cumulative_v3_ema = calculate_cumulative_v3(cumulative_v1, 0)

            candle_data = {
                'timestamp': candle_start,
                'symbol': 'BTC',
                'price_open': metrics['price_ohlc']['open'],
                'price_high': metrics['price_ohlc']['high'],
                'price_low': metrics['price_ohlc']['low'],
                'price_close': metrics['price_ohlc']['close'],
                'cvd_open': metrics['cvd_ohlc']['open'],
                'cvd_high': metrics['cvd_ohlc']['high'],
                'cvd_low': metrics['cvd_ohlc']['low'],
                'cvd_close': metrics['cvd_ohlc']['close'],
                'volume_buy': metrics['volume_buy'],
                'volume_sell': metrics['volume_sell'],
                'efficiency_ratio': metrics['efficiency_ratio'],
                'signal': metrics['signal'],
                'signal_quality': signal_quality,
                'cumulative_v1': cumulative_v1,
                'cumulative_v2': cumulative_v2,
                'cumulative_v3': cumulative_v3,
                'cumulative_v3_ema': cumulative_v3_ema,
                'finalized': True
            }

            DatabaseService.upsert_candle(candle_data)
            print(f"[CVD] Finalized candle {candle_start} | signal={metrics['signal']} | v1={cumulative_v1:.1f} | cvd={metrics['cvd_ohlc']['close']:.2f}", flush=True)

            # MULTI-CONTAINER ARCHITECTURE: Trigger LOB calculation via Redis Pub/Sub
            # Real-Time Container publishes → Compute Container subscribes → calculates LOB
            # This decouples CPU-intensive LOB calculation from real-time CVD pipeline
            from app.redis_service import RedisService
            RedisService.publish_lob_trigger(symbol='BTC', timestamp=candle_start.isoformat())
            print(f"[CVD] Triggered LOB calculation via Redis for candle {candle_start}", flush=True)

            # Update last_finalized AND last_cvd_close for next candle in loop (maintain continuity)
            last_finalized = {
                'cumulative_v1': cumulative_v1,
                'cumulative_v2': cumulative_v2,
                'cumulative_v3_ema': cumulative_v3_ema,
                'cvd_close': metrics['cvd_ohlc']['close']
            }
            last_cvd_close = metrics['cvd_ohlc']['close']

        else:
            # IN-PROGRESS CANDLE (temporary values)
            if last_finalized:
                cumulative_v1_temp = last_finalized['cumulative_v1'] + metrics['signal']
                cumulative_v2_temp, signal_quality_temp = calculate_cumulative_v2(
                    last_finalized['cumulative_v2'],
                    metrics['signal'],
                    metrics['efficiency_ratio']
                )
                cumulative_v3_temp = cumulative_v1_temp - last_finalized['cumulative_v3_ema']
                cumulative_v3_ema_temp = last_finalized['cumulative_v3_ema']
            else:
                cumulative_v1_temp = float(metrics['signal'])
                cumulative_v2_temp, signal_quality_temp = calculate_cumulative_v2(0, metrics['signal'], metrics['efficiency_ratio'])
                cumulative_v3_temp = 0
                cumulative_v3_ema_temp = 0

            candle_data = {
                'timestamp': candle_start,
                'symbol': 'BTC',
                'price_open': metrics['price_ohlc']['open'],
                'price_high': metrics['price_ohlc']['high'],
                'price_low': metrics['price_ohlc']['low'],
                'price_close': metrics['price_ohlc']['close'],
                'cvd_open': metrics['cvd_ohlc']['open'],
                'cvd_high': metrics['cvd_ohlc']['high'],
                'cvd_low': metrics['cvd_ohlc']['low'],
                'cvd_close': metrics['cvd_ohlc']['close'],
                'volume_buy': metrics['volume_buy'],
                'volume_sell': metrics['volume_sell'],
                'efficiency_ratio': metrics['efficiency_ratio'],
                'signal': metrics['signal'],
                'signal_quality': signal_quality_temp,
                'cumulative_v1': cumulative_v1_temp,
                'cumulative_v2': cumulative_v2_temp,
                'cumulative_v3': cumulative_v3_temp,
                'cumulative_v3_ema': cumulative_v3_ema_temp,
                'finalized': False
            }

            DatabaseService.upsert_candle(candle_data)
            print(f"[CVD] In-progress candle {candle_start} | signal={metrics['signal']}", flush=True)
