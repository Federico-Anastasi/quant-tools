"""
Quant Tools FastAPI Backend
Real-time CVD + LOB Density Analysis
"""

import asyncio
import logging
import sys
import os
from datetime import datetime, timedelta, timezone
from typing import Optional, List

import numpy as np
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.database import DatabaseService, check_db_health, CVDCandle
from app.websocket_collector import start_collector, get_collector_status
from app.cvd_pipeline import cvd_pipeline_loop
from app.runs_pipeline import runs_pipeline_loop
from app.zone_pipeline import zone_pipeline_loop
from app.bot_executor import bot_execution_loop


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def utc_now_iso():
    """Return current UTC time as ISO string with 'Z' suffix for proper timezone"""
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================

def setup_logging():
    """
    Configure professional logging for all modules

    Format: [TIMESTAMP] [LEVEL] [MODULE] Message
    Example: [2025-11-30 21:15:00] [INFO] [bot_executor] Bot 1 entered LONG position
    """
    # Create formatter with timestamp, level, module name
    formatter = logging.Formatter(
        fmt='[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # Remove existing handlers (avoid duplicates on reload)
    root_logger.handlers.clear()

    # Create console handler with formatter
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)

    # Add handler to root logger
    root_logger.addHandler(console_handler)

    # Reduce noise from uvicorn/fastapi (only show WARNING+)
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("fastapi").setLevel(logging.WARNING)

    logging.info("[LOGGING] Professional logging system initialized")


# Initialize logging on module load
setup_logging()

# Environment detection
ENV = os.getenv("ENV", "development")  # 'development' or 'production'
IS_PRODUCTION = ENV == "production"

# FastAPI app with conditional Swagger/OpenAPI exposure
app = FastAPI(
    title="Quant Tools API",
    description="Real-time CVD + LOB Density Analysis",
    version="1.0.0",
    # SECURITY: Disable API documentation in production
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json"
)

# CORS Configuration - Strict in production, permissive in development
if IS_PRODUCTION:
    # PRODUCTION: Only allow your frontend domain
    ALLOWED_FRONTEND = os.getenv("FRONTEND_URL", "https://psiquant.xyz")
    CORS_ORIGINS = [ALLOWED_FRONTEND]
    logging.info(f"[CORS] PRODUCTION mode - Allowing only: {CORS_ORIGINS}")
