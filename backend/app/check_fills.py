#!/usr/bin/env python3
"""Check Hyperliquid fills directly"""
import json
from datetime import datetime, timezone
from hyperliquid_client import HyperliquidClient

# Initialize client (reads config automatically)
hl = HyperliquidClient()

# Get recent fills
fills = hl.get_user_fills(limit=30)

print(f"=== RECENT FILLS (last {len(fills)}) ===\n")

for i, fill in enumerate(fills):
    coin = fill.get('coin', '')
    oid = fill.get('oid', '')
    direction = fill.get('dir', '')
    price = float(fill.get('px', 0))
    size = float(fill.get('sz', 0))
    pnl = float(fill.get('closedPnl', 0))
    fee = float(fill.get('fee', 0))
    time_ms = fill.get('time', 0)
    time_dt = datetime.fromtimestamp(time_ms / 1000, tz=timezone.utc)

    # Highlight BTC closes
    marker = "[CLOSE]" if 'Close' in direction and coin == 'BTC' else ""

    print(f"{i+1:2d}. {time_dt} | {coin:4s} {direction:15s} | "
          f"OID={oid} | ${price:,.2f} | Sz={size:.5f} | PnL=${pnl:+.2f} | Fee=${fee:.2f} {marker}")

print("\n" + "="*80)
