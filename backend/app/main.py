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
from scipy.ndimage import gaussian_filter1d

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
    ALLOWED_FRONTEND = os.getenv("FRONTEND_URL", "https://psiquant.com")
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
    V_diff_smooth: List[float]


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

    # Start background tasks
    asyncio.create_task(start_collector())
    asyncio.create_task(cvd_pipeline_loop())
    asyncio.create_task(runs_pipeline_loop())
    asyncio.create_task(zone_pipeline_loop())
    asyncio.create_task(bot_execution_loop())

    logger.info("All pipelines started (WebSocket, CVD, Runs, Zone, Bot Executor)")


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


@app.get("/api/lob-density", response_model=LOBDensityResponse)
async def get_lob_density(
    symbol: str = Query("BTC"),
    hours: int = Query(720, ge=1, le=720),  # Default 720h (30 days) to use all available data
    price_bin: int = Query(50, ge=20, le=500),  # Default 50 USD bins for smooth profile
    t0: Optional[str] = Query(None, description="Snapshot timestamp (ISO format)")
):
    """Get LOB density heatmap data - uses all available runs from database"""

    # Parse t0
    from datetime import timezone
    if t0:
        t0_dt = datetime.fromisoformat(t0)
    else:
        t0_dt = datetime.now(timezone.utc)

    # Get runs before t0
    from_time = t0_dt - timedelta(hours=hours)

    from app.database import DatabaseService, Run
    with DatabaseService.get_session() as session:
        runs = session.query(Run).filter(
            Run.symbol == symbol,
            Run.t_end < t0_dt,
            Run.t_end >= from_time
        ).all()

        # Get current price at t0
        last_candle = DatabaseService.get_last_finalized_candle(symbol)
        if last_candle:
            p_current = last_candle['price_close']
        else:
            p_current = 100000.0

        # Price range (extract all data while in session)
        all_prices = [float(r.price_mid) for r in runs]
        runs_data = [{
            'dir': r.dir,
            'price_start': float(r.price_start),
            'price_end': float(r.price_end),
            'V_eff': float(r.V_eff),
            't_end': r.t_end
        } for r in runs]
        if all_prices:
            p_min = min(all_prices) - 1000
            p_max = max(all_prices) + 1000
        else:
            p_min = p_current - 10000
            p_max = p_current + 10000

    # Create bins (outside session)
    price_bins = list(np.arange(p_min, p_max, price_bin))

    # Compute V_eff profiles with time decay
    lambda_decay = np.log(2) / (2 * 3600)
    V_up_profile = []
    V_down_profile = []

    runs_up = [r for r in runs_data if r['dir'] == 'up']
    runs_down = [r for r in runs_data if r['dir'] == 'down']

    for p in price_bins:
        # V_up
        runs_at_p = [r for r in runs_up if
                     ((r['price_start'] <= p <= r['price_end']) or (r['price_start'] >= p >= r['price_end']))]

        if runs_at_p:
            weights = [np.exp(-lambda_decay * (t0_dt - r['t_end']).total_seconds()) for r in runs_at_p]
            V_up = np.average([r['V_eff'] for r in runs_at_p], weights=weights)
            V_up_profile.append(V_up)
        else:
            V_up_profile.append(0.0)

        # V_down
        runs_at_p = [r for r in runs_down if
                     ((r['price_start'] <= p <= r['price_end']) or (r['price_start'] >= p >= r['price_end']))]

        if runs_at_p:
            weights = [np.exp(-lambda_decay * (t0_dt - r['t_end']).total_seconds()) for r in runs_at_p]
            V_down = np.average([r['V_eff'] for r in runs_at_p], weights=weights)
            V_down_profile.append(V_down)
        else:
            V_down_profile.append(0.0)

    V_up_arr = np.array(V_up_profile)
    V_down_arr = np.array(V_down_profile)
    V_diff = V_down_arr - V_up_arr

    # Smooth
    V_diff_smooth = gaussian_filter1d(V_diff, sigma=2)

    return LOBDensityResponse(
        timestamp=t0_dt.isoformat().replace('+00:00', 'Z') if '+00:00' in t0_dt.isoformat() else t0_dt.isoformat() + 'Z',
        symbol=symbol,
        p_current=p_current,
        price_bins=price_bins,
        V_up=V_up_arr.tolist(),
        V_down=V_down_arr.tolist(),
        V_diff=V_diff.tolist(),
        V_diff_smooth=V_diff_smooth.tolist()
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


@app.post("/api/bots/{bot_id}/start")
async def start_bot(bot_id: int):
    """Start bot execution (set status='active')"""
    success = DatabaseService.update_bot_status(bot_id, 'active')
    if not success:
        return {"error": "Bot not found"}, 404
    return {"status": "success", "message": f"Bot {bot_id} started"}


@app.post("/api/bots/{bot_id}/pause")
async def pause_bot(bot_id: int):
    """Pause bot (set status='paused')"""
    success = DatabaseService.update_bot_status(bot_id, 'paused')
    if not success:
        return {"error": "Bot not found"}, 404
    return {"status": "success", "message": f"Bot {bot_id} paused"}


@app.post("/api/bots/{bot_id}/stop")
async def stop_bot(bot_id: int):
    """Stop bot permanently (set status='stopped')"""
    success = DatabaseService.update_bot_status(bot_id, 'stopped')
    if not success:
        return {"error": "Bot not found"}, 404
    return {"status": "success", "message": f"Bot {bot_id} stopped"}


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


@app.get("/api/bots/{bot_id}/equity")
async def get_bot_equity(
    bot_id: int,
    from_time: Optional[str] = Query(None, description="Start time (ISO format)"),
    to_time: Optional[str] = Query(None, description="End time (ISO format)"),
    limit: int = Query(1000, ge=1, le=10000)
):
    """Get bot equity curve data"""
    from_dt = datetime.fromisoformat(from_time) if from_time else None
    to_dt = datetime.fromisoformat(to_time) if to_time else None

    snapshots = DatabaseService.get_bot_equity(bot_id, from_time=from_dt, to_time=to_dt, limit=limit)

    return {
        "timestamp": utc_now_iso(),
        "bot_id": bot_id,
        "total_snapshots": len(snapshots),
        "snapshots": snapshots
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


@app.get("/")
async def root():
    response = {
        "service": "Quant Tools API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "candles": "/api/candles",
            "lob_density": "/api/lob-density",
            "order_flow_zones": "/api/order-flow-zones",
            "bots": "/api/bots",
            "leaderboard": "/api/bots/leaderboard"
        }
    }

    # Only expose docs link in development
    if not IS_PRODUCTION:
        response["docs"] = "/docs"

    return response
