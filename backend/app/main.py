"""
Quant Tools FastAPI Backend
Real-time CVD + LOB Density Analysis
"""

import asyncio
import os
from datetime import datetime, timedelta
from typing import Optional, List

import numpy as np
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scipy.ndimage import gaussian_filter1d

from app.database import DatabaseService, check_db_health
from app.websocket_collector import start_collector, get_collector_status
from app.cvd_pipeline import cvd_pipeline_loop
from app.runs_pipeline import runs_pipeline_loop
from app.zone_pipeline import zone_pipeline_loop

app = FastAPI(
    title="Quant Tools API",
    description="Real-time CVD + LOB Density Analysis",
    version="1.0.0"
)

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:8080").split(",")
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

@app.on_event("startup")
async def startup_event():
    print("[APP] Starting Quant Tools Backend", flush=True)

    if not check_db_health():
        print("[APP] WARNING: Database health check failed", flush=True)

    # Start background tasks
    asyncio.create_task(start_collector())
    asyncio.create_task(cvd_pipeline_loop())
    asyncio.create_task(runs_pipeline_loop())
    asyncio.create_task(zone_pipeline_loop())

    print("[APP] All pipelines started", flush=True)


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
        timestamp=datetime.utcnow().isoformat(),
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
        timestamp=t0_dt.isoformat(),
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
        timestamp=datetime.utcnow().isoformat(),
        symbol=symbol,
        cumulative_v2=zones.get('cumulative_v2'),
        cumulative_v3=zones.get('cumulative_v3')
    )


@app.get("/")
async def root():
    return {
        "service": "Quant Tools API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "health": "/health",
            "candles": "/api/candles",
            "lob_density": "/api/lob-density",
            "order_flow_zones": "/api/order-flow-zones"
        }
    }
