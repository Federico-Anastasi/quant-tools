"""One-shot bot gap catch-up.

Replays every unprocessed finalized candle for ALL bots up to the current live
candle, reusing the same enter/exit/snapshot + zone-at-time + quality gate as the
live executor and the historical backfill. Does NOT acquire the executor lock.

Run it while bots are PAUSED so the live executor stays idle and cannot race the
fill. After it completes, activate the bots and restart realtime: the live
executor re-initialises from the now-complete snapshots and its startup catch-up
closes the tiny remaining delta before going live.

    docker exec quant_tools_realtime python -m app.run_catchup
"""

import asyncio
from datetime import datetime, timezone

from app.database import DatabaseService
from app.bot_executor import catch_up_bots


async def main():
    bots = DatabaseService.get_all_bots()
    if not bots:
        print("[CATCH-UP ONE-SHOT] No bots found")
        return

    live = DatabaseService.get_last_finalized_candle()
    if not live:
        print("[CATCH-UP ONE-SHOT] No finalized candle found")
        return

    up_to = live['timestamp']
    if isinstance(up_to, str):
        up_to = datetime.fromisoformat(up_to.replace('Z', '+00:00'))
    if up_to.tzinfo is None:
        up_to = up_to.replace(tzinfo=timezone.utc)

    print(f"[CATCH-UP ONE-SHOT] Replaying gap for {len(bots)} bot(s) up to {up_to.isoformat()}")
    replayed = await catch_up_bots(up_to, bots=bots, enforce_active_status=False)
    print(f"[CATCH-UP ONE-SHOT] Done. Replayed {replayed} candle(s).")


if __name__ == '__main__':
    asyncio.run(main())
