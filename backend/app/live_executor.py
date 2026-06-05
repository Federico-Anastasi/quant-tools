"""
Live Trading Executor
Background task che esegue strategia V3 Momentum su candle finalization
Pattern identico a bot_executor.py - funzione async invece di classe
"""

import asyncio
import logging
import json
import os
from datetime import datetime, timezone
from app.database import DatabaseService
from app.user_fills_websocket import start_user_fills_listener

logger = logging.getLogger(__name__)

# WebSocket fills queue (thread-safe)
recent_fills_queue = asyncio.Queue()
ws_task = None


async def live_execution_loop():
    """
    Loop principale live trading executor
    Pattern identico a bot_execution_loop() in bot_executor.py
    """
    # Load config
    config_path = os.path.join(os.path.dirname(__file__), 'config_hyperliquid.json')

    try:
        with open(config_path) as f:
            config = json.load(f)
    except FileNotFoundError:
        logger.warning(f"Config not found at {config_path}, live trading disabled")
        # Sleep forever without blocking other pipelines
        while True:
            await asyncio.sleep(3600)
        return
    except Exception as e:
        logger.error(f"Error loading config: {e}", exc_info=True)
        while True:
            await asyncio.sleep(3600)
        return

    is_active = config.get('is_active', False)
    symbol = config.get('symbol', 'BTC')
    risk_pct = config.get('risk_pct', 2.0)
    trading_fee_pct = config.get('trading_fee_pct', 0.04)
    min_zone_trades = config.get('min_zone_trades', 10)

    status = "ACTIVE" if is_active else "INACTIVE"
    logger.info(f"Live executor started - V3 Momentum strategy ({status})")
    logger.info(f"Config: symbol={symbol}, risk={risk_pct}%, fee={trading_fee_pct}%, min_zone_trades={min_zone_trades}")

    # Initialize HyperliquidClient INSIDE async loop (no blocking)
    from app.hyperliquid_client import HyperliquidClient

    try:
        hl_client = HyperliquidClient()
        logger.info("HyperliquidClient initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize HyperliquidClient: {e}", exc_info=True)
        logger.warning("Live trading disabled due to initialization error")
        while True:
            await asyncio.sleep(3600)
        return

    # Start WebSocket listener for userFills (real-time fill detection)
    global ws_task
    ws_task = asyncio.create_task(
        start_user_fills_listener(hl_client.address, on_fill_received)
    )
    logger.info(f"[WS userFills] Listener started for {hl_client.address}")

    last_candle_id = None

    while True:
        try:
            await asyncio.sleep(2)

            # Reload config every iteration (hot-reload)
            try:
                with open(config_path) as f:
                    config = json.load(f)
                new_is_active = config.get('is_active', False)

                # Log only on status change
                if new_is_active != is_active:
                    old_status = "ACTIVE" if is_active else "INACTIVE"
                    new_status = "ACTIVE" if new_is_active else "INACTIVE"
                    logger.info(f"[CONFIG RELOAD] Strategy status: {old_status} → {new_status}")
                    is_active = new_is_active
            except Exception as e:
                logger.error(f"Error reloading config: {e}")

            # Process any pending WebSocket fills (real-time exit detection)
            while not recent_fills_queue.empty():
                fill = await recent_fills_queue.get()
                await process_fill_event(fill, hl_client, symbol)

            # Get latest finalized candle (even if INACTIVE, to detect and log)
            candle = await asyncio.to_thread(DatabaseService.get_last_finalized_candle, symbol)
            if not candle:
                continue

            # Check if new candle (process once per candle)
            candle_id = candle.get('id')
            if candle_id == last_candle_id:
                continue

            last_candle_id = candle_id
            logger.info(f"[LIVE] New candle detected: ID={candle_id}, timestamp={candle.get('timestamp')}")

            # SNAPSHOT: Save account state (every 3min candle)
            try:
                account_info = hl_client.get_account_info()

                # accountValue from Hyperliquid already includes unrealized P&L (total equity)
                equity = account_info['accountValue']

                # Calculate unrealized P&L for informational purposes
                unrealized_pnl = sum(
                    float(pos.get('unrealizedPnl', 0))
                    for pos in account_info['positions']
                )

                _snap_ts = datetime.utcnow()
                _snap_eq = equity
                _snap_upnl = unrealized_pnl
                _snap_margin = account_info['totalMarginUsed']
                await asyncio.to_thread(
                    DatabaseService.create_account_snapshot,
                    _snap_ts, _snap_eq, _snap_upnl, _snap_margin
                )

                logger.debug(f"[SNAPSHOT] Equity=${equity:.2f} (unrealized P&L: ${unrealized_pnl:.2f})")
            except Exception as e:
                logger.error(f"Error saving snapshot: {e}")

            # Skip processing if INACTIVE
            if not is_active:
                logger.info(f"[LIVE] Strategy INACTIVE - skipping execution (candle {candle_id})")
                continue

            # Get latest zones
            zones = await asyncio.to_thread(DatabaseService.get_latest_zones, symbol)
            if not zones:
                logger.warning("No zones available, skipping cycle")
                continue

            # Check current position on Hyperliquid
            account_info = hl_client.get_account_info()
            has_position = any(pos['coin'] == symbol for pos in account_info['positions'])

            if has_position:
                # Position exists - check exit conditions
                logger.info("Position exists - checking exit conditions")
                open_trade = await asyncio.to_thread(DatabaseService.get_open_live_trade, symbol)

                if open_trade:
                    should_close = await check_exit_conditions(
                        open_trade,
                        candle['price_close'],
                        hl_client,
                        symbol
                    )

                    if should_close['exit']:
                        await asyncio.to_thread(
                            DatabaseService.close_live_trade,
                            open_trade['id'],
                            should_close['exit_price'],
                            should_close.get('exit_time', datetime.utcnow()),
                            should_close['exit_type'],
                            should_close.get('realized_pnl')
                        )
                        logger.info(f"Position closed: {should_close['exit_type']}")
                else:
                    logger.warning("Position exists on Hyperliquid but not in DB")

            else:
                # No position on Hyperliquid - check if we have orphaned trade in DB
                open_trade = await asyncio.to_thread(DatabaseService.get_open_live_trade, symbol)

                if open_trade:
                    # Position was closed on Hyperliquid but not in DB - FALLBACK RECOVERY
                    logger.warning(f"Position closed on Hyperliquid but still open in DB (trade_id={open_trade['id']})")
                    logger.info("Searching for exit fill in recent fills...")

                    # Search for the closing fill
                    should_close = await check_exit_conditions(
                        open_trade,
                        candle['price_close'],
                        hl_client,
                        symbol
                    )

                    if should_close.get('exit'):
                        await asyncio.to_thread(
                            DatabaseService.close_live_trade,
                            open_trade['id'],
                            should_close['exit_price'],
                            should_close.get('exit_time', datetime.utcnow()),
                            should_close['exit_type'],
                            should_close.get('realized_pnl')
                        )
                        logger.info(f"RECOVERED: Position closed via fallback - {should_close['exit_type']} at ${should_close['exit_price']:.2f}, PnL=${should_close.get('realized_pnl', 0):.2f}")
                    else:
                        # Can't find fill - close with current price as emergency fallback
                        logger.error("Could not find exit fill! Closing with current price (emergency fallback)")
                        await asyncio.to_thread(
                            DatabaseService.close_live_trade,
                            open_trade['id'],
                            candle['price_close'],
                            datetime.utcnow(),
                            'MANUAL',
                            None
                        )
                else:
                    # No position anywhere - check entry signal
                    logger.info("No position - checking entry signals")
                    signal = await check_entry_signal(candle, zones, min_zone_trades)

                    if signal:
                        logger.info(f"Entry signal detected: {signal['direction']}")
                        success = await enter_position(
                            signal,
                            hl_client,
                            account_info['accountValue'],
                            risk_pct,
                            trading_fee_pct,
                            symbol
                        )
                        if success:
                            logger.info("Position opened successfully")
                        else:
                            logger.error("Failed to open position")
                    else:
                        logger.debug("No entry signal")

        except Exception as e:
            logger.error(f"Error in live execution loop: {e}", exc_info=True)
            await asyncio.sleep(5)


