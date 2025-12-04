"""
LOB Density Cache - Redis-backed storage for pre-calculated LOB density
Updated every 3 minutes when CVD pipeline finalizes a candle

MULTI-CONTAINER ARCHITECTURE:
- Compute Container: Calculates LOB → writes to Redis
- API Container: Reads LOB from Redis (fallback: on-demand calculation)
"""
from typing import Optional, Dict
import logging
from app.redis_service import RedisService

logger = logging.getLogger(__name__)


class LOBCache:
    """Redis-backed cache for LOB density data (shared across containers)"""

    def set(self, symbol: str, data: Dict, hours: int = 720, price_bin: int = 50):
        """
        Store LOB density data in Redis

        Args:
            symbol: Trading symbol (e.g., "BTC")
            data: LOB density dict with price_bins, V_up, V_down, V_diff
            hours: Time window in hours (default 720 = 30 days)
            price_bin: Price bin size in USD (default 50)

        TTL: 180 seconds (3 minutes)
        """
        RedisService.set_lob_cache(symbol, data, hours, price_bin)
        logger.info(f"[LOB CACHE] Updated {symbol} | bins={len(data.get('price_bins', []))} | hours={hours} | price_bin={price_bin}")

    def get(self, symbol: str, hours: int = 720, price_bin: int = 50) -> Optional[Dict]:
        """
        Get cached LOB density data from Redis

        Returns:
            Dict with LOB data if cached, None if cache miss
        """
        cached = RedisService.get_lob_cache(symbol, hours, price_bin)
        if cached:
            logger.debug(f"[LOB CACHE] Cache hit: {symbol}")
        else:
            logger.debug(f"[LOB CACHE] Cache miss: {symbol}")
        return cached

    def has(self, symbol: str, hours: int = 720, price_bin: int = 50) -> bool:
        """Check if symbol has cached data in Redis"""
        return self.get(symbol, hours, price_bin) is not None


# Global singleton (maintained for compatibility)
lob_cache = LOBCache()
