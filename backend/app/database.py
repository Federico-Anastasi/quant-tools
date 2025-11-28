"""
Database service for Quant Tools
SQLAlchemy models and session management
"""

import os
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Generator, List, Optional, Dict, Any

from sqlalchemy import create_engine, Column, BigInteger, String, DECIMAL, SmallInteger, DateTime, Boolean, CHAR, Integer, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://quant_user:quant_password_2024@localhost:5433/quant_tools")

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ============================================================================
# MODELS
# ============================================================================

class Trade(Base):
    __tablename__ = "trades"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    symbol = Column(String(20), default="BTC")
    price = Column(DECIMAL(12, 2), nullable=False)
    size = Column(DECIMAL(12, 6), nullable=False)
    side = Column(CHAR(1), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class Run(Base):
    __tablename__ = "runs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    symbol = Column(String(20), default="BTC")
    t_start = Column(DateTime(timezone=True), nullable=False)
    t_end = Column(DateTime(timezone=True), nullable=False)
    price_start = Column(DECIMAL(12, 2), nullable=False)
    price_end = Column(DECIMAL(12, 2), nullable=False)
    price_mid = Column(DECIMAL(12, 2), nullable=False)
    dir = Column(String(4), nullable=False)
    delta_p = Column(DECIMAL(12, 2), nullable=False)
    Q = Column(DECIMAL(12, 4), nullable=False)
    q = Column(DECIMAL(12, 4), nullable=False)
    V_eff = Column(DECIMAL(12, 6), nullable=False)
    velocity = Column(DECIMAL(12, 4), nullable=False)
    duration = Column(DECIMAL(10, 2), nullable=False)
    n_ticks = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class CVDCandle(Base):
    __tablename__ = "cvd_candles"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, unique=True)
    symbol = Column(String(20), default="BTC")

    price_open = Column(DECIMAL(12, 2))
    price_high = Column(DECIMAL(12, 2))
    price_low = Column(DECIMAL(12, 2))
    price_close = Column(DECIMAL(12, 2))

    cvd_open = Column(DECIMAL(18, 2))
    cvd_high = Column(DECIMAL(18, 2))
    cvd_low = Column(DECIMAL(18, 2))
    cvd_close = Column(DECIMAL(18, 2))

    volume_buy = Column(DECIMAL(12, 4))
    volume_sell = Column(DECIMAL(12, 4))

    efficiency_ratio = Column(DECIMAL(8, 4))
    signal = Column(SmallInteger)
    signal_quality = Column(DECIMAL(5, 2))

    cumulative_v1 = Column(DECIMAL(8, 2), default=0)
    cumulative_v2 = Column(DECIMAL(8, 2), default=0)
    cumulative_v3 = Column(DECIMAL(8, 2), default=0)
    cumulative_v3_ema = Column(DECIMAL(8, 2), default=0)

    finalized = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True))

    def to_dict(self):
        return {
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "symbol": self.symbol,
            "price_open": float(self.price_open) if self.price_open is not None else None,
            "price_high": float(self.price_high) if self.price_high is not None else None,
            "price_low": float(self.price_low) if self.price_low is not None else None,
            "price_close": float(self.price_close) if self.price_close is not None else None,
            "cvd_open": float(self.cvd_open) if self.cvd_open is not None else None,
            "cvd_high": float(self.cvd_high) if self.cvd_high is not None else None,
            "cvd_low": float(self.cvd_low) if self.cvd_low is not None else None,
            "cvd_close": float(self.cvd_close) if self.cvd_close is not None else None,
            "volume_buy": float(self.volume_buy) if self.volume_buy is not None else None,
            "volume_sell": float(self.volume_sell) if self.volume_sell is not None else None,
            "efficiency_ratio": float(self.efficiency_ratio) if self.efficiency_ratio is not None else None,
            "signal": self.signal,
            "signal_quality": float(self.signal_quality) if self.signal_quality is not None else None,
            "cumulative_v1": float(self.cumulative_v1) if self.cumulative_v1 is not None else None,
            "cumulative_v2": float(self.cumulative_v2) if self.cumulative_v2 is not None else None,
            "cumulative_v3": float(self.cumulative_v3) if self.cumulative_v3 is not None else None,
            "finalized": self.finalized
        }


