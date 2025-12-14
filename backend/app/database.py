"""
Database service for Quant Tools
SQLAlchemy models and session management
"""

import os
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Generator, List, Optional, Dict, Any

from sqlalchemy import create_engine, Column, BigInteger, String, DECIMAL, SmallInteger, DateTime, Boolean, CHAR, Integer, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def to_utc_iso(dt):
    """Convert datetime to ISO string with 'Z' suffix for proper timezone"""
    if dt is None:
        return None
    # If datetime is naive, assume UTC and add Z
    if dt.tzinfo is None:
        return dt.isoformat() + 'Z'
    # If datetime has timezone, convert to UTC and add Z
    return dt.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://quant_user:quant_password_2024@localhost:5433/quant_tools")

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=12,           # Reduced for 4 containers (12 per container)
    max_overflow=13,        # Max 25 total per container (4×25=100 < 200 max_connections)
    pool_recycle=3600,      # Recycle connections hourly (best practice)
    pool_pre_ping=True,     # Health check before using connection
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
    trade_id = Column(BigInteger, unique=True)  # Hyperliquid unique trade ID
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
            "timestamp": to_utc_iso(self.timestamp),
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


class Bot(Base):
    """Bot configuration and performance metrics"""
    __tablename__ = "bots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    strategy_type = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False)

    # Capital tracking
    starting_capital = Column(DECIMAL(15, 2), nullable=False, default=10000.00)
    current_balance = Column(DECIMAL(15, 2), nullable=False, default=10000.00)
    current_equity = Column(DECIMAL(15, 2), nullable=False, default=10000.00)

    # Performance metrics
    total_pnl = Column(DECIMAL(15, 2), nullable=False, default=0.00)
    total_pnl_pct = Column(DECIMAL(10, 4), nullable=False, default=0.00)
    win_rate = Column(DECIMAL(5, 2))
    total_trades = Column(Integer, nullable=False, default=0)
    winning_trades = Column(Integer, nullable=False, default=0)
    losing_trades = Column(Integer, nullable=False, default=0)
    max_drawdown = Column(DECIMAL(10, 4))
    sharpe_ratio = Column(DECIMAL(10, 4))

    # Leverage and fee configuration
    leverage = Column(DECIMAL(5, 2), nullable=False, default=10.00)
    trading_fee_pct = Column(DECIMAL(5, 4), nullable=False, default=0.04)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "strategy_type": self.strategy_type,
            "status": self.status,
            "starting_capital": float(self.starting_capital),
            "current_balance": float(self.current_balance),
            "current_equity": float(self.current_equity),
            "total_pnl": float(self.total_pnl),
            "total_pnl_pct": float(self.total_pnl_pct),
            "win_rate": float(self.win_rate) if self.win_rate else None,
            "total_trades": self.total_trades,
            "winning_trades": self.winning_trades,
            "losing_trades": self.losing_trades,
            "max_drawdown": float(self.max_drawdown) if self.max_drawdown else None,
            "sharpe_ratio": float(self.sharpe_ratio) if self.sharpe_ratio else None,
            "leverage": float(self.leverage),
            "trading_fee_pct": float(self.trading_fee_pct),
            "created_at": to_utc_iso(self.created_at),
            "updated_at": to_utc_iso(self.updated_at)
        }


class BotTrade(Base):
    """Bot trade execution history"""
    __tablename__ = "bot_trades"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bot_id = Column(Integer, nullable=False)
    symbol = Column(String(20), nullable=False, default="BTC")

    # Entry details
    entry_timestamp = Column(DateTime(timezone=True), nullable=False)
    entry_price = Column(DECIMAL(15, 2), nullable=False)
    entry_signal_v2 = Column(DECIMAL(15, 8))
    entry_signal_v3 = Column(DECIMAL(15, 8))
    direction = Column(String(10), nullable=False)
    position_size = Column(DECIMAL(15, 8), nullable=False)
    capital_allocated = Column(DECIMAL(15, 2), nullable=False)

    # Exit configuration
    tp_pct = Column(DECIMAL(10, 4), nullable=False)
    sl_pct = Column(DECIMAL(10, 4), nullable=False)
    max_candles = Column(Integer, nullable=False)
    tp_price = Column(DECIMAL(15, 2), nullable=False)
    sl_price = Column(DECIMAL(15, 2), nullable=False)

    # Exit details
    exit_timestamp = Column(DateTime(timezone=True))
    exit_price = Column(DECIMAL(15, 2))
    exit_type = Column(String(10))
    candles_held = Column(Integer)

    # Results
    pnl = Column(DECIMAL(15, 2))
    pnl_pct = Column(DECIMAL(10, 4))
    status = Column(String(20), nullable=False, default='open')

    # Leverage and fees
    leverage = Column(DECIMAL(5, 2))
    entry_fee = Column(DECIMAL(15, 6))
    exit_fee = Column(DECIMAL(15, 6))
    total_fees = Column(DECIMAL(15, 6))

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "bot_id": self.bot_id,
            "symbol": self.symbol,
            "entry_timestamp": to_utc_iso(self.entry_timestamp),
            "entry_price": float(self.entry_price),
            "entry_signal_v2": float(self.entry_signal_v2) if self.entry_signal_v2 else None,
            "entry_signal_v3": float(self.entry_signal_v3) if self.entry_signal_v3 else None,
            "direction": self.direction,
            "position_size": float(self.position_size),
            "capital_allocated": float(self.capital_allocated),
            "tp_pct": float(self.tp_pct),
            "sl_pct": float(self.sl_pct),
            "max_candles": self.max_candles,
            "tp_price": float(self.tp_price),
            "sl_price": float(self.sl_price),
            "exit_timestamp": to_utc_iso(self.exit_timestamp),
            "exit_price": float(self.exit_price) if self.exit_price else None,
            "exit_type": self.exit_type,
            "candles_held": self.candles_held,
            "pnl": float(self.pnl) if self.pnl else None,
            "pnl_pct": float(self.pnl_pct) if self.pnl_pct else None,
            "status": self.status,
            "created_at": to_utc_iso(self.created_at),
            "updated_at": to_utc_iso(self.updated_at)
        }


