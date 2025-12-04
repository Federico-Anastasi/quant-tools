"""
LOB Subscriber - Listens for LOB calculation triggers from Redis Pub/Sub
Runs in Compute Container only

ARCHITECTURE:
- Real-Time Container (CVD pipeline) finalizes candle → publishes Redis message
- Compute Container (this subscriber) receives message → calculates LOB density
- LOB result cached in Redis for API Container to read
"""

import asyncio
import json
import logging
from app.redis_service import RedisService
from app.lob_calculator import calculate_and_cache_lob_density

logger = logging.getLogger(__name__)


async def lob_subscriber_loop():
    """
    Background task that listens for LOB calculation triggers from Redis

    Flow:
    1. Subscribe to "lob_trigger_channel"
    2. Wait for messages from Real-Time Container
    3. Extract symbol and timestamp
    4. Trigger LOB calculation (async, runs in thread pool)
    5. Result automatically cached in Redis by calculate_and_cache_lob_density()

    This decouples LOB calculation (CPU-intensive) from CVD pipeline (real-time)
    """
    print("[LOB SUBSCRIBER] Starting LOB calculation subscriber...", flush=True)
    logger.info("[LOB SUBSCRIBER] Subscribing to lob_trigger_channel")

    try:
        pubsub = RedisService.subscribe_lob_trigger()
    except Exception as e:
        logger.error(f"[LOB SUBSCRIBER] Failed to subscribe to Redis: {e}")
        return

    iteration = 0

    while True:
        try:
            # Get message with 1s timeout (non-blocking)
            message = pubsub.get_message(timeout=1.0)

            if message and message['type'] == 'message':
                iteration += 1
                data = json.loads(message['data'])
                symbol = data['symbol']
                timestamp = data['timestamp']

                print(f"[LOB SUBSCRIBER] [{iteration}] Received trigger for {symbol} at {timestamp}", flush=True)
                logger.info(f"[LOB SUBSCRIBER] Processing LOB calculation for {symbol}")

                # Calculate LOB density (runs in thread pool via asyncio.to_thread)
                # Result is automatically cached in Redis
                await calculate_and_cache_lob_density(symbol=symbol)

                print(f"[LOB SUBSCRIBER] [{iteration}] Completed LOB calculation for {symbol}", flush=True)

            # Small delay to avoid tight loop
            await asyncio.sleep(0.1)

        except json.JSONDecodeError as e:
            logger.error(f"[LOB SUBSCRIBER] Invalid JSON message: {e}")
            await asyncio.sleep(1)

        except Exception as e:
            logger.error(f"[LOB SUBSCRIBER] Error processing message: {e}", exc_info=True)
            await asyncio.sleep(5)  # Longer delay on error


if __name__ == "__main__":
    # For testing standalone
    asyncio.run(lob_subscriber_loop())