class ZoneSnapshot(Base):
    __tablename__ = "zone_snapshots"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    symbol = Column(String(20), default="BTC")
    signal_type = Column(String(20), nullable=False)

    is_long = Column(Boolean, nullable=False)
    zone_min = Column(DECIMAL(8, 2), nullable=False)
    zone_max = Column(DECIMAL(8, 2), nullable=False)
    sharpe = Column(DECIMAL(8, 2), nullable=False)
    win_rate = Column(DECIMAL(5, 4), nullable=False)
    mean_return = Column(DECIMAL(8, 4), nullable=False)
    n_trades = Column(Integer, nullable=False)
    tp_pct = Column(DECIMAL(6, 3), nullable=False)
    sl_pct = Column(DECIMAL(6, 3), nullable=False)
    max_candles = Column(Integer, nullable=False)

    ci_95_lower = Column(DECIMAL(8, 4))
    ci_95_upper = Column(DECIMAL(8, 4))
    analysis_window_candles = Column(Integer, nullable=False)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


# ============================================================================
# DATABASE SERVICE
# ============================================================================

class DatabaseService:

    @staticmethod
    @contextmanager
    def get_session() -> Generator[Session, None, None]:
        session = SessionLocal()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    @staticmethod
    def bulk_insert_trades(trades: List[Dict]) -> int:
        if not trades:
            return 0

        with DatabaseService.get_session() as session:
            from sqlalchemy.dialects.postgresql import insert
            stmt = insert(Trade).values(trades)
            result = session.execute(stmt)
            return result.rowcount

    @staticmethod
    def bulk_insert_runs(runs: List[Dict]) -> int:
        if not runs:
            return 0

        with DatabaseService.get_session() as session:
            from sqlalchemy.dialects.postgresql import insert
            stmt = insert(Run).values(runs)
            result = session.execute(stmt)
            return result.rowcount

    @staticmethod
    def upsert_candle(candle: Dict) -> int:
        with DatabaseService.get_session() as session:
            from sqlalchemy.dialects.postgresql import insert
            stmt = insert(CVDCandle).values(candle)
            stmt = stmt.on_conflict_do_update(
                index_elements=["timestamp"],
                set_={
                    "price_open": stmt.excluded.price_open,
                    "price_high": stmt.excluded.price_high,
                    "price_low": stmt.excluded.price_low,
                    "price_close": stmt.excluded.price_close,
                    "cvd_open": stmt.excluded.cvd_open,
                    "cvd_high": stmt.excluded.cvd_high,
                    "cvd_low": stmt.excluded.cvd_low,
                    "cvd_close": stmt.excluded.cvd_close,
                    "volume_buy": stmt.excluded.volume_buy,
                    "volume_sell": stmt.excluded.volume_sell,
                    "efficiency_ratio": stmt.excluded.efficiency_ratio,
                    "signal": stmt.excluded.signal,
                    "signal_quality": stmt.excluded.signal_quality,
                    "cumulative_v1": stmt.excluded.cumulative_v1,
                    "cumulative_v2": stmt.excluded.cumulative_v2,
                    "cumulative_v3": stmt.excluded.cumulative_v3,
                    "cumulative_v3_ema": stmt.excluded.cumulative_v3_ema,
                    "finalized": stmt.excluded.finalized,
                    "updated_at": datetime.utcnow()
                }
            )
            result = session.execute(stmt)
            return result.rowcount

    @staticmethod
    def get_trades_since(timestamp: datetime, symbol: str = "BTC") -> List[Dict]:
        with DatabaseService.get_session() as session:
            trades = session.query(Trade).filter(
                Trade.symbol == symbol,
                Trade.timestamp >= timestamp
            ).order_by(Trade.timestamp.asc()).all()

            return [{
                "timestamp": t.timestamp,
                "price": float(t.price),
                "size": float(t.size),
                "side": t.side
            } for t in trades]

    @staticmethod
    def get_last_finalized_candle(symbol: str = "BTC") -> Optional[Dict]:
        """Get last finalized candle as dict (detached from session)"""
        with DatabaseService.get_session() as session:
            candle = session.query(CVDCandle).filter(
                CVDCandle.symbol == symbol,
                CVDCandle.finalized == True
            ).order_by(CVDCandle.timestamp.desc()).first()

            if not candle:
                return None

            # Convert to dict to detach from session
            return {
                'id': candle.id,
                'timestamp': candle.timestamp,
                'symbol': candle.symbol,
                'price_open': float(candle.price_open),
                'price_high': float(candle.price_high),
                'price_low': float(candle.price_low),
                'price_close': float(candle.price_close),
                'cvd_open': float(candle.cvd_open),
                'cvd_high': float(candle.cvd_high),
                'cvd_low': float(candle.cvd_low),
                'cvd_close': float(candle.cvd_close),
                'volume_buy': float(candle.volume_buy),
                'volume_sell': float(candle.volume_sell),
                'efficiency_ratio': float(candle.efficiency_ratio),
                'signal': candle.signal,
                'signal_quality': float(candle.signal_quality) if candle.signal_quality else 0.0,
                'cumulative_v1': float(candle.cumulative_v1),
                'cumulative_v2': float(candle.cumulative_v2),
                'cumulative_v3': float(candle.cumulative_v3),
                'cumulative_v3_ema': float(candle.cumulative_v3_ema),
                'finalized': candle.finalized
            }

    @staticmethod
    def get_last_run_time(symbol: str = "BTC") -> Optional[datetime]:
        with DatabaseService.get_session() as session:
            run = session.query(Run).filter(
                Run.symbol == symbol
            ).order_by(Run.t_end.desc()).first()
            return run.t_end if run else None

    @staticmethod
    def get_candles(symbol: str = "BTC", limit: int = 1000, hours: Optional[int] = None) -> List[Dict]:
        with DatabaseService.get_session() as session:
            query = session.query(CVDCandle).filter(CVDCandle.symbol == symbol)

            if hours:
                from_time = datetime.utcnow() - timedelta(hours=hours)
                query = query.filter(CVDCandle.timestamp >= from_time)

            candles = query.order_by(CVDCandle.timestamp.desc()).limit(limit).all()
            return [c.to_dict() for c in reversed(candles)]

    @staticmethod
    def insert_zone_snapshot(zone_data: Dict) -> int:
        """Insert zone snapshot to database"""
        with DatabaseService.get_session() as session:
            snapshot = ZoneSnapshot(**zone_data)
            session.add(snapshot)
            session.flush()
            return snapshot.id

    @staticmethod
    def get_latest_zones(symbol: str = "BTC") -> Dict:
        """Get latest zone snapshots for v2 and v3"""
        with DatabaseService.get_session() as session:
            v2_zone = session.query(ZoneSnapshot).filter(
                ZoneSnapshot.symbol == symbol,
                ZoneSnapshot.signal_type == 'cumulative_v2'
            ).order_by(ZoneSnapshot.timestamp.desc()).first()

            v3_zone = session.query(ZoneSnapshot).filter(
                ZoneSnapshot.symbol == symbol,
                ZoneSnapshot.signal_type == 'cumulative_v3'
            ).order_by(ZoneSnapshot.timestamp.desc()).first()

            result = {}
            if v2_zone:
                result['cumulative_v2'] = {
                    'timestamp': v2_zone.timestamp.isoformat(),
                    'is_long': v2_zone.is_long,
                    'zone_min': float(v2_zone.zone_min),
                    'zone_max': float(v2_zone.zone_max),
                    'sharpe': float(v2_zone.sharpe),
                    'win_rate': float(v2_zone.win_rate),
                    'mean_return': float(v2_zone.mean_return),
                    'n_trades': v2_zone.n_trades,
                    'tp_pct': float(v2_zone.tp_pct),
                    'sl_pct': float(v2_zone.sl_pct),
                    'max_candles': v2_zone.max_candles,
                    'ci_95_lower': float(v2_zone.ci_95_lower) if v2_zone.ci_95_lower else None,
                    'ci_95_upper': float(v2_zone.ci_95_upper) if v2_zone.ci_95_upper else None
                }

            if v3_zone:
                result['cumulative_v3'] = {
                    'timestamp': v3_zone.timestamp.isoformat(),
                    'is_long': v3_zone.is_long,
                    'zone_min': float(v3_zone.zone_min),
                    'zone_max': float(v3_zone.zone_max),
                    'sharpe': float(v3_zone.sharpe),
                    'win_rate': float(v3_zone.win_rate),
                    'mean_return': float(v3_zone.mean_return),
                    'n_trades': v3_zone.n_trades,
                    'tp_pct': float(v3_zone.tp_pct),
                    'sl_pct': float(v3_zone.sl_pct),
                    'max_candles': v3_zone.max_candles,
                    'ci_95_lower': float(v3_zone.ci_95_lower) if v3_zone.ci_95_lower else None,
                    'ci_95_upper': float(v3_zone.ci_95_upper) if v3_zone.ci_95_upper else None
                }

            return result


def check_db_health() -> bool:
    try:
        with DatabaseService.get_session() as session:
            session.execute(text("SELECT 1"))
        return True
    except Exception as e:
        print(f"[DB] Health check failed: {e}")
        return False