class BotEquitySnapshot(Base):
    """Bot equity curve snapshots"""
    __tablename__ = "bot_equity_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bot_id = Column(Integer, nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False)

    # Equity components
    balance = Column(DECIMAL(15, 2), nullable=False)
    equity = Column(DECIMAL(15, 2), nullable=False)
    unrealized_pnl = Column(DECIMAL(15, 2), nullable=False, default=0.00)
    open_positions = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "bot_id": self.bot_id,
            "timestamp": to_utc_iso(self.timestamp),
            "balance": float(self.balance),
            "equity": float(self.equity),
            "unrealized_pnl": float(self.unrealized_pnl),
            "open_positions": self.open_positions,
            "created_at": to_utc_iso(self.created_at)
        }


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
            # Ignore duplicates by trade_id (Hyperliquid unique identifier)
            stmt = stmt.on_conflict_do_nothing(index_elements=['trade_id'])
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

    # ========================================================================
    # BOT MANAGEMENT METHODS
    # ========================================================================

    @staticmethod
    def get_all_bots() -> List[Dict]:
        """Get all bots with their current metrics"""
        with DatabaseService.get_session() as session:
            bots = session.query(Bot).all()
            return [bot.to_dict() for bot in bots]

    @staticmethod
    def get_active_bots() -> List[Dict]:
        """Get all active bots"""
        with DatabaseService.get_session() as session:
            bots = session.query(Bot).filter(Bot.status == 'active').all()
            return [bot.to_dict() for bot in bots]

    @staticmethod
    def get_bot_by_id(bot_id: int) -> Optional[Dict]:
        """Get single bot by ID"""
        with DatabaseService.get_session() as session:
            bot = session.query(Bot).filter(Bot.id == bot_id).first()
            return bot.to_dict() if bot else None

    @staticmethod
    def update_bot_metrics(bot_id: int, metrics: Dict) -> bool:
        """Update bot performance metrics"""
        with DatabaseService.get_session() as session:
            bot = session.query(Bot).filter(Bot.id == bot_id).first()
            if not bot:
                return False

            # Update allowed fields
            allowed_fields = [
                'current_balance', 'current_equity', 'total_pnl', 'total_pnl_pct',
                'win_rate', 'total_trades', 'winning_trades', 'losing_trades',
                'max_drawdown', 'sharpe_ratio'
            ]
            for field in allowed_fields:
                if field in metrics:
                    setattr(bot, field, metrics[field])

            bot.updated_at = datetime.utcnow()
            return True

    # ========================================================================
    # BOT TRADE METHODS
    # ========================================================================

    @staticmethod
    def create_trade(trade_data: Dict) -> int:
        """Create new bot trade and return trade ID"""
        with DatabaseService.get_session() as session:
            trade = BotTrade(**trade_data)
            session.add(trade)
            session.flush()
            return trade.id

    @staticmethod
    def get_open_trades(bot_id: int) -> List[Dict]:
        """Get all open trades for a bot"""
        with DatabaseService.get_session() as session:
            trades = session.query(BotTrade).filter(
                BotTrade.bot_id == bot_id,
                BotTrade.status == 'open'
            ).all()
            return [trade.to_dict() for trade in trades]

    @staticmethod
    def get_bot_trades(bot_id: int, status: Optional[str] = None, limit: int = 50) -> List[Dict]:
        """Get bot trades with optional status filter"""
        with DatabaseService.get_session() as session:
            query = session.query(BotTrade).filter(BotTrade.bot_id == bot_id)

            if status:
                query = query.filter(BotTrade.status == status)

            trades = query.order_by(BotTrade.entry_timestamp.desc()).limit(limit).all()
            return [trade.to_dict() for trade in trades]

    @staticmethod
    def update_trade(trade_id: int, updates: Dict) -> bool:
        """Update trade (typically for exit)"""
        with DatabaseService.get_session() as session:
            trade = session.query(BotTrade).filter(BotTrade.id == trade_id).first()
            if not trade:
                return False

            for key, value in updates.items():
                setattr(trade, key, value)

            trade.updated_at = datetime.utcnow()
            return True

    # ========================================================================
    # BOT EQUITY SNAPSHOT METHODS
    # ========================================================================

    @staticmethod
    def snapshot_equity(bot_id: int, equity_data: Dict) -> int:
        """Create equity snapshot and return snapshot ID"""
        with DatabaseService.get_session() as session:
            snapshot = BotEquitySnapshot(
                bot_id=bot_id,
                timestamp=equity_data['timestamp'],
                balance=equity_data['balance'],
                equity=equity_data['equity'],
                unrealized_pnl=equity_data.get('unrealized_pnl', 0.00),
                open_positions=equity_data.get('open_positions', 0)
            )
            session.add(snapshot)
            session.flush()
            return snapshot.id

    @staticmethod
    def get_bots_equity_bulk(bot_ids: List[int], from_time: Optional[datetime] = None,
                            to_time: Optional[datetime] = None, limit_per_bot: int = 1000) -> Dict[int, List[Dict]]:
        """
        Get equity curves for multiple bots in ONE query (OPTIMIZED bulk fetch)

        Uses window function to apply LIMIT per bot efficiently
        Returns: Dict mapping bot_id -> List[equity_snapshots]
        """
        if not bot_ids:
            return {}

        with DatabaseService.get_session() as session:
            from sqlalchemy import func

            # Subquery with row_number to apply limit per bot (DESC to get LATEST snapshots)
            subq = session.query(
                BotEquitySnapshot.bot_id,
                BotEquitySnapshot.timestamp,
                BotEquitySnapshot.balance,
                BotEquitySnapshot.equity,
                BotEquitySnapshot.unrealized_pnl,
                BotEquitySnapshot.open_positions,
                func.row_number().over(
                    partition_by=BotEquitySnapshot.bot_id,
                    order_by=BotEquitySnapshot.timestamp.desc()
                ).label('rn')
            ).filter(
                BotEquitySnapshot.bot_id.in_(bot_ids)
            )

            if from_time:
                subq = subq.filter(BotEquitySnapshot.timestamp >= from_time)
            if to_time:
                subq = subq.filter(BotEquitySnapshot.timestamp <= to_time)

            subq = subq.subquery()

            # Filter to only first limit_per_bot rows per bot
            results = session.query(subq).filter(subq.c.rn <= limit_per_bot).all()

            # Group by bot_id
            equity_by_bot = {bot_id: [] for bot_id in bot_ids}
            for row in results:
                equity_by_bot[row.bot_id].append({
                    "timestamp": to_utc_iso(row.timestamp),
                    "balance": float(row.balance),
                    "equity": float(row.equity),
                    "unrealized_pnl": float(row.unrealized_pnl),
                    "open_positions": row.open_positions
                })

            # Sort each bot's snapshots chronologically (oldest to newest) for chart display
            for bot_id in equity_by_bot:
                equity_by_bot[bot_id].sort(key=lambda x: x["timestamp"])

            return equity_by_bot

    @staticmethod
    def get_latest_equity_snapshot(bot_id: int) -> Optional[Dict]:
        """Get the most recent equity snapshot for a bot (includes unrealized P&L with fees)"""
        with DatabaseService.get_session() as session:
            snapshot = session.query(BotEquitySnapshot).filter(
                BotEquitySnapshot.bot_id == bot_id
            ).order_by(BotEquitySnapshot.timestamp.desc()).first()

            return snapshot.to_dict() if snapshot else None

    @staticmethod
    def get_open_trade(bot_id: int) -> Optional[Dict]:
        """Get the current open trade for a bot (for real-time equity calculation)"""
        with DatabaseService.get_session() as session:
            trade = session.query(BotTrade).filter(
                BotTrade.bot_id == bot_id,
                BotTrade.status == 'open'
            ).first()

            return trade.to_dict() if trade else None

    @staticmethod
    def get_total_fees_paid(bot_id: int) -> float:
        """Get total fees paid by a bot (all closed trades + entry fee from open trade)"""
        with DatabaseService.get_session() as session:
            # Sum total_fees from all closed trades
            from sqlalchemy import func
            closed_fees = session.query(func.sum(BotTrade.total_fees)).filter(
                BotTrade.bot_id == bot_id,
                BotTrade.status == 'closed'
            ).scalar() or 0.0

            # Add entry fee from open trade (if any)
            open_trade = session.query(BotTrade).filter(
                BotTrade.bot_id == bot_id,
                BotTrade.status == 'open'
            ).first()

            open_entry_fee = float(open_trade.entry_fee) if open_trade and open_trade.entry_fee else 0.0

            return float(closed_fees) + open_entry_fee

    @staticmethod
    def create_live_trade(symbol, side, entry_price, entry_time, size, tp_price, sl_price, entry_order_id, sl_order_id, tp_order_id, status='open'):
        """Create new live trade record"""
        with DatabaseService.get_session() as session:
            trade = LiveTrade(
                symbol=symbol,
                side=side,
                entry_price=entry_price,
                entry_time=entry_time,
                size=size,
                tp_price=tp_price,
                sl_price=sl_price,
                entry_order_id=entry_order_id,
                sl_order_id=sl_order_id,
                tp_order_id=tp_order_id,
                status=status
            )
            session.add(trade)
            session.commit()
            return trade.id

    @staticmethod
    def get_open_live_trade(symbol: str = 'BTC'):
        """Get currently open trade"""
        with DatabaseService.get_session() as session:
            trade = session.query(LiveTrade).filter(
                LiveTrade.symbol == symbol,
                LiveTrade.status == 'open'
            ).first()
            return trade.to_dict() if trade else None

    @staticmethod
    def close_live_trade(trade_id, exit_price, exit_time, exit_type):
        """Close trade and calculate P&L"""
        with DatabaseService.get_session() as session:
            trade = session.query(LiveTrade).filter(LiveTrade.id == trade_id).first()
            if trade:
                trade.exit_price = exit_price
                trade.exit_time = exit_time
                trade.exit_type = exit_type
                trade.status = 'closed'
                price_diff = float(exit_price) - float(trade.entry_price) if trade.side == 'LONG' else float(trade.entry_price) - float(exit_price)
                trade.realized_pnl = price_diff * float(trade.size)
                trade.updated_at = datetime.utcnow()
                session.commit()

    @staticmethod
    def get_live_trades(limit=50):
        """Get trades history"""
        with DatabaseService.get_session() as session:
            trades = session.query(LiveTrade).order_by(LiveTrade.entry_time.desc()).limit(limit).all()
            return [t.to_dict() for t in trades]


