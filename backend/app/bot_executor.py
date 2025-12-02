"""
Bot Execution Engine
Real-time paper trading bot execution with signal detection and position management
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional, Dict, List
from decimal import Decimal

from app.database import DatabaseService

logger = logging.getLogger(__name__)


# ============================================================================
# SIGNAL DETECTION
# ============================================================================

async def check_entry_signals(bot: Dict, candle: Dict, zones: Dict) -> Optional[Dict]:
    """
    Check if bot should enter a position based on strategy type

    OPPOSITE SIGNAL LOGIC:
    If zone is LONG at [zone_min, zone_max), also enter SHORT at [-zone_max, -zone_min)
    If zone is SHORT at [zone_min, zone_max), also enter LONG at [-zone_max, -zone_min)

    Args:
        bot: Bot dict with strategy_type
        candle: Latest finalized CVDCandle dict with cumulative_v2/v3
        zones: Latest zone_snapshots dict with cumulative_v2/v3 zones

    Returns:
        Dict with entry params if signal detected, None otherwise
        {
            'direction': 'LONG'|'SHORT',
            'entry_price': float,
            'signal_v2': float,
            'signal_v3': float,
            'tp_pct': float,
            'sl_pct': float,
            'max_candles': int
        }
    """
    strategy_type = bot['strategy_type']
    signal_v2 = candle['cumulative_v2']
    signal_v3 = candle['cumulative_v3']
    entry_price = candle['price_close']

    if strategy_type == 'v2_pure':
        # V2 Pure: Enter when cumulative_v2 in optimal V2 zone OR opposite zone
        if 'cumulative_v2' not in zones:
            return None

        v2_zone = zones['cumulative_v2']
        zone_min, zone_max = v2_zone['zone_min'], v2_zone['zone_max']

        # Check original zone
        if zone_min <= signal_v2 <= zone_max:
            return {
                'direction': 'LONG' if v2_zone['is_long'] else 'SHORT',
                'entry_price': entry_price,
                'signal_v2': signal_v2,
                'signal_v3': signal_v3,
                'tp_pct': v2_zone['tp_pct'],
                'sl_pct': v2_zone['sl_pct'],
                'max_candles': v2_zone['max_candles']
            }

        # Check opposite zone
        if -zone_max <= signal_v2 <= -zone_min:
            return {
                'direction': 'SHORT' if v2_zone['is_long'] else 'LONG',
                'entry_price': entry_price,
                'signal_v2': signal_v2,
                'signal_v3': signal_v3,
                'tp_pct': v2_zone['tp_pct'],
                'sl_pct': v2_zone['sl_pct'],
                'max_candles': v2_zone['max_candles']
            }

    elif strategy_type == 'v3_momentum':
        # V3 Momentum: Enter when cumulative_v3 in optimal V3 zone OR opposite zone
        if 'cumulative_v3' not in zones:
            return None

        v3_zone = zones['cumulative_v3']
        zone_min, zone_max = v3_zone['zone_min'], v3_zone['zone_max']

        # Check original zone
        if zone_min <= signal_v3 <= zone_max:
            return {
                'direction': 'LONG' if v3_zone['is_long'] else 'SHORT',
                'entry_price': entry_price,
                'signal_v2': signal_v2,
                'signal_v3': signal_v3,
                'tp_pct': v3_zone['tp_pct'],
                'sl_pct': v3_zone['sl_pct'],
                'max_candles': v3_zone['max_candles']
            }

        # Check opposite zone
        if -zone_max <= signal_v3 <= -zone_min:
            return {
                'direction': 'SHORT' if v3_zone['is_long'] else 'LONG',
                'entry_price': entry_price,
                'signal_v2': signal_v2,
                'signal_v3': signal_v3,
                'tp_pct': v3_zone['tp_pct'],
                'sl_pct': v3_zone['sl_pct'],
                'max_candles': v3_zone['max_candles']
            }

    elif strategy_type == 'consensus':
        # Consensus: Enter ONLY when V2 and V3 zones agree on direction (original OR opposite)
        if 'cumulative_v2' not in zones or 'cumulative_v3' not in zones:
            return None

        v2_zone = zones['cumulative_v2']
        v3_zone = zones['cumulative_v3']

        # Check ORIGINAL zones
        v2_in_zone = v2_zone['zone_min'] <= signal_v2 <= v2_zone['zone_max']
        v3_in_zone = v3_zone['zone_min'] <= signal_v3 <= v3_zone['zone_max']

        # Check OPPOSITE zones
        v2_in_opposite = -v2_zone['zone_max'] <= signal_v2 <= -v2_zone['zone_min']
        v3_in_opposite = -v3_zone['zone_max'] <= signal_v3 <= -v3_zone['zone_min']

        # Use average of V2/V3 parameters
        avg_tp = (v2_zone['tp_pct'] + v3_zone['tp_pct']) / 2
        avg_sl = (v2_zone['sl_pct'] + v3_zone['sl_pct']) / 2
        avg_candles = int((v2_zone['max_candles'] + v3_zone['max_candles']) / 2)

        # Case 1: Both in ORIGINAL zones AND agree on direction
        if v2_in_zone and v3_in_zone and (v2_zone['is_long'] == v3_zone['is_long']):
            return {
                'direction': 'LONG' if v2_zone['is_long'] else 'SHORT',
                'entry_price': entry_price,
                'signal_v2': signal_v2,
                'signal_v3': signal_v3,
                'tp_pct': avg_tp,
                'sl_pct': avg_sl,
                'max_candles': avg_candles
            }

        # Case 2: Both in OPPOSITE zones AND agree on OPPOSITE direction
        if v2_in_opposite and v3_in_opposite and (v2_zone['is_long'] == v3_zone['is_long']):
            return {
                'direction': 'SHORT' if v2_zone['is_long'] else 'LONG',
                'entry_price': entry_price,
                'signal_v2': signal_v2,
                'signal_v3': signal_v3,
                'tp_pct': avg_tp,
                'sl_pct': avg_sl,
                'max_candles': avg_candles
            }

    elif strategy_type == 'v2v3_or':
        # V2+V3 OR Conservative: Enter when AT LEAST ONE of V2 or V3 is in zone AND zones agree on direction
        if 'cumulative_v2' not in zones or 'cumulative_v3' not in zones:
            return None

        v2_zone = zones['cumulative_v2']
        v3_zone = zones['cumulative_v3']

        # Check ORIGINAL zones
        v2_in_zone = v2_zone['zone_min'] <= signal_v2 <= v2_zone['zone_max']
        v3_in_zone = v3_zone['zone_min'] <= signal_v3 <= v3_zone['zone_max']

        # Check OPPOSITE zones
        v2_in_opposite = -v2_zone['zone_max'] <= signal_v2 <= -v2_zone['zone_min']
        v3_in_opposite = -v3_zone['zone_max'] <= signal_v3 <= -v3_zone['zone_min']

        # Use average of V2/V3 parameters
        avg_tp = (v2_zone['tp_pct'] + v3_zone['tp_pct']) / 2
        avg_sl = (v2_zone['sl_pct'] + v3_zone['sl_pct']) / 2
        avg_candles = int((v2_zone['max_candles'] + v3_zone['max_candles']) / 2)

        # Case 1: At least one in ORIGINAL zone AND both zones are LONG (or both SHORT)
        if (v2_in_zone or v3_in_zone) and (v2_zone['is_long'] == v3_zone['is_long']):
            return {
                'direction': 'LONG' if v2_zone['is_long'] else 'SHORT',
                'entry_price': entry_price,
                'signal_v2': signal_v2,
                'signal_v3': signal_v3,
                'tp_pct': avg_tp,
                'sl_pct': avg_sl,
                'max_candles': avg_candles
            }

        # Case 2: At least one in OPPOSITE zone AND both zones agree (for opposite direction)
        if (v2_in_opposite or v3_in_opposite) and (v2_zone['is_long'] == v3_zone['is_long']):
            return {
                'direction': 'SHORT' if v2_zone['is_long'] else 'LONG',
                'entry_price': entry_price,
                'signal_v2': signal_v2,
                'signal_v3': signal_v3,
                'tp_pct': avg_tp,
                'sl_pct': avg_sl,
                'max_candles': avg_candles
            }

    elif strategy_type == 'v2v3_or_aggressive':
        # V2+V3 OR Aggressive: Enter when AT LEAST ONE of V2 or V3 is in zone (NO agreement required)
        if 'cumulative_v2' not in zones or 'cumulative_v3' not in zones:
            return None

        v2_zone = zones['cumulative_v2']
        v3_zone = zones['cumulative_v3']

        # Check ORIGINAL zones
        v2_in_zone = v2_zone['zone_min'] <= signal_v2 <= v2_zone['zone_max']
        v3_in_zone = v3_zone['zone_min'] <= signal_v3 <= v3_zone['zone_max']

        # Check OPPOSITE zones
        v2_in_opposite = -v2_zone['zone_max'] <= signal_v2 <= -v2_zone['zone_min']
        v3_in_opposite = -v3_zone['zone_max'] <= signal_v3 <= -v3_zone['zone_min']

        # Determine which signals are active and their directions
        v2_signal_direction = None
        v3_signal_direction = None

        if v2_in_zone:
            v2_signal_direction = 'LONG' if v2_zone['is_long'] else 'SHORT'
        elif v2_in_opposite:
            v2_signal_direction = 'SHORT' if v2_zone['is_long'] else 'LONG'

        if v3_in_zone:
            v3_signal_direction = 'LONG' if v3_zone['is_long'] else 'SHORT'
        elif v3_in_opposite:
            v3_signal_direction = 'SHORT' if v3_zone['is_long'] else 'LONG'

        # If BOTH signals active but CONFLICTING directions → NO ENTRY (conflict)
        if v2_signal_direction and v3_signal_direction and v2_signal_direction != v3_signal_direction:
            return None

        # If at least ONE signal active
        if v2_signal_direction or v3_signal_direction:
            # Determine entry direction (use agreed direction if both, or single signal direction)
            entry_direction = v2_signal_direction if v2_signal_direction else v3_signal_direction

            # Determine parameters: if both signals, use average; if only one, use its parameters
            if v2_signal_direction and v3_signal_direction:
                # Both signals agree
                tp_pct = (v2_zone['tp_pct'] + v3_zone['tp_pct']) / 2
                sl_pct = (v2_zone['sl_pct'] + v3_zone['sl_pct']) / 2
                max_candles = int((v2_zone['max_candles'] + v3_zone['max_candles']) / 2)
            elif v2_signal_direction:
                # Only V2 signal
                tp_pct = v2_zone['tp_pct']
                sl_pct = v2_zone['sl_pct']
                max_candles = v2_zone['max_candles']
            else:
                # Only V3 signal
                tp_pct = v3_zone['tp_pct']
                sl_pct = v3_zone['sl_pct']
                max_candles = v3_zone['max_candles']

            return {
                'direction': entry_direction,
                'entry_price': entry_price,
                'signal_v2': signal_v2,
                'signal_v3': signal_v3,
                'tp_pct': tp_pct,
                'sl_pct': sl_pct,
                'max_candles': max_candles
            }

    return None


# ============================================================================
# POSITION ENTRY
# ============================================================================

async def enter_position(bot: Dict, entry_params: Dict, timestamp: datetime) -> int:
    """
    Open new position for bot

    Args:
        bot: Bot dict with current_balance
        entry_params: Entry signal params from check_entry_signals()
        timestamp: Entry timestamp

    Returns:
        Trade ID
    """
    direction = entry_params['direction']
    entry_price = entry_params['entry_price']
    tp_pct = entry_params['tp_pct']
    sl_pct = entry_params['sl_pct']
    max_candles = entry_params['max_candles']

    # Bot leverage and fee configuration (SAME AS BACKFILL)
    leverage = float(bot.get('leverage', 10.0))
    trading_fee_pct = float(bot.get('trading_fee_pct', 0.04))

    # Capital allocation (inverse of leverage: 10x = 10%)
    capital_pct = 1.0 / leverage
    capital_allocated = float(bot['current_balance']) * capital_pct

    # Notional value (market exposure with leverage)
    notional_value = capital_allocated * leverage

    # Entry fee (on notional value)
    entry_fee = notional_value * (trading_fee_pct / 100)

    # Position size
    position_size = capital_allocated / entry_price

    # Calculate TP/SL prices
    if direction == 'LONG':
        tp_price = entry_price * (1 + tp_pct / 100)
        sl_price = entry_price * (1 - sl_pct / 100)
    else:  # SHORT
        tp_price = entry_price * (1 - tp_pct / 100)
        sl_price = entry_price * (1 + sl_pct / 100)

    # Create trade record
    trade_data = {
        'bot_id': bot['id'],
        'symbol': 'BTC',
        'entry_timestamp': timestamp,
        'entry_price': Decimal(str(entry_price)),
        'entry_signal_v2': Decimal(str(entry_params['signal_v2'])),
        'entry_signal_v3': Decimal(str(entry_params['signal_v3'])),
        'direction': direction,
        'position_size': Decimal(str(position_size)),
        'capital_allocated': Decimal(str(capital_allocated)),
        'tp_pct': Decimal(str(tp_pct)),
        'sl_pct': Decimal(str(sl_pct)),
        'max_candles': max_candles,
        'tp_price': Decimal(str(tp_price)),
        'sl_price': Decimal(str(sl_price)),
        'leverage': Decimal(str(leverage)),
        'entry_fee': Decimal(str(entry_fee)),
        'status': 'open'
    }

    trade_id = DatabaseService.create_trade(trade_data)

    # Update bot balance (subtract allocated capital - SAME AS BACKFILL)
    new_balance = float(bot['current_balance']) - capital_allocated
    DatabaseService.update_bot_metrics(bot['id'], {
        'current_balance': Decimal(str(new_balance))
    })

    logger.info(f"[BOT {bot['id']}] Entered {direction} position at {entry_price:.2f} (TP: {tp_price:.2f}, SL: {sl_price:.2f}, Size: {position_size:.6f} BTC)")

    return trade_id


# ============================================================================
# POSITION MONITORING
# ============================================================================

async def check_exit_conditions(trade: Dict, current_candle: Dict, candles_held: int) -> Optional[Dict]:
    """
    Check if open trade should exit based on TP/SL ONLY (NO TIME BARRIER)

    Bots hold positions indefinitely until TP or SL is hit.

    Args:
        trade: BotTrade dict
        current_candle: Latest finalized CVDCandle dict
        candles_held: Number of candles since entry

    Returns:
        Dict with exit info if triggered, None otherwise
        {
            'exit_type': 'TP'|'SL',
            'exit_price': float,
            'candles_held': int
        }
    """
    direction = trade['direction']
    tp_price = trade['tp_price']
    sl_price = trade['sl_price']
    current_price = current_candle['price_close']

    # Check TP (Take Profit)
    if direction == 'LONG' and current_price >= tp_price:
        return {'exit_type': 'TP', 'exit_price': current_price, 'candles_held': candles_held}
    elif direction == 'SHORT' and current_price <= tp_price:
        return {'exit_type': 'TP', 'exit_price': current_price, 'candles_held': candles_held}

    # Check SL (Stop Loss)
    if direction == 'LONG' and current_price <= sl_price:
        return {'exit_type': 'SL', 'exit_price': current_price, 'candles_held': candles_held}
    elif direction == 'SHORT' and current_price >= sl_price:
        return {'exit_type': 'SL', 'exit_price': current_price, 'candles_held': candles_held}

    # NO TIME BARRIER - positions held until TP/SL
    return None


# ============================================================================
# POSITION EXIT
# ============================================================================

async def exit_position(bot: Dict, trade: Dict, exit_params: Dict, timestamp: datetime) -> bool:
    """
    Close position and update bot metrics

    Args:
        bot: Bot dict
        trade: BotTrade dict
        exit_params: Exit info from check_exit_conditions()
        timestamp: Exit timestamp

    Returns:
        True if successful
    """
    exit_type = exit_params['exit_type']
    exit_price = exit_params['exit_price']
    candles_held = exit_params['candles_held']

    entry_price = trade['entry_price']
    direction = trade['direction']
    position_size = trade['position_size']
    capital_allocated = trade['capital_allocated']

    # Bot leverage and fee configuration (SAME AS BACKFILL)
    leverage = float(bot.get('leverage', 10.0))
    trading_fee_pct = float(bot.get('trading_fee_pct', 0.04))

    # Notional value (market exposure with leverage)
    notional_value = capital_allocated * leverage

    # Calculate raw P&L percentage
    if direction == 'LONG':
        raw_pnl_pct = ((exit_price - entry_price) / entry_price) * 100
    else:  # SHORT
        raw_pnl_pct = ((entry_price - exit_price) / entry_price) * 100

    # Leveraged P&L (before fees)
    leveraged_pnl = (raw_pnl_pct * leverage / 100) * capital_allocated

    # Exit fee (on notional value)
    exit_fee = notional_value * (trading_fee_pct / 100)

    # Get entry fee from trade record
    entry_fee = float(trade.get('entry_fee', 0))

    # Net P&L (after fees)
    total_fees = entry_fee + exit_fee
    pnl = leveraged_pnl - total_fees
    pnl_pct = (pnl / capital_allocated) * 100

    # Update trade
    trade_updates = {
        'exit_timestamp': timestamp,
        'exit_price': Decimal(str(exit_price)),
        'exit_type': exit_type,
        'candles_held': candles_held,
        'pnl': Decimal(str(pnl)),
        'pnl_pct': Decimal(str(pnl_pct)),
        'exit_fee': Decimal(str(exit_fee)),
        'total_fees': Decimal(str(total_fees)),
        'status': 'closed'
    }
    DatabaseService.update_trade(trade['id'], trade_updates)

    # Update bot balance (SAME AS BACKFILL - ADD to existing balance)
    new_balance = bot['current_balance'] + capital_allocated + pnl
    new_total_pnl = bot['total_pnl'] + pnl
    new_total_pnl_pct = (new_total_pnl / bot['starting_capital']) * 100

    # Update trade counters
    total_trades = bot['total_trades'] + 1
    winning_trades = bot['winning_trades'] + (1 if pnl > 0 else 0)
    losing_trades = bot['losing_trades'] + (1 if pnl <= 0 else 0)
    win_rate = (winning_trades / total_trades) * 100 if total_trades > 0 else 0

    # Update bot metrics
    DatabaseService.update_bot_metrics(bot['id'], {
        'current_balance': Decimal(str(new_balance)),
        'current_equity': Decimal(str(new_balance)),  # No open positions after exit
        'total_pnl': Decimal(str(new_total_pnl)),
        'total_pnl_pct': Decimal(str(new_total_pnl_pct)),
        'total_trades': total_trades,
        'winning_trades': winning_trades,
        'losing_trades': losing_trades,
        'win_rate': Decimal(str(win_rate))
    })

    logger.info(f"[BOT {bot['id']}] Exited {direction} position ({exit_type}) at {exit_price:.2f} | P&L: ${pnl:.2f} ({pnl_pct:+.2f}%) | Held: {candles_held} candles")

    return True


# ============================================================================
# EQUITY TRACKING
# ============================================================================

async def snapshot_equity(bot: Dict, open_trades: List[Dict], timestamp: datetime, current_price: float) -> int:
    """
    Create equity snapshot for bot

    Args:
        bot: Bot dict
        open_trades: List of open BotTrade dicts
        timestamp: Snapshot timestamp
        current_price: Current BTC price

    Returns:
        Snapshot ID
    """
    balance = bot['current_balance']

    # Calculate unrealized P&L from open positions (SAME AS BACKFILL)
    unrealized_pnl = 0.0
    allocated_capital = 0.0
    for trade in open_trades:
        entry_price = trade['entry_price']
        direction = trade['direction']
        capital_allocated = trade['capital_allocated']
        allocated_capital += capital_allocated

        # Apply leverage to unrealized P&L (SAME AS BACKFILL)
        leverage = float(trade.get('leverage', 10.0))
        entry_fee = float(trade.get('entry_fee', 0))

        # Raw P&L percentage
        if direction == 'LONG':
            raw_pnl_pct = ((current_price - entry_price) / entry_price) * 100
        else:  # SHORT
            raw_pnl_pct = ((entry_price - current_price) / entry_price) * 100

        # Leveraged unrealized P&L (minus entry fee already paid)
        unrealized_pnl += (raw_pnl_pct * leverage / 100) * capital_allocated - entry_fee

    equity = balance + allocated_capital + unrealized_pnl

    equity_data = {
        'timestamp': timestamp,
        'balance': Decimal(str(balance)),
        'equity': Decimal(str(equity)),
        'unrealized_pnl': Decimal(str(unrealized_pnl)),
        'open_positions': len(open_trades)
    }

    snapshot_id = DatabaseService.snapshot_equity(bot['id'], equity_data)

    # Update bot current_equity
    DatabaseService.update_bot_metrics(bot['id'], {
        'current_equity': Decimal(str(equity))
    })

    # Log snapshot with key metrics
    logger.info(
        f"[BOT {bot['id']}] Equity snapshot: ${equity:.2f} "
        f"(Balance: ${balance:.2f}, Unrealized P&L: {unrealized_pnl:+.2f}, "
        f"Open: {len(open_trades)})"
    )

    return snapshot_id


# ============================================================================
# MAIN EXECUTION LOOP
# ============================================================================

async def bot_execution_loop():
    """
    Main async loop that runs every 5 seconds (aligned with cvd_pipeline)

    For each active bot:
        1. Get open positions
        2. Check exit conditions for open positions
        3. Exit positions if conditions met
        4. If no open position, check entry signals
        5. Enter position if signal detected
        6. Snapshot equity (every 3min at candle finalization)
    """
    logger.info("[BOT EXECUTOR] Starting bot execution loop...")

    # Track candles held for each open trade
    candles_held_tracker = {}  # trade_id -> candles_held

    # Track last processed candle timestamp to avoid reprocessing
    # Initialize from database on startup
    from datetime import timezone
    last_processed_timestamp = {}  # bot_id -> last_timestamp
    bots = DatabaseService.get_active_bots()
    for bot in bots:
        last_snap = DatabaseService.get_latest_equity_snapshot(bot['id'])
        if last_snap:
            ts = last_snap['timestamp']
            if isinstance(ts, str):
                ts = datetime.fromisoformat(ts.replace('Z', '+00:00'))
            # Ensure timezone-aware
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            last_processed_timestamp[bot['id']] = ts

    logger.info(f"[BOT EXECUTOR] Initialized with last processed timestamps: {last_processed_timestamp}")

    while True:
        try:
            await asyncio.sleep(5)

            # Get latest finalized candle
            candle = DatabaseService.get_last_finalized_candle()
            if not candle:
                continue

            # Get latest zones
            zones = DatabaseService.get_latest_zones()
            if not zones:
                continue

            # Normalize candle timestamp ONCE at the beginning (before any bot processing)
            candle_ts = candle['timestamp']
            if isinstance(candle_ts, str):
                candle_ts = datetime.fromisoformat(candle_ts.replace('Z', '+00:00'))
            # Ensure timezone-aware
            if candle_ts.tzinfo is None:
                from datetime import timezone
                candle_ts = candle_ts.replace(tzinfo=timezone.utc)

            # Get active bots
            bots = DatabaseService.get_active_bots()

            for bot in bots:
                try:
                    # Get open trades
                    open_trades = DatabaseService.get_open_trades(bot['id'])

                    # Process open positions (check exits)
                    for trade in open_trades:
                        # Track candles held
                        if trade['id'] not in candles_held_tracker:
                            candles_held_tracker[trade['id']] = 0
                        candles_held_tracker[trade['id']] += 1

                        candles_held = candles_held_tracker[trade['id']]

                        # Check exit conditions
                        exit_params = await check_exit_conditions(trade, candle, candles_held)
                        if exit_params:
                            await exit_position(bot, trade, exit_params, candle_ts)
                            # Remove from tracker
                            del candles_held_tracker[trade['id']]

                    # If no open position, check entry signals
                    # Refresh open_trades after potential exits
                    open_trades = DatabaseService.get_open_trades(bot['id'])
                    if len(open_trades) == 0:
                        entry_params = await check_entry_signals(bot, candle, zones)
                        if entry_params:
                            # Refresh bot to get latest balance
                            bot = DatabaseService.get_bot_by_id(bot['id'])
                            if bot and bot['status'] == 'active':
                                await enter_position(bot, entry_params, candle_ts)

                    # Snapshot equity (every 3min when candle finalizes)
                    # Candle timestamps are at 3-minute intervals
                    if candle_ts.minute % 3 == 0 and candle_ts.second == 0:
                        # Skip if already processed this candle for this bot
                        if bot['id'] in last_processed_timestamp and last_processed_timestamp[bot['id']] >= candle_ts:
                            continue  # Already processed

                        # Refresh bot and open trades for snapshot
                        bot = DatabaseService.get_bot_by_id(bot['id'])
                        open_trades = DatabaseService.get_open_trades(bot['id'])
                        await snapshot_equity(bot, open_trades, candle_ts, candle['price_close'])

                        # Mark as processed
                        last_processed_timestamp[bot['id']] = candle_ts

                except Exception as e:
                    logger.error(f"[BOT {bot['id']}] Error in bot execution: {e}", exc_info=True)
                    continue

        except Exception as e:
            logger.error(f"[BOT EXECUTOR] Error in main loop: {e}", exc_info=True)
            await asyncio.sleep(5)
