"""
Triple Barrier Zone Analysis for Backend
Adapts backtest logic for hourly execution in production

Logic:
1. Load last 960 candles (2 days @ 3min)
2. For each signal (v2, v3):
   - Analyze LONG with all 45 barriers
   - Analyze SHORT with all 45 barriers
   - Pick best (max Sharpe) between LONG and SHORT
3. Return zone with is_long flag
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta
from scipy import stats

from app.database import DatabaseService, CVDCandle


# ============================================================================
# TRIPLE BARRIER LOGIC (Adapted from backtest/)
# ============================================================================

def apply_triple_barrier(df: pd.DataFrame, entry_idx: int,
                        tp_pct: float, sl_pct: float,
                        max_candles: int, direction: str = 'LONG') -> Dict:
    """
    Apply triple barrier to a single entry

    Returns:
        Dict with exit_type, return_pct, candles_held, direction
    """
    entry_price = df.iloc[entry_idx]['price_close']
    max_idx = min(entry_idx + max_candles, len(df) - 1)

    if direction == 'LONG':
        tp_price = entry_price * (1 + tp_pct / 100)
        sl_price = entry_price * (1 - abs(sl_pct) / 100)

        for j in range(entry_idx + 1, max_idx + 1):
            price = df.iloc[j]['price_close']

            if price >= tp_price:
                return {
                    'exit_type': 'TP',
                    'return_pct': (price - entry_price) / entry_price * 100,
                    'candles_held': j - entry_idx,
                    'direction': 'LONG'
                }

            if price <= sl_price:
                return {
                    'exit_type': 'SL',
                    'return_pct': (price - entry_price) / entry_price * 100,
                    'candles_held': j - entry_idx,
                    'direction': 'LONG'
                }

        exit_price = df.iloc[max_idx]['price_close']
        return {
            'exit_type': 'TIME',
            'return_pct': (exit_price - entry_price) / entry_price * 100,
            'candles_held': max_idx - entry_idx,
            'direction': 'LONG'
        }

    else:  # SHORT
        tp_price = entry_price * (1 - tp_pct / 100)
        sl_price = entry_price * (1 + abs(sl_pct) / 100)

        for j in range(entry_idx + 1, max_idx + 1):
            price = df.iloc[j]['price_close']

            if price <= tp_price:
                return_pct = (entry_price - price) / entry_price * 100
                return {
                    'exit_type': 'TP',
                    'return_pct': return_pct,
                    'candles_held': j - entry_idx,
                    'direction': 'SHORT'
                }

            if price >= sl_price:
                return_pct = (entry_price - price) / entry_price * 100
                return {
                    'exit_type': 'SL',
                    'return_pct': return_pct,
                    'candles_held': j - entry_idx,
                    'direction': 'SHORT'
                }

        exit_price = df.iloc[max_idx]['price_close']
        return_pct = (entry_price - exit_price) / entry_price * 100
        return {
            'exit_type': 'TIME',
            'return_pct': return_pct,
            'candles_held': max_idx - entry_idx,
            'direction': 'SHORT'
        }


def find_zone_entries(df: pd.DataFrame, signal_col: str,
                     min_sig: float, max_sig: float) -> List[int]:
    """Find all entry indices where signal is within zone"""
    entries = []
    for i in range(len(df)):
        sig = df.iloc[i][signal_col]
        if sig is not None and min_sig <= sig < max_sig:
            entries.append(i)
    return entries


def analyze_zone(df: pd.DataFrame, signal_col: str,
                zone_min: float, zone_max: float,
                barriers: List[Tuple[float, float, int]],
                direction: str, min_samples: int = 10) -> Optional[Dict]:
    """
    Analyze single zone with all barriers for given direction

    Returns best config (max Sharpe) or None if not enough samples
    """
    entries = find_zone_entries(df, signal_col, zone_min, zone_max)

    if len(entries) < min_samples:
        return None

    best_config = None
    best_sharpe = -np.inf

    for tp_pct, sl_pct, max_candles in barriers:
        outcomes = [apply_triple_barrier(df, i, tp_pct, sl_pct, max_candles, direction)
                   for i in entries]

        returns = np.array([o['return_pct'] for o in outcomes])
        exit_types = [o['exit_type'] for o in outcomes]

        n_trades = len(returns)
        if n_trades < min_samples:
            continue

        # Stats
        mean_return = np.mean(returns)
        std_return = np.std(returns, ddof=1)
        sharpe = mean_return / std_return if std_return > 0 else 0

        win_rate = sum(1 for t in exit_types if t == 'TP') / n_trades

        # 95% CI
        if n_trades > 1:
            ci_95 = stats.t.interval(0.95, n_trades - 1,
                                    loc=mean_return,
                                    scale=stats.sem(returns))
            ci_95_lower, ci_95_upper = ci_95
        else:
            ci_95_lower = ci_95_upper = mean_return

        if sharpe > best_sharpe:
            best_sharpe = sharpe
            best_config = {
                'zone_min': zone_min,
                'zone_max': zone_max,
                'direction': direction,
                'sharpe': sharpe,
                'win_rate': win_rate,
                'mean_return': mean_return,
                'n_trades': n_trades,
                'tp_pct': tp_pct,
                'sl_pct': sl_pct,
                'max_candles': max_candles,
                'ci_95_lower': ci_95_lower,
                'ci_95_upper': ci_95_upper
            }

    return best_config


# ============================================================================
# BARRIER CONFIGURATIONS
# ============================================================================

def generate_barriers() -> List[Tuple[float, float, int]]:
    """Generate 45 barrier configurations (same as backtest config.py)"""
    barriers = []
    for base_sl in [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]:
        for rr_ratio in [1.0, 1.25, 1.5, 1.75, 2.0]:
            tp = base_sl * rr_ratio
            sl = -base_sl

            if tp <= 0.5:
                max_candles = 15
            elif tp <= 1.0:
                max_candles = 20
            else:
                max_candles = 30

            barriers.append((tp, sl, max_candles))

    return barriers


# ============================================================================
# ZONE DEFINITIONS
# ============================================================================

def generate_entry_zones() -> List[Tuple[float, float]]:
    """Generate 16 zones of 2 units each, excluding central zone [-4, +4]"""
    zones = []
    # Negative zones: [-20, -18], ..., [-6, -4]
    for min_sig in range(-20, -4, 2):
        zones.append((min_sig, min_sig + 2))
    # Positive zones: [4, 6], [6, 8], ..., [18, 20]
    for min_sig in range(4, 20, 2):
        zones.append((min_sig, min_sig + 2))
    return zones


# ============================================================================
# MAIN ANALYSIS FUNCTION
# ============================================================================

def analyze_optimal_zones(symbol: str = 'BTC', window_days: int = 2,
                         min_samples: int = 10) -> Dict:
    """
    Find optimal zones for each signal (v2, v3)

    Logic:
    1. Load last 960 candles (2 days @ 3min)
    2. For each signal (v2, v3):
       - For each of 20 zones:
         - Analyze LONG with all 45 barriers → best LONG
         - Analyze SHORT with all 45 barriers → best SHORT
         - Pick winner (max Sharpe)
       - Return best overall zone

    Returns:
        {
            'cumulative_v2': {
                'is_long': True,
                'zone_min': 12,
                'zone_max': 14,
                'sharpe': 5.82,
                'win_rate': 0.545,
                'mean_return': 0.76,
                'n_trades': 150,
                'tp_pct': 0.8,
                'sl_pct': -0.8,
                'max_candles': 20,
                'ci_95_lower': 0.60,
                'ci_95_upper': 0.92,
                'analysis_window_candles': 960
            },
            'cumulative_v3': { ... }
        }
    """

    # Load last 960 candles (2 days @ 3min)
    window_candles = window_days * 24 * 60 // 3  # 960

    with DatabaseService.get_session() as session:
        candles = session.query(CVDCandle).filter(
            CVDCandle.symbol == symbol,
            CVDCandle.finalized == True
        ).order_by(CVDCandle.timestamp.desc()).limit(window_candles).all()

        if not candles:
            raise ValueError(f"No finalized candles found for {symbol}")

        # Convert to DataFrame (reverse to chronological order)
        candles = list(reversed(candles))
        df = pd.DataFrame([{
            'timestamp': c.timestamp,
            'price_close': float(c.price_close),
            'cumulative_v2': float(c.cumulative_v2) if c.cumulative_v2 is not None else 0,
            'cumulative_v3': float(c.cumulative_v3) if c.cumulative_v3 is not None else 0
        } for c in candles])

    print(f"[Zone Analysis] Loaded {len(df)} candles for {symbol}")

    # Generate configurations
    barriers = generate_barriers()
    entry_zones = generate_entry_zones()

    results = {}

    for signal_col in ['cumulative_v2', 'cumulative_v3']:
        print(f"\n[Zone Analysis] Analyzing {signal_col}...")

        best_overall = None
        best_overall_sharpe = -np.inf

        for zone_min, zone_max in entry_zones:
            # Analyze LONG
            long_config = analyze_zone(df, signal_col, zone_min, zone_max,
                                      barriers, 'LONG', min_samples)

            # Analyze SHORT
            short_config = analyze_zone(df, signal_col, zone_min, zone_max,
                                       barriers, 'SHORT', min_samples)

            # Pick best between LONG and SHORT for this zone
            zone_best = None
            if long_config and short_config:
                zone_best = long_config if long_config['sharpe'] > short_config['sharpe'] else short_config
            elif long_config:
                zone_best = long_config
            elif short_config:
                zone_best = short_config

            # Check if this is best overall
            if zone_best and zone_best['sharpe'] > best_overall_sharpe:
                best_overall_sharpe = zone_best['sharpe']
                best_overall = zone_best

        if best_overall:
            results[signal_col] = {
                'is_long': best_overall['direction'] == 'LONG',
                'zone_min': best_overall['zone_min'],
                'zone_max': best_overall['zone_max'],
                'sharpe': best_overall['sharpe'],
                'win_rate': best_overall['win_rate'],
                'mean_return': best_overall['mean_return'],
                'n_trades': best_overall['n_trades'],
                'tp_pct': best_overall['tp_pct'],
                'sl_pct': best_overall['sl_pct'],
                'max_candles': best_overall['max_candles'],
                'ci_95_lower': best_overall['ci_95_lower'],
                'ci_95_upper': best_overall['ci_95_upper'],
                'analysis_window_candles': len(df)
            }

            direction_label = "LONG" if results[signal_col]['is_long'] else "SHORT"
            print(f"  Best {signal_col}: {direction_label} Zone [{best_overall['zone_min']}, {best_overall['zone_max']}) "
                  f"Sharpe={best_overall['sharpe']:.2f} WinRate={best_overall['win_rate']*100:.1f}%")
        else:
            print(f"  WARNING: No valid zone found for {signal_col}")

    return results


if __name__ == '__main__':
    # Test
    print("Testing zone analysis...")
    results = analyze_optimal_zones()

    for signal, data in results.items():
        print(f"\n{signal}:")
        print(f"  Direction: {'LONG' if data['is_long'] else 'SHORT'}")
        print(f"  Zone: [{data['zone_min']}, {data['zone_max']})")
        print(f"  Sharpe: {data['sharpe']:.2f}")
        print(f"  Win Rate: {data['win_rate']*100:.1f}%")
        print(f"  Mean Return: {data['mean_return']:+.2f}%")
        print(f"  N Trades: {data['n_trades']}")
