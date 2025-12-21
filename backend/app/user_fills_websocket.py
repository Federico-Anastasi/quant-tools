"""
WebSocket Listener - Hyperliquid userFills Real-Time Stream
Subscribes to user fill events for instant (<1s) TP/SL/MANUAL exit detection
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Callable, Dict

import websockets

logger = logging.getLogger(__name__)

WS_URL = "wss://api.hyperliquid.xyz/ws"

# Connection status
ws_connected = False
last_fill_time = None


async def process_fill(fill: dict, callback: Callable, is_snapshot: bool):
    """
    Process a single fill from WebSocket

    Args:
        fill: Fill data from Hyperliquid
        callback: Async function to call with processed fill
        is_snapshot: True if from initial snapshot, False if real-time update
    """
    try:
        # LOG RAW FILL DATA
        logger.info(f"[WS userFills] RAW FILL (snapshot={is_snapshot}): {json.dumps(fill)}")

        # Extract fee from fill
        exit_fee = float(fill.get("fee", 0))

        fill_data = {
            "coin": fill.get("coin", ""),
            "oid": fill.get("oid"),  # Order ID
            "price": float(fill.get("px", 0)),
            "size": float(fill.get("sz", 0)),
            "side": fill.get("side", ""),  # "B" (buy) or "A" (ask/sell)
            "dir": fill.get("dir", ""),  # "Open Long", "Close Long", "Open Short", "Close Short"
            "closedPnl": float(fill.get("closedPnl", 0)),
            "exit_fee": exit_fee,  # Exit fee from Hyperliquid
            "time": datetime.fromtimestamp(fill.get("time", 0) / 1000, tz=timezone.utc),
            "is_snapshot": is_snapshot
        }

        # Only process real-time fills (skip snapshot)
        if not is_snapshot:
            global last_fill_time
            last_fill_time = datetime.utcnow()

            logger.info(
                f"[WS userFills] PROCESSED FILL: {fill_data['coin']} {fill_data['dir']} | "
                f"OID={fill_data['oid']}, Price=${fill_data['price']:.2f}, "
                f"Size={fill_data['size']}, PnL=${fill_data['closedPnl']:.2f}, ExitFee=${exit_fee:.2f}"
            )

            # Invoke callback with fill data
            await callback(fill_data)
        else:
            logger.debug(f"[WS userFills] Skipping snapshot fill")

    except Exception as e:
        logger.error(f"[WS userFills] Error processing fill: {e} | Raw: {fill}", exc_info=True)


async def on_message(msg: str, callback: Callable):
    """
    Handle incoming WebSocket message

    Args:
        msg: Raw WebSocket message (JSON string)
        callback: Async function to call for each fill
    """
    try:
        parsed = json.loads(msg)

        # Handle pong response from ping
        if parsed.get("channel") == "pong":
            logger.info("[WS userFills] Pong received (connection alive)")
            return

        # LOG RAW MESSAGE FOR DEBUGGING
        logger.info(f"[WS userFills] RAW MESSAGE: {json.dumps(parsed)}")

        data = parsed.get("data")

        if not data:
            # Subscription confirmation or other message type
            logger.warning(f"[WS userFills] Message with no data: {parsed}")
            return

        # Check if this is a snapshot (Hyperliquid sends {"isSnapshot": true, "fills": [...]})
        if isinstance(data, dict) and data.get("isSnapshot"):
            fills = data.get("fills", [])
            logger.info(f"[WS userFills] Received snapshot with {len(fills)} fills (skipping)")
            for fill in fills:
                await process_fill(fill, callback, is_snapshot=True)

        # Legacy snapshot format: array of fills
        elif isinstance(data, list):
            logger.info(f"[WS userFills] Received legacy snapshot with {len(data)} fills (skipping)")
            for fill in data:
                await process_fill(fill, callback, is_snapshot=True)

        # Streaming update: data contains fills array
        else:
            fills = data.get("fills", [])
            if fills:
                logger.info(f"[WS userFills] Streaming update - processing {len(fills)} fill(s)")
                for fill in fills:
                    await process_fill(fill, callback, is_snapshot=False)
            else:
                logger.warning(f"[WS userFills] Streaming update with no fills: {json.dumps(data)}")

    except json.JSONDecodeError as e:
        logger.error(f"[WS userFills] JSON decode error: {e} | Message: {msg[:200]}")
    except Exception as e:
        logger.error(f"[WS userFills] Error handling message: {e}", exc_info=True)


async def ping_loop(ws):
    """
    Send ping every 30 seconds to keep connection alive
    Hyperliquid closes connections inactive for 60 seconds
    """
    try:
        while True:
            await asyncio.sleep(30)
            await ws.send(json.dumps({"method": "ping"}))
            logger.info("[WS userFills] Keepalive ping sent")
    except Exception as e:
        logger.error(f"[WS userFills] Ping loop error: {e}")


async def connect_userFills_ws(user_address: str, on_fill_callback: Callable):
    """
    Connect to Hyperliquid WebSocket and subscribe to userFills

    Args:
        user_address: Hyperliquid wallet address (e.g., "0x...")
        on_fill_callback: Async function called for each real-time fill
    """
    global ws_connected

    async with websockets.connect(WS_URL) as ws:
        # Subscribe to userFills stream
        subscription = {
            "method": "subscribe",
            "subscription": {
                "type": "userFills",
                "user": user_address
            }
        }

        await ws.send(json.dumps(subscription))
        logger.info(f"[WS userFills] Subscribed for address: {user_address}")
        ws_connected = True

        # Start ping loop task
        ping_task = asyncio.create_task(ping_loop(ws))

        try:
            # Message receive loop
            while True:
                try:
                    msg = await ws.recv()
                    await on_message(msg, on_fill_callback)
                except websockets.exceptions.ConnectionClosed:
                    logger.warning("[WS userFills] Connection closed by server")
                    ws_connected = False
                    raise
                except Exception as e:
                    logger.error(f"[WS userFills] Error receiving message: {e}")
                    # Don't raise - continue listening
        finally:
            # Cancel ping task on disconnect
            ping_task.cancel()
            try:
                await ping_task
            except asyncio.CancelledError:
                pass


async def start_user_fills_listener(user_address: str, on_fill_callback: Callable):
    """
    Start WebSocket listener with auto-reconnect

    Args:
        user_address: Hyperliquid wallet address
        on_fill_callback: Async function called for each real-time fill

    Note:
        Runs indefinitely with auto-reconnect on errors
        Use asyncio.create_task() to run in background
    """
    global ws_connected

    logger.info(f"[WS userFills] Starting listener for {user_address}")

    reconnect_delay = 5  # seconds

    while True:
        try:
            ws_connected = False
            await connect_userFills_ws(user_address, on_fill_callback)

        except websockets.exceptions.WebSocketException as e:
            logger.error(f"[WS userFills] WebSocket error: {e}, reconnecting in {reconnect_delay}s")
            ws_connected = False
            await asyncio.sleep(reconnect_delay)

        except Exception as e:
            logger.error(f"[WS userFills] Unexpected error: {e}, reconnecting in {reconnect_delay}s", exc_info=True)
            ws_connected = False
            await asyncio.sleep(reconnect_delay)


def get_status() -> Dict:
    """
    Get current WebSocket connection status

    Returns:
        dict with keys: ws_connected, last_fill_time
    """
    return {
        "ws_connected": ws_connected,
        "last_fill_time": last_fill_time.isoformat() if last_fill_time else None
    }
