"""
LOB Density Calculator - Heavy computation logic extracted from /api/lob-density endpoint
IMPORTANT: Logic is IDENTICAL to original endpoint implementation - zero modifications to ensure same results
"""
import numpy as np
from scipy.ndimage import gaussian_filter1d
from datetime import datetime, timedelta, timezone
from typing import Optional
import logging

from app.database import DatabaseService, Run
from app.lob_cache import lob_cache

logger = logging.getLogger(__name__)


async def calculate_and_cache_lob_density(
    symbol: str = 'BTC',
    hours: int = 720,
    price_bin: int = 50,
    t0: Optional[datetime] = None
):
    """
    Calculate LOB density and store in cache
    Called by CVD pipeline when candle finalizes (every 3 min)

    CRITICAL: This function contains EXACT same logic as original /api/lob-density endpoint
    to ensure identical results. Only difference is caching the result.
    """
    try:
        # Parse t0 (EXACT same logic as original endpoint)
        if t0:
            t0_dt = t0
        else:
            t0_dt = datetime.now(timezone.utc)

        # Get runs before t0 (EXACT same query as original)
        from_time = t0_dt - timedelta(hours=hours)

        with DatabaseService.get_session() as session:
            runs = session.query(Run).filter(
                Run.symbol == symbol,
                Run.t_end < t0_dt,
                Run.t_end >= from_time
            ).all()

            # Get current price at t0 (EXACT same logic)
            last_candle = DatabaseService.get_last_finalized_candle(symbol)
            if last_candle:
                p_current = last_candle['price_close']
            else:
                p_current = 100000.0

            # Price range (extract all data while in session) - EXACT same extraction
            all_prices = [float(r.price_mid) for r in runs]
            runs_data = [{
                'dir': r.dir,
                'price_start': float(r.price_start),
                'price_end': float(r.price_end),
                'V_eff': float(r.V_eff),
                't_end': r.t_end
            } for r in runs]
            if all_prices:
                p_min = min(all_prices) - 1000
                p_max = max(all_prices) + 1000
            else:
                p_min = p_current - 10000
                p_max = p_current + 10000

        # Create bins (outside session) - EXACT same bins
        price_bins = list(np.arange(p_min, p_max, price_bin))

        # Compute V_eff profiles with time decay - EXACT same computation
        lambda_decay = np.log(2) / (2 * 3600)
        V_up_profile = []
        V_down_profile = []

        runs_up = [r for r in runs_data if r['dir'] == 'up']
        runs_down = [r for r in runs_data if r['dir'] == 'down']

        for p in price_bins:
            # V_up - EXACT same logic
            runs_at_p = [r for r in runs_up if
                         ((r['price_start'] <= p <= r['price_end']) or (r['price_start'] >= p >= r['price_end']))]

            if runs_at_p:
                weights = [np.exp(-lambda_decay * (t0_dt - r['t_end']).total_seconds()) for r in runs_at_p]
                V_up = np.average([r['V_eff'] for r in runs_at_p], weights=weights)
                V_up_profile.append(V_up)
            else:
                V_up_profile.append(0.0)

            # V_down - EXACT same logic
            runs_at_p = [r for r in runs_down if
                         ((r['price_start'] <= p <= r['price_end']) or (r['price_start'] >= p >= r['price_end']))]

            if runs_at_p:
                weights = [np.exp(-lambda_decay * (t0_dt - r['t_end']).total_seconds()) for r in runs_at_p]
                V_down = np.average([r['V_eff'] for r in runs_at_p], weights=weights)
                V_down_profile.append(V_down)
            else:
                V_down_profile.append(0.0)

        V_up_arr = np.array(V_up_profile)
        V_down_arr = np.array(V_down_profile)
        V_diff = V_down_arr - V_up_arr

        # Smooth - EXACT same smoothing
        V_diff_smooth = gaussian_filter1d(V_diff, sigma=2)

        # Store in cache - NEW: cache the result
        lob_data = {
            'timestamp': t0_dt.isoformat().replace('+00:00', 'Z') if '+00:00' in t0_dt.isoformat() else t0_dt.isoformat() + 'Z',
            'symbol': symbol,
            'p_current': p_current,
            'price_bins': price_bins,
            'V_up': V_up_arr.tolist(),
            'V_down': V_down_arr.tolist(),
            'V_diff': V_diff.tolist(),
            'V_diff_smooth': V_diff_smooth.tolist()
        }

        lob_cache.set(symbol, lob_data)
        logger.info(f"[LOB] Calculated and cached density for {symbol} | bins={len(price_bins)} | runs={len(runs_data)}")

    except Exception as e:
        logger.error(f"[LOB] Error calculating density: {e}")
