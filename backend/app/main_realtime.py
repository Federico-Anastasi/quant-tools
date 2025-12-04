"""
Real-Time Container Entry Point

COMPONENTS:
- WebSocket Collector (trades ingestion from Hyperliquid)
- CVD Pipeline (3-minute candle calculation + Redis trigger)
- Runs Pipeline (directional run detection)
- Bot Executor (paper trading execution, SINGLETON)

ARCHITECTURE:
- Runs independently from API container
- Publishes LOB triggers to Redis (Compute Container subscribes)
- Bot Executor uses Redis lock for singleton enforcement
"""

import asyncio
import logging
from app.websocket_collector import start_collector
from app.cvd_pipeline import cvd_pipeline_loop
from app.runs_pipeline import runs_pipeline_loop
from app.bot_executor import bot_execution_loop

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
    logger.info("[REAL-TIME] Pipelines: WebSocket, CVD, Runs, Bot Executor")

    try:
        # Start all pipelines concurrently
        await asyncio.gather(
            start_collector(),        # WebSocket trades ingestion
            cvd_pipeline_loop(),      # 3-min candle calculation
            runs_pipeline_loop(),     # Directional run detection
            bot_execution_loop(),     # Paper trading execution (SINGLETON)
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
