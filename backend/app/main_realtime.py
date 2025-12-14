"""
Real-Time Container Entry Point

COMPONENTS:
- WebSocket Collector (trades ingestion from Hyperliquid)
- CVD Pipeline (3-minute candle calculation + Redis trigger)
- Runs Pipeline (directional run detection)
- Bot Executor (paper trading execution, SINGLETON)
- Live Executor (Hyperliquid live trading execution, V3 Momentum strategy)

ARCHITECTURE:
- Runs independently from API container
- Publishes LOB triggers to Redis (Compute Container subscribes)
- Bot Executor uses Redis lock for singleton enforcement
"""

import asyncio
import logging
import json
import os
from app.websocket_collector import start_collector
from app.cvd_pipeline import cvd_pipeline_loop
from app.runs_pipeline import runs_pipeline_loop
from app.bot_executor import bot_execution_loop
from app.live_executor import LiveExecutor
from app.database import DatabaseService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

logger = logging.getLogger(__name__)


async def main():
    """
    Start all real-time pipelines concurrently

    Pipeline Responsibilities:
    - WebSocket Collector: Ingest BTC trades from Hyperliquid WebSocket
    - CVD Pipeline: Calculate 3-min candles (CVD, cumulative signals)
    - Runs Pipeline: Detect directional runs (up/down clusters)
    - Bot Executor: Execute paper trading strategies (SINGLETON via Redis lock)
    """
    print("=" * 80, flush=True)
    print("[REAL-TIME CONTAINER] Starting all real-time pipelines...", flush=True)
    print("=" * 80, flush=True)

    logger.info("[REAL-TIME] Container mode: Real-Time Worker")
    logger.info("[REAL-TIME] Pipelines: WebSocket, CVD, Runs, Bot Executor, Live Executor")

    # Load Hyperliquid config and initialize LiveExecutor
    config_path = os.path.join(os.path.dirname(__file__), 'config_hyperliquid.json')
    live_executor = None

    try:
        with open(config_path) as f:
            hyperliquid_config = json.load(f)

        logger.info(f"[REAL-TIME] Loaded Hyperliquid config - is_active: {hyperliquid_config.get('is_active', False)}")

        # Initialize LiveExecutor with DatabaseService
        live_executor = LiveExecutor(
            strategy_config={
                'symbol': hyperliquid_config.get('symbol', 'BTC'),
                'risk_pct': hyperliquid_config.get('risk_pct', 2.0),
                'trading_fee_pct': hyperliquid_config.get('trading_fee_pct', 0.04),
                'min_zone_trades': hyperliquid_config.get('min_zone_trades', 10),
                'is_active': hyperliquid_config.get('is_active', False)
            },
            database_service=DatabaseService
        )

    except FileNotFoundError:
        logger.warning(f"[REAL-TIME] Hyperliquid config not found at {config_path}, Live Trading disabled")
    except Exception as e:
        logger.error(f"[REAL-TIME] Error loading Hyperliquid config: {e}", exc_info=True)

    try:
        # Prepare pipeline tasks
        tasks = [
            start_collector(),        # WebSocket trades ingestion
            cvd_pipeline_loop(),      # 3-min candle calculation
            runs_pipeline_loop(),     # Directional run detection
            bot_execution_loop(),     # Paper trading execution (SINGLETON)
        ]

        # Add LiveExecutor if initialized
        if live_executor:
            tasks.append(live_executor.execution_loop())  # Live trading executor

        # Start all pipelines concurrently
        await asyncio.gather(
            *tasks,
            return_exceptions=True    # Continue on pipeline errors
        )
    except Exception as e:
        logger.error(f"[REAL-TIME] Critical error: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[REAL-TIME CONTAINER] Shutting down gracefully...", flush=True)
        logger.info("[REAL-TIME] Received shutdown signal")