else:
    # DEVELOPMENT: Allow localhost for local development
    CORS_ORIGINS = ["http://localhost:3000", "http://localhost:8080", "http://localhost:8082"]
    logging.info(f"[CORS] DEVELOPMENT mode - Allowing: {CORS_ORIGINS}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# HYPERLIQUID CLIENT SINGLETON
# ============================================================================

# Initialize HyperliquidClient once at startup (avoid re-initialization on every API call)
hl_client = None

try:
    from app.hyperliquid_client import HyperliquidClient
    hl_client = HyperliquidClient()
    logging.info("[HYPERLIQUID] Client initialized successfully")
except FileNotFoundError:
    logging.warning("[HYPERLIQUID] Config not found - live trading endpoints will return empty data")
except Exception as e:
    logging.error(f"[HYPERLIQUID] Failed to initialize client: {e}")


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class HealthResponse(BaseModel):
    status: str
    database_healthy: bool
    websocket_connected: bool
    last_trade: Optional[str]
    trades_count: Optional[int]
    candles_count: Optional[int]
    runs_count: Optional[int]


class CandlesResponse(BaseModel):
    timestamp: str
    symbol: str
    total_candles: int
    candles: List[dict]


class LOBDensityResponse(BaseModel):
    timestamp: str
    symbol: str
    p_current: float
    price_bins: List[float]
    V_up: List[float]
    V_down: List[float]
    V_diff: List[float]


class LOBSnapshotItem(BaseModel):
    timestamp: str
    symbol: str
    p_current: float
    price_bins: List[float]
    V_diff: List[float]


class LOBSnapshotsResponse(BaseModel):
    symbol: str
    start_time: str
    end_time: str
    snapshots: List[LOBSnapshotItem]
    count: int


class OrderFlowZonesResponse(BaseModel):
    timestamp: str
    symbol: str
    cumulative_v2: Optional[dict]
    cumulative_v3: Optional[dict]


# ============================================================================
# STARTUP
# ============================================================================

logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    logger.info("Starting Quant Tools Backend")

    if not check_db_health():
        logger.warning("Database health check failed")

    # MULTI-CONTAINER ARCHITECTURE: Check container mode
    # Modes:
    # - "api": API-only container (no background tasks)
    # - "realtime": Real-Time container (WebSocket + CVD + Runs + Bot Executor)
    # - "compute": Compute container (Zone + LOB Subscriber)
    # - "monolith" (default): All-in-one (legacy mode for development)
    container_mode = os.environ.get('CONTAINER_MODE', 'monolith')

    if container_mode == 'api':
        logger.info("[API MODE] Starting API-only container (no background tasks)")
        print("[API MODE] HTTP endpoints only - background pipelines disabled", flush=True)
        return  # Skip all background task startup

    elif container_mode == 'monolith':
        # LEGACY MODE: For local development and backward compatibility
        # MULTI-WORKER SAFETY: Only start background tasks in PRIMARY worker
        worker_id = os.environ.get('WORKER_ID', '0')

        if worker_id == '0':
            logger.info("[WORKER 0] Starting background pipelines (MONOLITH mode)")

            # Start background tasks
            asyncio.create_task(start_collector())
            asyncio.create_task(cvd_pipeline_loop())
            asyncio.create_task(runs_pipeline_loop())
            asyncio.create_task(zone_pipeline_loop())
            asyncio.create_task(bot_execution_loop())

            logger.info("[WORKER 0] All pipelines started (WebSocket, CVD, Runs, Zone, Bot Executor)")
        else:
            logger.info(f"[WORKER {worker_id}] HTTP-only worker (background tasks disabled)")

    else:
        # REALTIME and COMPUTE modes use dedicated entry points (main_realtime.py, main_compute.py)
        # This code path should not execute for those modes
        logger.warning(f"[STARTUP] Unknown CONTAINER_MODE: {container_mode} - running in API-only mode")
        return


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    db_healthy = check_db_health()
    collector_status = get_collector_status()

    from app.database import DatabaseService, Trade, CVDCandle, Run
    with DatabaseService.get_session() as session:
        trades_count = session.query(Trade).count()
        candles_count = session.query(CVDCandle).count()
        runs_count = session.query(Run).count()

    return HealthResponse(
        status="healthy" if db_healthy else "degraded",
        database_healthy=db_healthy,
        websocket_connected=collector_status['websocket_connected'],
        last_trade=collector_status['last_trade'],
        trades_count=trades_count,
        candles_count=candles_count,
        runs_count=runs_count
    )


@app.get("/api/candles", response_model=CandlesResponse)
async def get_candles(
    symbol: str = Query("BTC", description="Trading symbol"),
    limit: int = Query(1000, ge=1, le=10000, description="Maximum candles"),
    hours: Optional[int] = Query(None, ge=1, le=720, description="Hours of data")
):
    """Get CVD candle data"""
    candles = DatabaseService.get_candles(symbol=symbol, limit=limit, hours=hours)

    return CandlesResponse(
        timestamp=utc_now_iso(),
        symbol=symbol,
        total_candles=len(candles),
        candles=candles
    )


@app.get("/api/lob-density", response_model=LOBSnapshotsResponse)
async def get_lob_density(
    symbol: str = Query("BTC"),
    hours: int = Query(24, ge=1, le=168)  # Default 24h, max 1 week
):
    """
    Get LOB density snapshots for historical heatmap visualization

    Returns array of LOB snapshots from database for the specified time window.
    Snapshots are generated every 3 minutes by the CVD pipeline.

    Parameters:
    - symbol: Trading symbol (default: "BTC")
    - hours: Time window in hours (default: 24, max: 168 = 1 week)

    Response:
    - snapshots: Array of LOB density snapshots (timestamp, p_current, price_bins, V_diff)
    - count: Number of snapshots returned
    """
    from app.database import DatabaseService
    from datetime import timezone

    # Calculate time range
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(hours=hours)

    # Query database for snapshots
    snapshots = DatabaseService.get_lob_snapshots(symbol, start_time, end_time)

    return LOBSnapshotsResponse(
        symbol=symbol,
        start_time=start_time.isoformat().replace('+00:00', 'Z'),
        end_time=end_time.isoformat().replace('+00:00', 'Z'),
        snapshots=snapshots,
        count=len(snapshots)
    )


@app.get("/api/order-flow-zones", response_model=OrderFlowZonesResponse)
async def get_order_flow_zones(symbol: str = Query("BTC")):
    """
    Get latest optimal trading zones from Triple Barrier analysis

    Returns zones for cumulative_v2 and cumulative_v3 signals.
    Each zone includes:
    - is_long: TRUE if LONG best, FALSE if SHORT best
    - zone_min, zone_max: Signal value boundaries
    - sharpe, win_rate, mean_return: Performance metrics
    - tp_pct, sl_pct, max_candles: Barrier parameters
    - ci_95_lower, ci_95_upper: Confidence intervals

    Frontend calculates symmetric zones by negating boundaries.
    """
    zones = DatabaseService.get_latest_zones(symbol)

    return OrderFlowZonesResponse(
        timestamp=utc_now_iso(),
        symbol=symbol,
        cumulative_v2=zones.get('cumulative_v2'),
        cumulative_v3=zones.get('cumulative_v3')
    )


@app.get("/api/historical-zones")
async def get_historical_zones(
    symbol: str = Query("BTC"),
    start: Optional[str] = Query(None, description="ISO timestamp (start of window)"),
    end: Optional[str] = Query(None, description="ISO timestamp (end of window)")
):
    """
    Get all zone snapshots within a time window for backtest replay

    Returns array of zone snapshots ordered by timestamp.
    Each snapshot contains cumulative_v2 and cumulative_v3 zones with all metrics.

    Frontend matches zones to candles by timestamp for accurate backtest simulation.
    """
    from datetime import datetime, timedelta, timezone

    # Default to last 48 hours if no time range provided
    if not end:
        end_time = datetime.now(timezone.utc)
    else:
        end_time = datetime.fromisoformat(end.replace('Z', '+00:00'))

    if not start:
        start_time = end_time - timedelta(hours=48)
    else:
        start_time = datetime.fromisoformat(start.replace('Z', '+00:00'))

    # Get all zones in time window
    zones_list = DatabaseService.get_historical_zones(symbol, start_time, end_time)

    # Group by timestamp for easier frontend consumption
    zones_by_timestamp = {}
    for zone in zones_list:
        ts = zone['timestamp']
        if ts not in zones_by_timestamp:
            zones_by_timestamp[ts] = {
                'timestamp': ts,
                'cumulative_v2': None,
                'cumulative_v3': None
            }

        # Remove timestamp and signal_type from individual zone data
        zone_data = {k: v for k, v in zone.items() if k not in ['timestamp', 'signal_type']}

        if zone['signal_type'] == 'cumulative_v2':
            zones_by_timestamp[ts]['cumulative_v2'] = zone_data
        elif zone['signal_type'] == 'cumulative_v3':
            zones_by_timestamp[ts]['cumulative_v3'] = zone_data

    # Convert to sorted list
    result = sorted(zones_by_timestamp.values(), key=lambda x: x['timestamp'])

    return {
        'symbol': symbol,
        'start_time': start_time.isoformat(),
        'end_time': end_time.isoformat(),
        'total_snapshots': len(result),
        'zones': result
    }


@app.get("/api/bots")
async def get_bots():
    """Get all bots with REAL-TIME metrics (equity updated to latest candle price)"""
    bots = DatabaseService.get_all_bots()

    # Get latest candle price
    with DatabaseService.get_session() as session:
        latest_candle = session.query(CVDCandle).filter(
            CVDCandle.symbol == 'BTC'
        ).order_by(CVDCandle.timestamp.desc()).first()

        current_price = float(latest_candle.price_close) if latest_candle else None

    # Enrich with REAL-TIME equity (calculated from latest BTC price)
    for bot in bots:
        bot_id = bot['id']

        # Get open trade (if any)
        open_trade = DatabaseService.get_open_trade(bot_id)

        # Calculate total fees paid (from all closed trades + entry fee from open trade)
        total_fees_paid = DatabaseService.get_total_fees_paid(bot_id)

        if open_trade and current_price:
            # Calculate real-time unrealized P&L
            entry_price = float(open_trade['entry_price'])
            direction = open_trade['direction']
            capital_allocated = float(open_trade['capital_allocated'])
            leverage = float(open_trade.get('leverage', 10.0))
            entry_fee = float(open_trade.get('entry_fee', 0))

            # Raw P&L percentage
            if direction == 'LONG':
                raw_pnl_pct = ((current_price - entry_price) / entry_price) * 100
            else:  # SHORT
                raw_pnl_pct = ((entry_price - current_price) / entry_price) * 100

            # Leveraged unrealized P&L (minus entry fee already paid)
            unrealized_pnl = (raw_pnl_pct * leverage / 100) * capital_allocated - entry_fee

            # Real-time equity
            balance = float(bot['current_balance'])
            current_equity = balance + capital_allocated + unrealized_pnl

            bot['current_equity'] = current_equity
            bot['unrealized_pnl'] = unrealized_pnl
            bot['allocated_capital'] = capital_allocated
            bot['has_open_position'] = True
            bot['position_direction'] = direction  # LONG or SHORT
            bot['entry_price'] = entry_price
            bot['take_profit_price'] = float(open_trade['tp_price'])
            bot['stop_loss_price'] = float(open_trade['sl_price'])
        else:
            # No open position - equity = balance
            bot['current_equity'] = float(bot['current_balance'])
            bot['unrealized_pnl'] = 0.0
            bot['allocated_capital'] = 0.0
            bot['has_open_position'] = False
            bot['position_direction'] = None

        # Add total fees paid (leverage is already in bot dict from database)
        bot['total_fees_paid'] = total_fees_paid

    return {
        "timestamp": utc_now_iso(),
        "bots": bots
    }


@app.get("/api/bots/leaderboard")
async def get_leaderboard(
    sort_by: str = Query("total_pnl_pct", description="Sort by: total_pnl_pct, sharpe_ratio, win_rate"),
    order: str = Query("desc", description="Order: asc, desc")
):
    """Get bots ranked by performance metric"""
    bots = DatabaseService.get_all_bots()

    # Sort bots
    reverse = (order == "desc")
    sorted_bots = sorted(
        bots,
        key=lambda b: b.get(sort_by) or 0,
        reverse=reverse
    )

    # Add rank
    leaderboard = []
    for rank, bot in enumerate(sorted_bots, start=1):
        leaderboard.append({
            "rank": rank,
            "bot_id": bot['id'],
            "name": bot['name'],
            "strategy_type": bot['strategy_type'],
            "status": bot['status'],
            "total_pnl_pct": bot['total_pnl_pct'],
            "sharpe_ratio": bot['sharpe_ratio'],
            "win_rate": bot['win_rate'],
            "total_trades": bot['total_trades'],
            "current_equity": bot['current_equity']
        })

    return {
        "timestamp": utc_now_iso(),
        "sort_by": sort_by,
        "order": order,
        "leaderboard": leaderboard
    }


@app.get("/api/bots/{bot_id}")
async def get_bot(bot_id: int):
    """Get single bot details"""
    bot = DatabaseService.get_bot_by_id(bot_id)
    if not bot:
        return {"error": "Bot not found"}, 404
    return {
        "timestamp": utc_now_iso(),
        "bot": bot
    }


@app.get("/api/bots/{bot_id}/trades")
async def get_bot_trades(
    bot_id: int,
    status: Optional[str] = Query(None, description="Filter by status: open, closed"),
    limit: int = Query(50, ge=1, le=500)
):
    """Get bot trades with optional status filter"""
    trades = DatabaseService.get_bot_trades(bot_id, status=status, limit=limit)
    return {
        "timestamp": utc_now_iso(),
        "bot_id": bot_id,
        "total_trades": len(trades),
        "trades": trades
    }


class BulkEquityRequest(BaseModel):
    """Request model for bulk equity endpoint"""
    bot_ids: List[int]
    from_time: Optional[str] = None
    to_time: Optional[str] = None


@app.post("/api/bots/equity-bulk")
async def get_bots_equity_bulk(
    request: BulkEquityRequest,
    limit: int = Query(1000, ge=1, le=10000)
):
    """
    Get equity curves for multiple bots in ONE query (OPTIMIZED bulk endpoint)

    This eliminates N+1 HTTP request pattern by fetching all bot equity curves in a single database query.
    Uses window function to efficiently apply per-bot LIMIT.

    Body:
    {
      "bot_ids": [5, 6, 7, 8],
      "from_time": "2025-11-01T00:00:00",  // optional
      "to_time": "2025-11-30T23:59:59"     // optional
    }

    Response:
    {
      "timestamp": "2025-12-01T10:00:00",
      "bot_count": 4,
      "data": {
        "5": [{"timestamp": "...", "equity": 10500, ...}, ...],
        "6": [{"timestamp": "...", "equity": 10300, ...}, ...],
        ...
      }
    }
    """
    import time
    start_total = time.time()

    if not request.bot_ids:
        return {"error": "At least one bot_id is required"}, 400

    if len(request.bot_ids) > 20:
        return {"error": "Maximum 20 bots per request"}, 400

    from_dt = datetime.fromisoformat(request.from_time) if request.from_time else None
    to_dt = datetime.fromisoformat(request.to_time) if request.to_time else None

    start_db = time.time()
    results = DatabaseService.get_bots_equity_bulk(
        request.bot_ids,
        from_time=from_dt,
        to_time=to_dt,
        limit_per_bot=limit
    )
    db_time = (time.time() - start_db) * 1000

    start_response = time.time()
    response_data = {
        "timestamp": utc_now_iso(),
        "bot_count": len(request.bot_ids),
        "data": results
    }
    response_time = (time.time() - start_response) * 1000
    total_time = (time.time() - start_total) * 1000

    print(f"[BULK EQUITY] DB query: {db_time:.0f}ms | Response build: {response_time:.0f}ms | Total: {total_time:.0f}ms | Bots: {len(request.bot_ids)} | Limit: {limit}")

    return response_data


# ============================================================================
# LIVE TRADING ENDPOINTS
# ============================================================================

@app.get("/api/live/account")
async def get_live_account():
    """
    Get Hyperliquid account info (balance, equity, positions) with session P&L

    Returns:
        {
            "accountValue": float,
            "totalMarginUsed": float,
            "positions": [...],
            "sessionPnl": float,       # P&L from first equity snapshot
            "sessionPnlPct": float,    # P&L percentage
            "initialEquity": float     # First equity snapshot
        }
    """
    if hl_client is None:
        return {"accountValue": 0, "totalMarginUsed": 0, "positions": [], "sessionPnl": 0, "sessionPnlPct": 0, "initialEquity": 0}

    try:
        account_info = hl_client.get_account_info()
        current_equity = account_info.get("accountValue", 0)

        # Get first equity snapshot from database (all-time first)
        snapshots = DatabaseService.get_equity_curve(hours=24*365)  # Get all snapshots

        if snapshots and len(snapshots) > 0:
            initial_equity = snapshots[0]['equity']
            session_pnl = current_equity - initial_equity
            session_pnl_pct = (session_pnl / initial_equity * 100) if initial_equity > 0 else 0

            account_info["sessionPnl"] = session_pnl
            account_info["sessionPnlPct"] = session_pnl_pct
            account_info["initialEquity"] = initial_equity
        else:
            # No snapshots yet
            account_info["sessionPnl"] = 0
            account_info["sessionPnlPct"] = 0
            account_info["initialEquity"] = current_equity

        return account_info
    except Exception as e:
        logger.error(f"Error fetching Hyperliquid account: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/live/position")
async def get_live_position():
    """
    Get current Hyperliquid position enriched with database info (TP/SL/entry time)

    Returns:
        {
            "has_position": bool,
            "side": "LONG" | "SHORT",
            "size": float,
            "entry_price": float,
            "entry_time": str,
            "current_price": float,
            "tp_price": float,
            "sl_price": float,
            "tp_order_id": str,
            "sl_order_id": str,
            "unrealized_pnl": float,
            "pnl_pct": float
        }
        or {"has_position": false} if no position
    """
    if hl_client is None:
        return {"has_position": False}

    try:
        import json
        import os

        # Load symbol from config
        config_path = os.path.join(os.path.dirname(__file__), 'config_hyperliquid.json')
        with open(config_path) as f:
            config = json.load(f)
        symbol = config.get('symbol', 'BTC')

        account_info = hl_client.get_account_info()

        # Find position for symbol in Hyperliquid
        hl_position = None
        for pos in account_info['positions']:
            if pos['coin'] == symbol:
                hl_position = pos
                break

        # No position on Hyperliquid
        if not hl_position:
            return {"has_position": False}

        # Get open trade from database (to fetch TP/SL/entry time)
        open_trade = DatabaseService.get_open_live_trade(symbol=symbol)

        # Parse Hyperliquid position data
        szi = float(hl_position.get('szi', 0))
        entry_px = float(hl_position.get('entryPx', 0))
        unrealized_pnl = float(hl_position.get('unrealizedPnl', 0))

        # Derive side from size (szi > 0 = LONG, szi < 0 = SHORT)
        side = "LONG" if szi > 0 else "SHORT"
        size = abs(szi)

        # Get current price from last candle
        latest_candle = DatabaseService.get_latest_candle(symbol=symbol)
        current_price = float(latest_candle['price_close']) if latest_candle else entry_px

        # Calculate P&L percentage
        if entry_px > 0:
            if side == "LONG":
                pnl_pct = ((current_price - entry_px) / entry_px) * 100
            else:
                pnl_pct = ((entry_px - current_price) / entry_px) * 100
        else:
            pnl_pct = 0.0

        # Build enriched response
        enriched_position = {
            "has_position": True,
            "side": side,
            "size": size,
            "entry_price": entry_px,
            "current_price": current_price,
            "unrealized_pnl": unrealized_pnl,
            "pnl_pct": round(pnl_pct, 2),
            # Defaults if no database trade found
            "entry_time": None,
            "tp_price": None,
            "sl_price": None,
            "tp_order_id": None,
            "sl_order_id": None
        }

        # Enrich with database info if available
        if open_trade:
            enriched_position.update({
                "entry_time": open_trade['entry_time'],
                "tp_price": float(open_trade['tp_price']) if open_trade.get('tp_price') else None,
                "sl_price": float(open_trade['sl_price']) if open_trade.get('sl_price') else None,
                "tp_order_id": open_trade.get('tp_order_id'),
                "sl_order_id": open_trade.get('sl_order_id')
            })

        return enriched_position

    except FileNotFoundError:
        return {"has_position": False}
    except Exception as e:
        logger.error(f"Error fetching Hyperliquid position: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/live/trades")
async def get_live_trades(limit: int = Query(50, ge=1, le=500)):
    """
    Get live trades history

    Args:
        limit: Maximum number of trades to return (1-500)

    Returns:
        {
            "trades": [
                {
                    "id": int,
                    "symbol": str,
                    "side": "LONG" | "SHORT",
                    "entry_price": float,
                    "entry_time": str,
                    "exit_price": float,
                    "exit_time": str,
                    "size": float,
                    "realized_pnl": float,
                    "status": "open" | "closed",
                    "exit_type": "TP" | "SL" | "MANUAL"
                }
            ],
            "total": int
        }
    """
    try:
        trades = DatabaseService.get_live_trades(limit=limit)
        return {
            "trades": trades,
            "total": len(trades)
        }
    except Exception as e:
        logging.error(f"Error fetching live trades: {e}")
        return {"error": str(e)}, 500


@app.get("/api/live/equity-curve")
async def get_equity_curve(hours: int = Query(24, ge=1, le=168)):
    """
    Get live account equity curve

    Args:
        hours: Hours to look back (default 24, max 168 = 1 week)

    Returns:
        {
            "snapshots": [
                {
                    "timestamp": "2024-12-18T10:00:00Z",
                    "balance": 10000.0,
                    "equity": 10250.5,
                    "unrealized_pnl": 250.5,
                    "total_margin_used": 500.0
                }
            ],
            "stats": {
                "current_equity": 10250.5,
                "initial_equity": 10000.0,
                "roi_pct": 2.505,
                "max_equity": 10300.0,
                "max_drawdown_pct": -1.5
            }
        }
    """
    try:
        from fastapi import HTTPException

        snapshots = DatabaseService.get_equity_curve(hours=hours)

        if not snapshots:
            return {"snapshots": [], "stats": None}

        # Calculate stats
        equities = [s['equity'] for s in snapshots]
        current_equity = equities[-1]
        initial_equity = equities[0]
        max_equity = max(equities)

        # Drawdown calculation
        peak = equities[0]
        max_dd = 0.0
        for eq in equities:
            if eq > peak:
                peak = eq
            dd = ((eq - peak) / peak) * 100
            if dd < max_dd:
                max_dd = dd

        roi_pct = ((current_equity - initial_equity) / initial_equity) * 100 if initial_equity > 0 else 0.0

        return {
            "snapshots": snapshots,
            "stats": {
                "current_equity": current_equity,
                "initial_equity": initial_equity,
                "roi_pct": roi_pct,
                "max_equity": max_equity,
                "max_drawdown_pct": max_dd
            }
        }
    except Exception as e:
        logger.error(f"Error fetching equity curve: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    response = {
        "service": "PsiQuant API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "candles": "/api/candles",
            "lob_density": "/api/lob-density",
            "order_flow_zones": "/api/order-flow-zones",
            "bots": "/api/bots",
            "leaderboard": "/api/bots/leaderboard",
            "live_account": "/api/live/account",
            "live_position": "/api/live/position",
            "live_trades": "/api/live/trades",
            "live_equity_curve": "/api/live/equity-curve"
        }
    }

    # Only expose docs link in development
    if not IS_PRODUCTION:
        response["docs"] = "/docs"

    return response
