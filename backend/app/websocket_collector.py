"""
WebSocket Collector - Hyperliquid Trades → Database
Batch insert every 100 trades or 1 second
"""

import asyncio
import json
import time
from datetime import datetime
from typing import List, Dict

import websockets
import pandas as pd

from app.database import DatabaseService

COIN = "BTC"
WS_URL = "wss://api.hyperliquid.xyz/ws"
BATCH_SIZE = 100
BATCH_TIMEOUT = 1.0

trades_buffer: List[Dict] = []
ws_connected = False
last_trade_time = None


async def on_message(msg: str):
    global ws_connected, last_trade_time

    data = json.loads(msg).get("data")
    if isinstance(data, list):
        batch = []
        for t in data:
            batch.append({
                "timestamp": pd.to_datetime(t["time"], unit="ms"),
                "symbol": COIN,
                "price": float(t["px"]),
                "size": float(t["sz"]),
                "side": t["side"],
                "trade_id": t["tid"]  # Hyperliquid unique trade ID
            })

        if batch:
            trades_buffer.extend(batch)
            last_trade_time = datetime.utcnow()
            print(f"[WS] Buffered {len(batch)} trades (total: {len(trades_buffer)})", flush=True)

        ws_connected = True


async def flush_trades():
    global trades_buffer

    if not trades_buffer:
        return

    batch = trades_buffer.copy()
    trades_buffer.clear()

    # Deduplicate by trade_id (Hyperliquid unique identifier) before inserting
    seen_trade_ids = set()
    deduplicated_batch = []
    for t in batch:
        if t['trade_id'] not in seen_trade_ids:
            seen_trade_ids.add(t['trade_id'])
            deduplicated_batch.append(t)

    try:
        count = DatabaseService.bulk_insert_trades(deduplicated_batch)
        print(f"[DB] Inserted {count} trades", flush=True)
    except Exception as e:
        print(f"[DB] Error inserting trades: {e}", flush=True)
        trades_buffer.extend(deduplicated_batch)


async def flush_loop():
    last_flush = time.time()

    while True:
        await asyncio.sleep(0.1)

        should_flush = (
            len(trades_buffer) >= BATCH_SIZE or
            (trades_buffer and (time.time() - last_flush) >= BATCH_TIMEOUT)
        )

        if should_flush:
            await flush_trades()
            last_flush = time.time()


async def websocket_loop():
    global ws_connected

    backoff = 5
    while True:
        try:
            ws_connected = False

            async with websockets.connect(WS_URL) as ws:
                await ws.send(json.dumps({
                    "method": "subscribe",
                    "subscription": {"type": "trades", "coin": COIN}
                }))
                print(f"[WS] Connected to Hyperliquid - {COIN}", flush=True)
                ws_connected = True
                backoff = 5  # reset after a successful connection

                while True:
                    await on_message(await ws.recv())

        except Exception as e:
            print(f"[WS] Error: {e}, reconnecting in {backoff}s...", flush=True)
            ws_connected = False
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60)


async def start_collector():
    print("[COLLECTOR] Starting WebSocket collector...", flush=True)
    await asyncio.gather(
        websocket_loop(),
        flush_loop()
    )


def get_collector_status() -> Dict:
    return {
        "websocket_connected": ws_connected,
        "trades_buffered": len(trades_buffer),
        "last_trade": last_trade_time.isoformat() if last_trade_time else None
    }