async def check_entry_signal(candle, zones, min_zone_trades):
    """
    Check V3 Momentum entry signal
    Returns dict with entry params if signal detected, None otherwise
    """
    try:
        v3_value = candle.get('cumulative_v3')
        current_price = candle.get('price_close')

        if v3_value is None or current_price is None:
            return None

        v3_zone = zones.get('cumulative_v3')
        if not v3_zone:
            return None

        # Validate zone has enough trades
        n_trades = v3_zone.get('n_trades', 0)
        if n_trades < min_zone_trades:
            logger.debug(f"Zone has insufficient trades: {n_trades} < {min_zone_trades}")
            return None

        zone_min = v3_zone['zone_min']
        zone_max = v3_zone['zone_max']
        is_long_zone = v3_zone['is_long']
        tp_pct = v3_zone['tp_pct']
        sl_pct = v3_zone['sl_pct']

        # Check main zone
        if zone_min <= v3_value <= zone_max:
            direction = "LONG" if is_long_zone else "SHORT"
        # Check opposite zone
        elif -zone_max <= v3_value <= -zone_min:
            direction = "SHORT" if is_long_zone else "LONG"
        else:
            return None

        # Calculate TP/SL prices
        if direction == "LONG":
            tp_price = current_price * (1 + tp_pct / 100)
            sl_price = current_price * (1 - sl_pct / 100)
        else:
            tp_price = current_price * (1 - tp_pct / 100)
            sl_price = current_price * (1 + sl_pct / 100)

        return {
            'direction': direction,
            'entry_price': current_price,
            'tp_price': tp_price,
            'sl_price': sl_price,
            'tp_pct': tp_pct,
            'sl_pct': sl_pct
        }

    except Exception as e:
        logger.error(f"Error checking entry signal: {e}")
        return None


