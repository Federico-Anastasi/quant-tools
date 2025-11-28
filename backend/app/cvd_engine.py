"""
CVD Engine - Core calculation logic
Build frames, calculate signals, cumulatives v1/v2/v3
"""

import pandas as pd
import numpy as np
from typing import Dict, Tuple, Optional

EPS = 1e-8
CLIP = 20


def floor_to_3min(ts: pd.Timestamp) -> pd.Timestamp:
    """Floor timestamp to 3-minute boundary"""
    return ts.floor('3min')


def classify(delta_p: float, delta_cvd: float, ratio: float, ratio_strong: float = 1.5, ratio_weak: float = 0.5) -> int:
    """
    Classify signal based on price/CVD movement and efficiency ratio

    Returns:
        +3/-3: Strong coherent (ratio > 1.5)
        +2/-2: Divergence (ratio < 0)
        +1/-1: Absorption (0 < ratio < 0.5)
        0: Neutral
    """
    if abs(delta_cvd) < 0.1:
        return 0
    if ratio > ratio_strong:
        return +3 if delta_p > 0 else -3
    elif ratio < 0:
        return -2 if delta_p > 0 else +2
    elif ratio >= 0 and ratio < ratio_weak:
        return -1 if delta_p > 0 else +1
    else:
        return 0


def build_frames(trades: list, historical_candles: Optional[list] = None, last_cvd_close: float = 0.0) -> Dict:
    """
    Build OHLC price + CVD + metrics from trades

    Args:
        trades: List of dicts [{timestamp, price, size, side}, ...]
        historical_candles: Last 10 finalized candles for rolling avg (optional)
        last_cvd_close: CVD value from last candle to maintain continuity (default 0.0)

    Returns:
        Dict with price_ohlc, cvd_ohlc, volume_buy, volume_sell, efficiency_ratio, signal
    """
    if not trades:
        return None

    df = pd.DataFrame(trades)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp')

    # Price OHLC (single candle from trades)
    price_ohlc = {
        'open': float(df.iloc[0]['price']),
        'high': float(df['price'].max()),
        'low': float(df['price'].min()),
        'close': float(df.iloc[-1]['price'])
    }

    # CVD calculation - CUMULATIVE (continue from last_cvd_close)
    df['delta'] = np.where(df['side'] == 'B', df['size'], -df['size'])
    cvd_tick = last_cvd_close + df['delta'].cumsum()

    cvd_ohlc = {
        'open': float(cvd_tick.iloc[0]),
        'high': float(cvd_tick.max()),
        'low': float(cvd_tick.min()),
        'close': float(cvd_tick.iloc[-1])
    }

    # Volume
    volume_buy = float(df[df['side'] == 'B']['size'].sum())
    volume_sell = float(df[df['side'] == 'A']['size'].sum())

    # Efficiency ratio calculation
    delta_price = price_ohlc['close'] - price_ohlc['open']
    delta_cvd = cvd_ohlc['close'] - cvd_ohlc['open']

    # Rolling average from historical candles (window=10)
    if historical_candles and len(historical_candles) > 0:
        # Filter out candles with NULL values
        hist_delta_price = [
            abs(c['price_close'] - c['price_open'])
            for c in historical_candles[-10:]
            if c['price_close'] is not None and c['price_open'] is not None
        ]
        hist_delta_cvd = [
            abs(c['cvd_close'] - c['cvd_open'])
            for c in historical_candles[-10:]
            if c['cvd_close'] is not None and c['cvd_open'] is not None
        ]

        if hist_delta_price and hist_delta_cvd:
            # Rolling average ONLY from historical candles (NO current candle)
            avg_abs_price = np.mean(hist_delta_price)
            avg_abs_cvd = np.mean(hist_delta_cvd)
        else:
            # No historical data - use reasonable defaults (NOT current candle)
            # Use typical BTC 3min movement as baseline
            avg_abs_price = 50.0  # ~$50 typical 3min BTC movement
            avg_abs_cvd = 5.0     # ~5 BTC typical 3min CVD delta
    else:
        # No historical data - use reasonable defaults
        avg_abs_price = 50.0  # ~$50 typical 3min BTC movement
        avg_abs_cvd = 5.0     # ~5 BTC typical 3min CVD delta

    norm_dp = delta_price / (avg_abs_price + EPS)
    norm_dcvd = delta_cvd / (avg_abs_cvd + EPS)
    efficiency_ratio = np.clip(norm_dp / (norm_dcvd + EPS), -CLIP, CLIP)

    signal = classify(delta_price, delta_cvd, efficiency_ratio)

    return {
        'price_ohlc': price_ohlc,
        'cvd_ohlc': cvd_ohlc,
        'volume_buy': volume_buy,
        'volume_sell': volume_sell,
        'efficiency_ratio': float(efficiency_ratio),
        'signal': signal
    }


def calculate_cumulative_v1(last_value: float, new_signal: int) -> float:
    """
    Cumulative v1: Simple sum (NO RESET)
    """
    return last_value + new_signal


def calculate_cumulative_v2(last_value: float, new_signal: int, efficiency_ratio: float, decay: float = 0.95) -> Tuple[float, float]:
    """
    Cumulative v2: Weighted with decay

    Returns:
        (cumulative_v2, signal_quality)
    """
    eff_factor = 1.0 + max(min((efficiency_ratio - 0.5) * 0.5, 0.25), -0.25)
    signal_quality = new_signal * eff_factor
    cumulative_v2 = last_value * decay + signal_quality

    return cumulative_v2, signal_quality


def calculate_cumulative_v3(new_v1: float, last_ema: float, period: int = 14) -> Tuple[float, float]:
    """
    Cumulative v3: Momentum (v1 - EMA)

    Returns:
        (cumulative_v3, new_ema)
    """
    alpha = 2 / (period + 1)
    new_ema = alpha * new_v1 + (1 - alpha) * last_ema
    momentum = new_v1 - new_ema

    return momentum, new_ema