class LiveTrade(Base):
    """Live trading on Hyperliquid exchange"""
    __tablename__ = "live_trades"

    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(10), nullable=False)
    side = Column(String(5), nullable=False)
    entry_price = Column(DECIMAL(20, 8), nullable=False)
    entry_time = Column(DateTime(timezone=True), nullable=False)
    exit_price = Column(DECIMAL(20, 8))
    exit_time = Column(DateTime(timezone=True))
    size = Column(DECIMAL(20, 8), nullable=False)
    tp_price = Column(DECIMAL(20, 8))
    sl_price = Column(DECIMAL(20, 8))
    unrealized_pnl = Column(DECIMAL(20, 8))
    realized_pnl = Column(DECIMAL(20, 8))
    entry_order_id = Column(String(50))
    sl_order_id = Column(String(50))
    tp_order_id = Column(String(50))
    status = Column(String(20), nullable=False, default='open')
    exit_type = Column(String(10))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "symbol": self.symbol,
            "side": self.side,
            "entry_price": float(self.entry_price) if self.entry_price else None,
            "entry_time": self.entry_time.isoformat() if self.entry_time else None,
            "exit_price": float(self.exit_price) if self.exit_price else None,
            "exit_time": self.exit_time.isoformat() if self.exit_time else None,
            "size": float(self.size) if self.size else None,
            "tp_price": float(self.tp_price) if self.tp_price else None,
            "sl_price": float(self.sl_price) if self.sl_price else None,
            "unrealized_pnl": float(self.unrealized_pnl) if self.unrealized_pnl else None,
            "realized_pnl": float(self.realized_pnl) if self.realized_pnl else None,
            "entry_order_id": self.entry_order_id,
            "sl_order_id": self.sl_order_id,
            "tp_order_id": self.tp_order_id,
            "status": self.status,
            "exit_type": self.exit_type,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


def check_db_health() -> bool:
    try:
        with DatabaseService.get_session() as session:
            session.execute(text("SELECT 1"))
        return True
    except Exception as e:
        print(f"[DB] Health check failed: {e}")
        return False
