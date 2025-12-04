"""
Redis Service - Shared State Management for Multi-Container Architecture

Provides:
1. LOB Cache (Compute Container writes, API Container reads)
2. Redis Pub/Sub (Real-Time triggers Compute for LOB calculation)
3. Bot Executor Lock (Singleton enforcement across containers)
"""

import redis
import json
from typing import Optional, Dict
import os
import logging

logger = logging.getLogger(__name__)


class RedisService:
    """Redis client singleton with cache, pub/sub, and lock methods"""

    _client = None

    @classmethod
    def get_client(cls) -> redis.Redis:
        """Get Redis client (lazy initialization)"""
        if cls._client is None:
            redis_url = os.getenv('REDIS_URL', 'redis://redis:6379/0')
            cls._client = redis.from_url(redis_url, decode_responses=True)
            logger.info(f"[REDIS] Connected to {redis_url}")
        return cls._client

    # ============================================================================
    # LOB CACHE METHODS (Compute writes, API reads)
    # ============================================================================

    @classmethod
    def set_lob_cache(cls, symbol: str, data: Dict, hours: int, price_bin: int):
        """
        Store LOB density data in Redis cache

        Args:
            symbol: Trading symbol (e.g., "BTC")
            data: LOB density data (price_bins, V_up, V_down, V_diff, etc.)
            hours: Time window in hours (e.g., 720 for 30 days)
            price_bin: Price bin size in USD (e.g., 50)

        TTL: 180 seconds (3 minutes, aligned with CVD pipeline)
        """
        key = f"lob_cache:{symbol}:{hours}:{price_bin}"
        try:
            cls.get_client().setex(key, 180, json.dumps(data))
            logger.info(f"[REDIS] LOB cache updated: {key}")
        except Exception as e:
            logger.error(f"[REDIS] Failed to set LOB cache: {e}")

    @classmethod
    def get_lob_cache(cls, symbol: str, hours: int, price_bin: int) -> Optional[Dict]:
        """
        Retrieve LOB density data from Redis cache

        Returns:
            Dict with LOB data if cached, None if cache miss
        """
        key = f"lob_cache:{symbol}:{hours}:{price_bin}"
        try:
            cached = cls.get_client().get(key)
            if cached:
                logger.debug(f"[REDIS] LOB cache hit: {key}")
                return json.loads(cached)
            else:
                logger.debug(f"[REDIS] LOB cache miss: {key}")
                return None
        except Exception as e:
            logger.error(f"[REDIS] Failed to get LOB cache: {e}")
            return None

    # ============================================================================
    # PUB/SUB METHODS (Real-Time triggers Compute)
    # ============================================================================

    @classmethod
    def publish_lob_trigger(cls, symbol: str, timestamp: str):
        """
        Publish LOB calculation trigger to Redis channel

        Args:
            symbol: Trading symbol (e.g., "BTC")
            timestamp: ISO format timestamp of finalized candle
        """
        message = json.dumps({"symbol": symbol, "timestamp": timestamp})
        try:
            cls.get_client().publish("lob_trigger_channel", message)
            logger.debug(f"[REDIS] Published LOB trigger: {symbol} at {timestamp}")
        except Exception as e:
            logger.error(f"[REDIS] Failed to publish LOB trigger: {e}")

    @classmethod
    def subscribe_lob_trigger(cls):
        """
        Subscribe to LOB trigger channel (blocking)

        Returns:
            PubSub object for message iteration

        Usage:
            pubsub = RedisService.subscribe_lob_trigger()
            while True:
                message = pubsub.get_message(timeout=1.0)
                if message and message['type'] == 'message':
                    data = json.loads(message['data'])
                    # Process trigger...
        """
        try:
            pubsub = cls.get_client().pubsub()
            pubsub.subscribe("lob_trigger_channel")
            logger.info("[REDIS] Subscribed to lob_trigger_channel")
            return pubsub
        except Exception as e:
            logger.error(f"[REDIS] Failed to subscribe to LOB trigger: {e}")
            raise

    # ============================================================================
    # BOT EXECUTOR LOCK METHODS (Singleton enforcement)
    # ============================================================================

    @classmethod
    def acquire_bot_executor_lock(cls, container_id: str) -> bool:
        """
        Acquire bot executor lock (prevents duplicate instances)

        Args:
            container_id: Unique container identifier (UUID)

        Returns:
            True if lock acquired, False if already held by another container

        TTL: 10 seconds (must renew before expiration)
        """
        try:
            acquired = cls.get_client().set(
                "bot_executor_lock",
                container_id,
                nx=True,  # Only set if not exists
                ex=10     # Expire in 10 seconds
            )
            if acquired:
                logger.info(f"[REDIS] Bot executor lock acquired by {container_id}")
            else:
                current_owner = cls.get_client().get("bot_executor_lock")
                logger.warning(f"[REDIS] Bot executor lock already held by {current_owner}")
            return acquired
        except Exception as e:
            logger.error(f"[REDIS] Failed to acquire bot executor lock: {e}")
            return False

    @classmethod
    def renew_bot_executor_lock(cls, container_id: str) -> bool:
        """
        Renew bot executor lock (extends TTL by 10 seconds)

        Args:
            container_id: Unique container identifier (must match lock owner)

        Returns:
            True if lock renewed successfully, False if lost ownership
        """
        try:
            current_owner = cls.get_client().get("bot_executor_lock")
            if current_owner == container_id:
                cls.get_client().expire("bot_executor_lock", 10)
                logger.debug(f"[REDIS] Bot executor lock renewed by {container_id}")
                return True
            else:
                logger.error(f"[REDIS] Cannot renew lock: owned by {current_owner}, not {container_id}")
                return False
        except Exception as e:
            logger.error(f"[REDIS] Failed to renew bot executor lock: {e}")
            return False

    @classmethod
    def release_bot_executor_lock(cls, container_id: str):
        """
        Release bot executor lock (optional, expires automatically)

        Args:
            container_id: Unique container identifier (must match lock owner)
        """
        try:
            current_owner = cls.get_client().get("bot_executor_lock")
            if current_owner == container_id:
                cls.get_client().delete("bot_executor_lock")
                logger.info(f"[REDIS] Bot executor lock released by {container_id}")
            else:
                logger.warning(f"[REDIS] Cannot release lock: owned by {current_owner}, not {container_id}")
        except Exception as e:
            logger.error(f"[REDIS] Failed to release bot executor lock: {e}")
