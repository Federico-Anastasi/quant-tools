"""
LOB Density Cache - In-memory storage for pre-calculated LOB density
Updated every 3 minutes when CVD pipeline finalizes a candle
"""
from typing import Optional, Dict
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class LOBCache:
    """Thread-safe in-memory cache for LOB density data"""

    def __init__(self):
        self._cache: Dict[str, Dict] = {}  # {symbol: lob_data}

    def set(self, symbol: str, data: Dict, hours: int = 720, price_bin: int = 50):
        """Store LOB density data for symbol with parameters"""
        self._cache[symbol] = {
            'data': data,
            'hours': hours,
            'price_bin': price_bin,
            'cached_at': datetime.utcnow()
        }
        logger.info(f"[LOB CACHE] Updated {symbol} | bins={len(data.get('price_bins', []))} | hours={hours} | price_bin={price_bin}")

    def get(self, symbol: str, hours: int = 720, price_bin: int = 50) -> Optional[Dict]:
        """Get cached LOB density data if parameters match"""
        cached = self._cache.get(symbol)
        if cached:
            # Check if cached parameters match requested parameters
            if cached.get('hours') == hours and cached.get('price_bin') == price_bin:
                return cached['data']
            else:
                logger.info(f"[LOB CACHE] Parameter mismatch for {symbol} - cached(hours={cached.get('hours')}, bin={cached.get('price_bin')}) vs requested(hours={hours}, bin={price_bin})")
        return None

    def has(self, symbol: str) -> bool:
        """Check if symbol has cached data"""
        return symbol in self._cache


# Global singleton
lob_cache = LOBCache()
