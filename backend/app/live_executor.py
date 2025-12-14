"""
Live Trading Executor
Background task che esegue strategia V3 Momentum su candle finalization
Pattern identico a bot_executor.py - funzione async invece di classe
"""

import asyncio
import logging
import json
import os
from datetime import datetime
from app.database import DatabaseService

logger = logging.getLogger(__name__)


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

            if not is_active:
                continue

            # Get latest finalized candle
            candle = DatabaseService.get_last_finalized_candle(symbol=symbol)
            if not candle:
                continue

            # Check if new candle (process once per candle)
            candle_id = candle.get('id')
            if candle_id == last_candle_id:
                continue

            last_candle_id = candle_id
            logger.info(f"[LIVE] New candle detected: ID={candle_id}, timestamp={candle.get('timestamp')}")

            # Get latest zones
            zones = DatabaseService.get_latest_zones(symbol=symbol)
            if not zones:
                logger.warning("No zones available, skipping cycle")
                continue

            # Check current position on Hyperliquid
            account_info = hl_client.get_account_info()
            has_position = any(pos['coin'] == symbol for pos in account_info['positions'])

            if has_position:
                # Position exists - check exit conditions
                logger.info("Position exists - checking exit conditions")
                open_trade = DatabaseService.get_open_live_trade(symbol=symbol)

                if open_trade:
                    should_close = await check_exit_conditions(
                        open_trade,
                        candle['price_close'],
                        hl_client,
                        symbol
                    )

                    if should_close['exit']:
                        DatabaseService.close_live_trade(
                            trade_id=open_trade['id'],
                            exit_price=should_close['exit_price'],
                            exit_time=datetime.utcnow(),
                            exit_type=should_close['exit_type']
                        )
                        logger.info(f"Position closed: {should_close['exit_type']}")
                else:
                    logger.warning("Position exists on Hyperliquid but not in DB")

            else:
                # No position - check entry signal
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

        # Place entry order (IOC)
        is_buy = signal['direction'] == "LONG"
        entry_result = hl_client.place_order(
            symbol=symbol,
            is_buy=is_buy,
            size=size,
            limit_price=signal['entry_price'],
            order_type={"limit": {"tif": "Ioc"}}
        )

        if entry_result['status'] != 'ok':
            logger.error(f"Entry order failed: {entry_result}")
            return False

        # Place SL
        sl_result = hl_client.place_order(
            symbol=symbol,
            is_buy=not is_buy,
            size=size,
            limit_price=signal['sl_price'],
            order_type={"trigger": {"triggerPx": signal['sl_price'], "isMarket": True, "tpsl": "sl"}},
            reduce_only=True
        )

        # Place TP
        tp_result = hl_client.place_order(
            symbol=symbol,
            is_buy=not is_buy,
            size=size,
            limit_price=signal['tp_price'],
            order_type={"trigger": {"triggerPx": signal['tp_price'], "isMarket": True, "tpsl": "tp"}},
            reduce_only=True
        )

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
    Check if position should be closed (sync DB with Hyperliquid)
    Returns dict: {'exit': bool, 'exit_type': str, 'exit_price': float}
    """
    try:
        # Check if position still exists on Hyperliquid
        account_info = hl_client.get_account_info()
        position_exists = any(pos['coin'] == symbol for pos in account_info['positions'])

        if not position_exists:
            # Position closed on Hyperliquid but still open in DB
            logger.info(f"Position no longer exists on Hyperliquid - closing in DB")
            return {
                'exit': True,
                'exit_type': 'MANUAL',  # Can't determine TP/SL from here
                'exit_price': current_price
            }

        return {'exit': False, 'exit_type': None, 'exit_price': None}

    except Exception as e:
        logger.error(f"Error checking exit conditions: {e}")
        return {'exit': False, 'exit_type': None, 'exit_price': None}
