"""
Bot Trades Historical Backfill
Executes bot trades using saved zone snapshots from database
"""

import sys
import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, List, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import DatabaseService, CVDCandle, ZoneSnapshot, Bot, BotTrade
from app.bot_executor import check_entry_signals, check_exit_conditions




def get_last_zone_before(candle_timestamp: datetime, symbol: str = "BTC") -> Optional[Dict]:
    """
    Get the LAST (most recent) zone snapshot BEFORE or AT the candle timestamp

    This is critical: zones are calculated hourly or irregularly, but bots run every 3 minutes.
    Each candle uses the most recent zone data available at that time.
    """
    with DatabaseService.get_session() as session:
        # Get the most recent zone snapshot timestamp before this candle
        zone_snapshot_ts = session.query(ZoneSnapshot.timestamp).filter(
            ZoneSnapshot.timestamp <= candle_timestamp,
            ZoneSnapshot.symbol == symbol
        ).order_by(ZoneSnapshot.timestamp.desc()).first()

        if not zone_snapshot_ts:
            return None

        zone_ts = zone_snapshot_ts[0]

        # Get all zones at that timestamp
        zones = session.query(ZoneSnapshot).filter(
            ZoneSnapshot.timestamp == zone_ts,
            ZoneSnapshot.symbol == symbol
        ).all()

        if not zones:
            return None

        result = {}
        for zone in zones:
            result[zone.signal_type] = {
                'is_long': zone.is_long,
                'zone_min': float(zone.zone_min),
                'zone_max': float(zone.zone_max),
                'sharpe': float(zone.sharpe),
                'win_rate': float(zone.win_rate),
                'mean_return': float(zone.mean_return),
                'n_trades': zone.n_trades,
                'tp_pct': float(zone.tp_pct),
                'sl_pct': float(zone.sl_pct),
                'max_candles': zone.max_candles,
                'ci_95_lower': float(zone.ci_95_lower) if zone.ci_95_lower else None,
                'ci_95_upper': float(zone.ci_95_upper) if zone.ci_95_upper else None,
                'zone_timestamp': zone_ts  # Track which zone snapshot was used
            }

        return result


