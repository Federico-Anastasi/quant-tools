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
from app.zone_pipeline import zone_pipeline_loop
from app.lob_subscriber import lob_subscriber_loop

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

    try:
        # Start both pipelines concurrently
        await asyncio.gather(
            zone_pipeline_loop(),     # Hourly zone analysis (CPU-intensive)
            lob_subscriber_loop(),    # LOB calculation subscriber (Redis Pub/Sub)
            return_exceptions=True    # Continue on pipeline errors
        )
    except Exception as e:
        logger.error(f"[COMPUTE] Critical error: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[COMPUTE CONTAINER] Shutting down gracefully...", flush=True)
        logger.info("[COMPUTE] Received shutdown signal")