async def on_fill_received(fill_data: dict):
    """
    Callback invoked by WebSocket when fill arrives

    Args:
        fill_data: Fill data dict from user_fills_websocket.py
    """
    global recent_fills_queue

    logger.info(
        f"[WS FILL] {fill_data['coin']} {fill_data['dir']} | "
        f"OID={fill_data['oid']}, Price=${fill_data['price']:.2f}, "
        f"PnL=${fill_data['closedPnl']:.2f}"
    )

    # Add to queue for processing in main loop
    await recent_fills_queue.put(fill_data)


async def process_fill_event(fill: dict, hl_client, symbol: str):
    """
    Process real-time fill from WebSocket
    Detects if it's a TP/SL/MANUAL exit and closes trade

    Args:
        fill: Fill data dict with keys: coin, oid, price, dir, closedPnl, time
        hl_client: HyperliquidClient instance
        symbol: Trading symbol (e.g., "BTC")
    """
    try:
        # Only process fills for our symbol
        if fill['coin'] != symbol:
            logger.debug(f"[FILL] Skipping fill for different symbol: {fill['coin']}")
            return

        # Process opening fills (to save entry fee)
        if 'Open' in fill['dir']:
            entry_fee = float(fill.get('fee', 0))
            fill_oid = str(fill['oid'])

            # Find trade by entry_order_id and update entry_fee
            await asyncio.to_thread(
                DatabaseService.update_live_trade_entry_fee,
                fill_oid, entry_fee
            )
            logger.info(f"[ENTRY FILL] Updated entry_fee=${entry_fee:.2f} for OID={fill_oid}")
            return

        # Process closing fills
        if 'Close' not in fill['dir']:
            logger.debug(f"[FILL] Skipping non-closing/opening fill: {fill['dir']}")
            return

        # Get open trade from DB
        open_trade = await asyncio.to_thread(DatabaseService.get_open_live_trade, symbol)
        if not open_trade:
            logger.warning(f"[FILL] Close fill detected but no open trade in DB (oid={fill['oid']})")
            return

        # Determine exit type by matching order ID
        tp_order_id = open_trade.get('tp_order_id')
        sl_order_id = open_trade.get('sl_order_id')
        fill_oid = str(fill['oid'])

        if fill_oid == str(tp_order_id):
            exit_type = 'TP'
        elif fill_oid == str(sl_order_id):
            exit_type = 'SL'
        else:
            exit_type = 'MANUAL'  # User closed manually on Hyperliquid

        # Calculate net PnL: closedPnl - entry_fee - exit_fee
        # closedPnl from Hyperliquid is GROSS PnL (no fees deducted)
        entry_fee = open_trade.get('entry_fee', 0)
        exit_fee = fill.get('exit_fee', 0)
        net_pnl = fill['closedPnl'] - entry_fee - exit_fee

        # Close trade in DB with net PnL
        await asyncio.to_thread(
            DatabaseService.close_live_trade,
            open_trade['id'],
            fill['price'],
            fill['time'],
            exit_type,
            net_pnl,
            exit_fee
        )

        logger.info(
            f"[EXIT] {exit_type} | Trade={open_trade['id']}, Price=${fill['price']:.2f}, "
            f"closedPnl=${fill['closedPnl']:.2f}, entry_fee=${entry_fee:.2f}, exit_fee=${exit_fee:.2f}, NetPnL=${net_pnl:.2f}"
        )

    except Exception as e:
        logger.error(f"[FILL] Error processing fill event: {e}", exc_info=True)