def run_bot_backfill(bot_id: Optional[int] = None):
    """
    Main bot backfill function

    Args:
        bot_id: Optional bot ID to backfill. If None, backfills all bots.

    CORRECT Strategy:
    1. Get ALL candles (3-minute intervals)
    2. For each candle, find the LAST zone snapshot before that candle
    3. Check entry/exit signals for each bot using the most recent zone
    4. Execute trades and update bot metrics
    5. Snapshot equity for each candle

    KEY INSIGHT: Zones are calculated hourly/irregularly, but bots execute every 3 minutes.
    Each candle must use the most recent zone data available at that time.
    """
    print("=" * 80)
    print("[BOT BACKFILL] Starting Bot Trades Historical Backfill")
    if bot_id:
        print(f"[BOT BACKFILL] Backfilling ONLY bot_id={bot_id}")
    print("=" * 80)

    # Get all bots (or single bot if bot_id specified)
    if bot_id:
        bot = DatabaseService.get_bot_by_id(bot_id)
        if not bot:
            print(f"[BOT BACKFILL] ERROR: Bot ID {bot_id} not found")
            return
        bots = [bot]
    else:
        bots = DatabaseService.get_all_bots()

    print(f"[BOT BACKFILL] Found {len(bots)} bot(s) to backfill")

    # Track open trades for each bot
    bot_open_trades = {bot['id']: None for bot in bots}
    candles_held_tracker = {}  # trade_id -> candles_held

    # Get first zone timestamp to determine backfill start
    with DatabaseService.get_session() as session:
        first_zone_ts = session.query(ZoneSnapshot.timestamp).order_by(ZoneSnapshot.timestamp.asc()).first()

        if not first_zone_ts:
            print("[BOT BACKFILL] ERROR: No zone snapshots found in database")
            return

        first_zone_time = first_zone_ts[0]

        # Get timestamp of last finalized candle BEFORE querying all candles
        # This prevents race condition where new candles finalize during backfill
        last_finalized_ts = session.query(CVDCandle.timestamp).filter(
            CVDCandle.symbol == 'BTC',
            CVDCandle.finalized == True
        ).order_by(CVDCandle.timestamp.desc()).first()

        if not last_finalized_ts:
            print("[BOT BACKFILL] ERROR: No finalized candles found")
            return

        last_finalized_time = last_finalized_ts[0]

        # Get ALL finalized candles EXCEPT the very last one (leave it for bot executor)
        all_candles = session.query(CVDCandle).filter(
            CVDCandle.symbol == 'BTC',
            CVDCandle.timestamp >= first_zone_time,
            CVDCandle.timestamp < last_finalized_time,  # EXCLUDE last candle
            CVDCandle.finalized == True
        ).order_by(CVDCandle.timestamp.asc()).all()

        # Extract candle data INSIDE session
        candles_data = [{
            'timestamp': c.timestamp,
            'price_close': float(c.price_close),
            'cumulative_v2': float(c.cumulative_v2) if c.cumulative_v2 else 0,
            'cumulative_v3': float(c.cumulative_v3) if c.cumulative_v3 else 0
        } for c in all_candles]

    print(f"[BOT BACKFILL] Processing {len(candles_data)} candles starting from {first_zone_time.isoformat()}")

    if len(candles_data) == 0:
        print("[BOT BACKFILL] ERROR: No candles found after first zone timestamp")
        return

    # Process each candle
    candle_count = 0
    last_zone_ts_str = None  # Track when zones change
    first_candle_processed = False  # Track if we've created initial $10k snapshot

    for candle_data in candles_data:
        candle_count += 1
        candle_ts = candle_data['timestamp']

        # CRITICAL: For first candle ONLY, create initial $10k snapshot INSTEAD of regular snapshot
        if not first_candle_processed:
            for bot in bots:
                initial_equity_data = {
                    'timestamp': candle_ts,
                    'balance': Decimal('10000.00'),
                    'equity': Decimal('10000.00'),
                    'unrealized_pnl': Decimal('0.00'),
                    'open_positions': 0
                }
                DatabaseService.snapshot_equity(bot['id'], initial_equity_data)
            print(f"[BOT BACKFILL] ✓ Created initial equity snapshots at $10,000 for all bots at {candle_ts.isoformat()}")
            first_candle_processed = True
            continue  # SKIP this candle - don't process trades or create second snapshot

        # Get LAST zone before this candle
        zones = get_last_zone_before(candle_ts, 'BTC')

        if not zones:
            print(f"[BOT BACKFILL] ✗ No zones available before {candle_ts.isoformat()}, skipping")
            continue

        # Track zone changes (for logging)
        current_zone_ts_str = zones[list(zones.keys())[0]]['zone_timestamp'].isoformat()
        if current_zone_ts_str != last_zone_ts_str:
            print(f"\n[BOT BACKFILL] === Zone Update: Now using zones from {current_zone_ts_str} ===")
            last_zone_ts_str = current_zone_ts_str

        # Print candle progress every 20 candles (hourly)
        if candle_count % 20 == 0:
            print(f"[BOT BACKFILL] Candle #{candle_count} | {candle_ts.isoformat()} | Price: ${candle_data['price_close']:.2f}")

        # Process each bot
        for bot in bots:
            bot_id = bot['id']

            # Check if bot has open trade
            open_trade = bot_open_trades[bot_id]

            if open_trade:
                # Bot has open position - check exit conditions
                trade_id = open_trade['id']

                # Track candles held
                if trade_id not in candles_held_tracker:
                    candles_held_tracker[trade_id] = 0
                candles_held_tracker[trade_id] += 1

                candles_held = candles_held_tracker[trade_id]

                # Check exit (synchronous version)
                from app.bot_executor import check_exit_conditions
                import asyncio
                exit_params = asyncio.run(check_exit_conditions(open_trade, candle_data, candles_held))

                if exit_params:
                    # Exit position
                    exit_type = exit_params['exit_type']
                    exit_price = exit_params['exit_price']

                    entry_price = float(open_trade['entry_price'])
                    direction = open_trade['direction']
                    capital_allocated = float(open_trade['capital_allocated'])

                    # Bot leverage and fee configuration
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
                    entry_fee = float(open_trade.get('entry_fee', 0))

                    # Net P&L (after fees)
                    total_fees = entry_fee + exit_fee
                    pnl = leveraged_pnl - total_fees
                    pnl_pct = (pnl / capital_allocated) * 100

                    # Update trade
                    trade_updates = {
                        'exit_timestamp': candle_data['timestamp'],
                        'exit_price': Decimal(str(exit_price)),
                        'exit_type': exit_type,
                        'candles_held': candles_held,
                        'pnl': Decimal(str(pnl)),
                        'pnl_pct': Decimal(str(pnl_pct)),
                        'exit_fee': Decimal(str(exit_fee)),
                        'total_fees': Decimal(str(total_fees)),
                        'status': 'closed'
                    }
                    DatabaseService.update_trade(trade_id, trade_updates)

                    # Update bot metrics
                    # Return allocated capital + P&L to balance
                    new_balance = bot['current_balance'] + capital_allocated + pnl
                    new_total_pnl = bot['total_pnl'] + pnl
                    new_total_pnl_pct = (new_total_pnl / bot['starting_capital']) * 100

                    total_trades = bot['total_trades'] + 1
                    winning_trades = bot['winning_trades'] + (1 if pnl > 0 else 0)
                    losing_trades = bot['losing_trades'] + (1 if pnl <= 0 else 0)
                    win_rate = (winning_trades / total_trades) * 100 if total_trades > 0 else 0

                    DatabaseService.update_bot_metrics(bot_id, {
                        'current_balance': Decimal(str(new_balance)),
                        'current_equity': Decimal(str(new_balance)),
                        'total_pnl': Decimal(str(new_total_pnl)),
                        'total_pnl_pct': Decimal(str(new_total_pnl_pct)),
                        'total_trades': total_trades,
                        'winning_trades': winning_trades,
                        'losing_trades': losing_trades,
                        'win_rate': Decimal(str(win_rate))
                    })

                    # Update bot dict for next iteration
                    bot['current_balance'] = new_balance
                    bot['total_pnl'] = new_total_pnl
                    bot['total_trades'] = total_trades
                    bot['winning_trades'] = winning_trades
                    bot['losing_trades'] = losing_trades

                    print(f"  [BOT {bot['name']}] Exited {direction} at ${exit_price:.2f} ({exit_type}) | P&L: ${pnl:.2f} ({pnl_pct:+.2f}%) | Held: {candles_held} candles")

                    # Clear open trade
                    bot_open_trades[bot_id] = None
                    del candles_held_tracker[trade_id]

            # Check entry signals (if no open position)
            if bot_open_trades[bot_id] is None:
                # Apply quality filters HERE (not in zone calculation)
                # Filter: n_trades >= 10 AND mean_return > 0.1%
                filtered_zones = {}
                for signal_type, zone_data in zones.items():
                    if zone_data['n_trades'] >= 10 and zone_data['mean_return'] > 0.1:
                        filtered_zones[signal_type] = zone_data

                if not filtered_zones:
                    continue  # No valid zones pass quality filters

                from app.bot_executor import check_entry_signals
                import asyncio
                entry_params = asyncio.run(check_entry_signals(bot, candle_data, filtered_zones))

                if entry_params:
                    # Enter position
                    direction = entry_params['direction']
                    entry_price = entry_params['entry_price']
                    tp_pct = entry_params['tp_pct']
                    sl_pct = entry_params['sl_pct']
                    max_candles = entry_params['max_candles']

                    # Bot leverage and fee configuration
                    leverage = float(bot.get('leverage', 10.0))
                    trading_fee_pct = float(bot.get('trading_fee_pct', 0.04))

                    # Capital allocation
                    # For v2v3_or_conservative_40x: 10% allocation with 40x leverage
                    # For other bots: inverse of leverage (10x = 10%, 20x = 5%, etc.)
                    if bot['strategy_type'] == 'v2v3_or_conservative_40x':
                        capital_pct = 0.1  # Fixed 10% allocation
                    else:
                        capital_pct = 1.0 / leverage  # Default: inverse of leverage

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

                    # Create trade
                    trade_data = {
                        'bot_id': bot_id,
                        'symbol': 'BTC',
                        'entry_timestamp': candle_data['timestamp'],
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

                    # Update bot balance (subtract allocated capital)
                    new_balance = float(bot['current_balance']) - capital_allocated
                    DatabaseService.update_bot_metrics(bot_id, {
                        'current_balance': Decimal(str(new_balance))
                    })
                    bot['current_balance'] = new_balance

                    # Store open trade
                    trade_data['id'] = trade_id
                    bot_open_trades[bot_id] = trade_data

                    print(f"  [BOT {bot['name']}] Entered {direction} at ${entry_price:.2f} | TP: ${tp_price:.2f}, SL: ${sl_price:.2f}")

        # Snapshot equity every 3 minutes (zone timestamps are hourly, so snapshot every checkpoint)
        for bot in bots:
            bot_id = bot['id']
            open_trade = bot_open_trades[bot_id]

            balance = bot['current_balance']
            unrealized_pnl = 0.0
            allocated_capital = 0.0
            open_positions = 0

            if open_trade:
                entry_price = float(open_trade['entry_price'])
                direction = open_trade['direction']
                capital_allocated = float(open_trade['capital_allocated'])
                allocated_capital = capital_allocated
                current_price = candle_data['price_close']

                # Apply leverage to unrealized P&L
                leverage = float(open_trade.get('leverage', 10.0))
                entry_fee = float(open_trade.get('entry_fee', 0))

                # Raw P&L percentage
                if direction == 'LONG':
                    raw_pnl_pct = ((current_price - entry_price) / entry_price) * 100
                else:  # SHORT
                    raw_pnl_pct = ((entry_price - current_price) / entry_price) * 100

                # Leveraged unrealized P&L (minus entry fee already paid)
                unrealized_pnl = (raw_pnl_pct * leverage / 100) * capital_allocated - entry_fee
                open_positions = 1

            equity = balance + allocated_capital + unrealized_pnl

            equity_data = {
                'timestamp': candle_data['timestamp'],
                'balance': Decimal(str(balance)),
                'equity': Decimal(str(equity)),
                'unrealized_pnl': Decimal(str(unrealized_pnl)),
                'open_positions': open_positions
            }

            DatabaseService.snapshot_equity(bot_id, equity_data)

            # Update bot current_equity
            DatabaseService.update_bot_metrics(bot_id, {
                'current_equity': Decimal(str(equity))
            })

    print("\n" + "=" * 80)
    print(f"[BOT BACKFILL] Bot backfill completed!")
    print(f"[BOT BACKFILL] Processed {candle_count} candles")

    # Print final bot stats
    print("\n[BOT BACKFILL] Final Bot Statistics:")
    final_bots = DatabaseService.get_all_bots()
    for bot in final_bots:
        win_rate = bot['win_rate'] if bot['win_rate'] is not None else 0
        print(f"  {bot['name']} ({bot['strategy_type']}): " +
              f"Balance=${bot['current_balance']:.2f} | " +
              f"P&L={bot['total_pnl_pct']:+.2f}% | " +
              f"Trades={bot['total_trades']} | " +
              f"WinRate={win_rate:.1f}%")
    print("=" * 80)


if __name__ == '__main__':
    import sys

    # Check if bot_id was provided as command line argument
    bot_id = None
    if len(sys.argv) > 1:
        try:
            bot_id = int(sys.argv[1])
        except ValueError:
            print(f"ERROR: Invalid bot_id '{sys.argv[1]}'. Must be an integer.")
            sys.exit(1)

    run_bot_backfill(bot_id)
