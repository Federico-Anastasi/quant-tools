"""
Compute Container Entry Point

COMPONENTS:
- Zone Pipeline (hourly Triple Barrier zone analysis, CPU-intensive)
- LOB Subscriber (listens for Redis triggers from Real-Time Container)

ARCHITECTURE:
- Isolated CPU-intensive workloads (Zone + LOB calculation)
- LOB calculation triggered via Redis Pub/Sub (decoupled from Real-Time)
- Results cached in Redis for API Container to read
"""

import asyncio
import logging
import json
import os
from app.zone_pipeline import zone_pipeline_loop
from app.lob_subscriber import lob_subscriber_loop
# LiveExecutor moved to main_realtime.py (closer to CVD pipeline)
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
    Start CPU-intensive compute pipelines

    Pipeline Responsibilities:
    - Zone Pipeline: Hourly Triple Barrier analysis (optimal trading zones)
    - LOB Subscriber: Listen for Redis triggers → calculate LOB density → cache in Redis
    """
    print("=" * 80, flush=True)
    print("[COMPUTE CONTAINER] Starting CPU-intensive pipelines...", flush=True)
    print("=" * 80, flush=True)

    logger.info("[COMPUTE] Container mode: Compute Worker")
    logger.info("[COMPUTE] Pipelines: Zone Analysis, LOB Subscriber")

    _RESTART_BACKOFF = 5

    async def _supervised(name: str, coro_factory):
        """Restart pipeline on unexpected exit/crash."""
        while True:
            logger.info(f"[SUPERVISOR] Starting pipeline: {name}")
            try:
                await coro_factory()
                logger.error(
                    f"[SUPERVISOR] Pipeline {name!r} returned unexpectedly. "
                    f"Restarting in {_RESTART_BACKOFF}s."
                )
            except asyncio.CancelledError:
                logger.info(f"[SUPERVISOR] Pipeline {name!r} cancelled — not restarting.")
                raise
            except Exception as exc:
                logger.error(
                    f"[SUPERVISOR] Pipeline {name!r} crashed: {exc}. "
                    f"Restarting in {_RESTART_BACKOFF}s.",
                    exc_info=True,
                )
            await asyncio.sleep(_RESTART_BACKOFF)

    await asyncio.gather(
        _supervised("Zone Pipeline",   zone_pipeline_loop),
        _supervised("LOB Subscriber",  lob_subscriber_loop),
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[COMPUTE CONTAINER] Shutting down gracefully...", flush=True)
        logger.info("[COMPUTE] Received shutdown signal")