async def enter_position(signal, hl_client, account_value, risk_pct, trading_fee_pct, symbol):
    """
    Open position with TP/SL on Hyperliquid
    Returns True if successful
    """
    try:
        # Calculate size with fixed risk
        risk_amount = account_value * (risk_pct / 100)
        sl_pct_abs = abs(signal['sl_pct']) / 100
        fee_pct = trading_fee_pct / 100

        notional = risk_amount / (sl_pct_abs + 2 * fee_pct)
        leverage = notional / account_value
        size = notional / signal['entry_price']
        leverage_int = max(1, int(round(leverage)))

        logger.info(
            f"Entering {signal['direction']}: Entry=${signal['entry_price']:.0f}, "
            f"TP=${signal['tp_price']:.0f}, SL=${signal['sl_price']:.0f}, "
            f"Size={size:.5f}, Leverage={leverage_int}x, Risk=${risk_amount:.2f}"
        )

        # Set leverage
        hl_client.set_leverage(symbol=symbol, leverage=leverage_int)

        # ═══════════════════════════════════════════════════════════════════════
        # ENTRY: TRUE MARKET ORDER usando exchange.market_open()
        # ═══════════════════════════════════════════════════════════════════════
        # NO prezzo fisso, esegue al miglior prezzo disponibile con slippage 1%
        is_buy = signal['direction'] == "LONG"

        entry_result = hl_client.market_open(
            symbol=symbol,
            is_buy=is_buy,
            size=size,
            slippage=0.01  # 1% slippage tollerance
        )

        if entry_result['status'] != 'ok':
            logger.error(f"Entry market order failed: {entry_result}")
            return False

        logger.info(f"Entry market order succeeded: {entry_result.get('order_id')}")

        # ═══════════════════════════════════════════════════════════════════════
        # SL: TRIGGER + MARKET EXECUTION con safety limit al 2%
        # ═══════════════════════════════════════════════════════════════════════
        # Quando scatta il trigger → esegue come MARKET order
        # Safety limit 2% peggiore del trigger per garantire fill anche in volatilità
        # CRITICAL: BTC richiede prezzi INTERI (0 decimali)
        sl_trigger = round(signal['sl_price'], 0)

        # Safety limit 2% peggiore del trigger
        # LONG: SL scatta giù → SELL → limit 2% SOTTO trigger (98%)
        # SHORT: SL scatta su → BUY → limit 2% SOPRA trigger (102%)
        sl_safety_limit = round(sl_trigger * (0.98 if is_buy else 1.02), 0)

        logger.info(f"Placing SL: trigger={sl_trigger}, safety_limit={sl_safety_limit}, isMarket=True")

        sl_result = hl_client.place_order(
            symbol=symbol,
            is_buy=not is_buy,      # SELL per LONG, BUY per SHORT
            size=size,
            limit_price=sl_safety_limit,  # 2% safety limit
            order_type={
                "trigger": {
                    "triggerPx": sl_trigger,
                    "isMarket": True,  # ← MARKET execution quando scatta
                    "tpsl": "sl"
                }
            },
            reduce_only=True
        )

        if sl_result['status'] != 'ok':
            logger.warning(f"SL order failed: {sl_result}")

        # ═══════════════════════════════════════════════════════════════════════
        # TP: TRIGGER + LIMIT EXECUTION 0.02% sotto trigger
        # ═══════════════════════════════════════════════════════════════════════
        # Quando scatta il trigger → esegue come LIMIT order
        # Limit 0.02% migliore del trigger per quasi-garantire fill mantenendo profitto
        # CRITICAL: BTC richiede prezzi INTERI (0 decimali)
        tp_trigger = round(signal['tp_price'], 0)

        # Limit 0.02% migliore del trigger per quasi-garantire fill
        # LONG: TP scatta su → SELL → limit 0.02% SOTTO trigger (99.98%)
        # SHORT: TP scatta giù → BUY → limit 0.02% SOPRA trigger (100.02%)
        tp_limit = round(tp_trigger * (0.9998 if is_buy else 1.0002), 0)

        logger.info(f"Placing TP: trigger={tp_trigger}, limit={tp_limit}, isMarket=False")

        tp_result = hl_client.place_order(
            symbol=symbol,
            is_buy=not is_buy,      # SELL per LONG, BUY per SHORT
            size=size,
            limit_price=tp_limit,   # 0.02% better than trigger
            order_type={
                "trigger": {
                    "triggerPx": tp_trigger,
                    "isMarket": False,  # ← LIMIT execution
                    "tpsl": "tp"
                }
            },
            reduce_only=True
        )

        if tp_result['status'] != 'ok':
            logger.warning(f"TP order failed: {tp_result}")

        # Save to DB
        trade_id = DatabaseService.create_live_trade(
            symbol=symbol,
            side=signal['direction'],
            entry_price=signal['entry_price'],
            entry_time=datetime.utcnow(),
            size=size,
            tp_price=signal['tp_price'],
            sl_price=signal['sl_price'],
            entry_order_id=entry_result.get('order_id'),
            sl_order_id=sl_result.get('order_id'),
            tp_order_id=tp_result.get('order_id'),
            status='open'
        )

        logger.info(f"Position opened - Trade ID: {trade_id}, Order ID: {entry_result.get('order_id')}")
        return True

    except Exception as e:
        logger.error(f"Error entering position: {e}", exc_info=True)
        return False


