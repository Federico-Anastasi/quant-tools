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
from app.websocket_collector import start_collector
from app.cvd_pipeline import cvd_pipeline_loop
from app.runs_pipeline import runs_pipeline_loop
from app.bot_executor import bot_execution_loop
# Live trading is intentionally DISABLED (no real-money execution, no Hyperliquid
# credentials on the box). The live executor + its userFills WebSocket are not
# started. Re-enable deliberately only with a configured, audited live account.
# from app.live_executor import live_execution_loop

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

logger = logging.getLogger(__name__)

# Backoff between restarts for a crashed pipeline (seconds).
_RESTART_BACKOFF = 5


async def _supervised(name: str, coro_factory):
    """
    Run a pipeline coroutine under a supervisor that restarts it on exit/crash.

    Args:
        name: Human-readable name for log messages.
        coro_factory: Zero-argument callable that returns a fresh coroutine each time.
    """
    while True:
        logger.info(f"[SUPERVISOR] Starting pipeline: {name}")
        try:
            await coro_factory()
            # Coroutine returned normally — this should never happen for infinite loops.
            logger.error(
                f"[SUPERVISOR] Pipeline {name!r} returned unexpectedly (should loop forever). "
                f"Restarting in {_RESTART_BACKOFF}s."
            )
        except asyncio.CancelledError:
            # Propagate cancellation (intentional shutdown).
            logger.info(f"[SUPERVISOR] Pipeline {name!r} cancelled — not restarting.")
            raise
        except Exception as exc:
            logger.error(
                f"[SUPERVISOR] Pipeline {name!r} crashed with {type(exc).__name__}: {exc}. "
                f"Restarting in {_RESTART_BACKOFF}s.",
                exc_info=True,
            )
        await asyncio.sleep(_RESTART_BACKOFF)


async def main():
    """
    Start all real-time pipelines concurrently, each under a supervisor.

    Each pipeline is wrapped in _supervised() so that if it returns or raises,
    it is restarted after a short backoff instead of being silently dropped.
    Docker restart=unless-stopped is the outer safety net; _supervised is the
    inner one that handles transient failures without a full container restart.
    """
    print("=" * 80, flush=True)
    print("[REAL-TIME CONTAINER] Starting all real-time pipelines...", flush=True)
    print("=" * 80, flush=True)

    logger.info("[REAL-TIME] Container mode: Real-Time Worker")
    logger.info("[REAL-TIME] Pipelines: WebSocket, CVD, Runs, Bot Executor (Live Executor DISABLED)")

    await asyncio.gather(
        _supervised("WebSocket Collector", start_collector),
        _supervised("CVD Pipeline",        cvd_pipeline_loop),
        _supervised("Runs Pipeline",       runs_pipeline_loop),
        _supervised("Bot Executor",        bot_execution_loop),
        # Live Executor DISABLED on purpose — see import note above.
        # _supervised("Live Executor",       live_execution_loop),
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[REAL-TIME CONTAINER] Shutting down gracefully...", flush=True)
        logger.info("[REAL-TIME] Received shutdown signal")