async def check_exit_conditions(trade, current_price, hl_client, symbol):
    """
    FALLBACK exit check via API polling (safety net if WebSocket misses fill)
    Only called if WebSocket didn't detect exit

    Returns dict: {'exit': bool, 'exit_type': str, 'exit_price': float, 'exit_time': datetime, 'realized_pnl': float}
    """
    try:
        # Check if position still exists
        account_info = hl_client.get_account_info()
        position_exists = any(pos['coin'] == symbol for pos in account_info['positions'])

        if position_exists:
            return {'exit': False}  # Still open

        # Position closed - find fill in recent fills
        fills = hl_client.get_user_fills(limit=50)
        tp_order_id = trade.get('tp_order_id')
        sl_order_id = trade.get('sl_order_id')
        entry_time = trade.get('entry_time')

        # Search for closing fill
        for fill in fills:
            if fill.get('coin') != symbol:
                continue

            fill_time_ms = fill.get('time', 0)
            fill_time = datetime.fromtimestamp(fill_time_ms / 1000, tz=timezone.utc)

            # Skip fills before entry
            if fill_time < entry_time:
                continue

            # Check if this is a closing fill
            if 'Close' not in fill.get('dir', ''):
                continue

            # Match order ID to determine exit type
            fill_oid = str(fill.get('oid'))
            if fill_oid == str(tp_order_id):
                exit_type = 'TP'
            elif fill_oid == str(sl_order_id):
                exit_type = 'SL'
            else:
                exit_type = 'MANUAL'

            logger.info(
                f"[EXIT FALLBACK] {exit_type} fill found: "
                f"price=${float(fill['px']):.2f}, PnL=${float(fill.get('closedPnl', 0)):.2f}"
            )

            return {
                'exit': True,
                'exit_type': exit_type,
                'exit_price': float(fill['px']),  # Real fill price
                'exit_time': fill_time,
                'realized_pnl': float(fill.get('closedPnl', 0))  # Hyperliquid P&L
            }

        # Position closed but no fill found (edge case)
        logger.warning("[EXIT FALLBACK] Position closed but no fill found in API")
        return {
            'exit': True,
            'exit_type': 'MANUAL',
            'exit_price': current_price,  # Approximate
            'exit_time': datetime.utcnow(),
            'realized_pnl': 0
        }

    except Exception as e:
        logger.error(f"Error checking exit: {e}", exc_info=True)
        return {'exit': False}
