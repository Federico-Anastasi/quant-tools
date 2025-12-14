"""
Live Trading Service
Logica strategia V3 Momentum per live trading su Hyperliquid
"""

from app.hyperliquid_client import HyperliquidClient
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class LiveTradingService:
    """Servizio per gestire trading live con strategia V3 Momentum"""

    def __init__(self, strategy_config):
        """
        Inizializza servizio live trading

        Args:
            strategy_config: dict con configurazione strategia
                {
                    'symbol': str,
                    'risk_pct': float,
                    'trading_fee_pct': float,
                    'min_zone_trades': int (optional)
                }
        """
        self.hl_client = HyperliquidClient()
        self.config = strategy_config
        self.symbol = strategy_config.get('symbol', 'BTC')
        self.risk_pct = strategy_config.get('risk_pct', 2.0)
        self.trading_fee_pct = strategy_config.get('trading_fee_pct', 0.04)
        self.min_zone_trades = strategy_config.get('min_zone_trades', 10)

        logger.info(
            f"LiveTradingService initialized - "
            f"Symbol: {self.symbol}, "
            f"Risk: {self.risk_pct}%, "
            f"Fee: {self.trading_fee_pct}%"
        )

    def check_entry_signal(self, current_candle, zones):
        """
        Controlla se ci sono segnali di entry basati SOLO su V3 Momentum

        Args:
            current_candle: dict con dati candle corrente
                {
                    "cumulative_v3": float,
                    "price_close": float
                }
            zones: dict con zone V3
                {
                    "cumulative_v3": {
                        "zone_min": float,
                        "zone_max": float,
                        "is_long": bool,
                        "tp_pct": float,
                        "sl_pct": float,
                        "n_trades": int
                    }
                }

        Returns:
            None se nessun segnale, altrimenti dict:
            {
                "direction": "LONG" | "SHORT",
                "entry_price": float,
                "tp_price": float,
                "sl_price": float,
                "size": float,
                "tp_pct": float,
                "sl_pct": float
            }
        """
        try:
            v3_value = current_candle.get('cumulative_v3')
            current_price = current_candle.get('price_close')

            if v3_value is None or current_price is None:
                logger.warning("Missing v3_value or price_close in candle")
                return None

            v3_zone = zones.get('cumulative_v3')
            if not v3_zone:
                logger.warning("No V3 zone available")
                return None

            # Validazione zona: minimo n_trades
            n_trades = v3_zone.get('n_trades', 0)
            if n_trades < self.min_zone_trades:
                logger.info(
                    f"Zone has insufficient trades: {n_trades} < {self.min_zone_trades}"
                )
                return None

            zone_min = v3_zone['zone_min']
            zone_max = v3_zone['zone_max']
            is_long_zone = v3_zone['is_long']
            tp_pct = v3_zone['tp_pct']
            sl_pct = v3_zone['sl_pct']

            # Check se V3 è nella zona principale o opposta
            v3_in_zone = zone_min <= v3_value <= zone_max
            v3_in_opposite = -zone_max <= v3_value <= -zone_min

            # Entry conditions (SOLO V3)
            direction = None
            if v3_in_zone:
                # V3 nella zona principale
                direction = "LONG" if is_long_zone else "SHORT"
                logger.info(
                    f"V3 in main zone: {v3_value:.2f} in [{zone_min:.2f}, {zone_max:.2f}] "
                    f"→ {direction}"
                )
            elif v3_in_opposite:
                # V3 nella zona opposta
                direction = "SHORT" if is_long_zone else "LONG"
                logger.info(
                    f"V3 in opposite zone: {v3_value:.2f} in [{-zone_max:.2f}, {-zone_min:.2f}] "
                    f"→ {direction}"
                )
            else:
                # V3 fuori da entrambe le zone
                return None

            # Calcola TP/SL usando le percentuali dalla zona V3
            if direction == "LONG":
                tp_price = current_price * (1 + tp_pct / 100)
                sl_price = current_price * (1 - sl_pct / 100)
            else:  # SHORT
                tp_price = current_price * (1 - tp_pct / 100)
                sl_price = current_price * (1 + sl_pct / 100)

            # Calcola size con rischio fisso
            account_info = self.hl_client.get_account_info()
            account_value = account_info['accountValue']

            if account_value == 0:
                logger.error("Account value is zero, cannot place order")
                return None

            # Fixed risk calculation
            risk_amount = account_value * (self.risk_pct / 100)
            sl_pct_abs = abs(sl_pct) / 100
            fee_pct = self.trading_fee_pct / 100

            # Notional value needed for fixed risk
            notional = risk_amount / (sl_pct_abs + 2 * fee_pct)

            # Leverage required (use full account as margin)
            leverage = notional / account_value

            # Size in BTC
            size = notional / current_price

            # Round leverage to integer (Hyperliquid requirement)
            leverage_int = max(1, int(round(leverage)))

            logger.info(
                f"Entry signal detected - {direction}: "
                f"Entry=${current_price:.0f}, TP=${tp_price:.0f} ({tp_pct:.2f}%), "
                f"SL=${sl_price:.0f} ({sl_pct:.2f}%), "
                f"Size={size:.5f} BTC, Leverage={leverage_int}x, "
                f"Risk=${risk_amount:.2f} ({self.risk_pct}%)"
            )

            return {
                "direction": direction,
                "entry_price": current_price,
                "tp_price": tp_price,
                "sl_price": sl_price,
                "size": size,
                "leverage": leverage_int,
                "tp_pct": tp_pct,
                "sl_pct": sl_pct
            }

        except Exception as e:
            logger.error(f"Error checking entry signal: {e}")
            return None

    def enter_position(self, signal, database_service):
        """
        Apre posizione con TP e SL su Hyperliquid

        Args:
            signal: dict con segnale entry (output di check_entry_signal)
            database_service: DatabaseService instance per salvare trade

        Returns:
            dict: {
                "success": bool,
                "trade_id": int | None,
                "order_id": str | None,
                "message": str
            }
        """
        try:
            logger.info(f"Entering {signal['direction']} position...")

            # 0. Set leverage for this position
            leverage_result = self.hl_client.set_leverage(
                symbol=self.symbol,
                leverage=signal['leverage']
            )

            if not leverage_result:
                return {
                    "success": False,
                    "trade_id": None,
                    "order_id": None,
                    "message": f"Failed to set leverage to {signal['leverage']}x"
                }

            # 1. Piazza ordine di entry (IOC - Immediate or Cancel)
            is_buy = signal['direction'] == "LONG"
            entry_result = self.hl_client.place_order(
                symbol=self.symbol,
                is_buy=is_buy,
                size=signal['size'],
                limit_price=signal['entry_price'],
                order_type={"limit": {"tif": "Ioc"}}
            )

            if entry_result['status'] != 'ok':
                return {
                    "success": False,
                    "trade_id": None,
                    "order_id": None,
                    "message": f"Entry order failed: {entry_result.get('result', 'Unknown error')}"
                }

            # 2. Piazza SL (trigger order)
            sl_result = self.hl_client.place_order(
                symbol=self.symbol,
                is_buy=not is_buy,  # Opposite direction
                size=signal['size'],
                limit_price=signal['sl_price'],
                order_type={
                    "trigger": {
                        "triggerPx": signal['sl_price'],
                        "isMarket": True,
                        "tpsl": "sl"
                    }
                },
                reduce_only=True
            )

            # 3. Piazza TP (trigger order)
            tp_result = self.hl_client.place_order(
                symbol=self.symbol,
                is_buy=not is_buy,
                size=signal['size'],
                limit_price=signal['tp_price'],
                order_type={
                    "trigger": {
                        "triggerPx": signal['tp_price'],
                        "isMarket": True,
                        "tpsl": "tp"
                    }
                },
                reduce_only=True
            )

            # 4. Salva trade nel DB
            trade_id = database_service.create_live_trade(
                symbol=self.symbol,
                side=signal['direction'],
                entry_price=signal['entry_price'],
                entry_time=datetime.utcnow(),
                size=signal['size'],
                tp_price=signal['tp_price'],
                sl_price=signal['sl_price'],
                entry_order_id=entry_result['order_id'],
                sl_order_id=sl_result.get('order_id'),
                tp_order_id=tp_result.get('order_id'),
                status='open'
            )

            logger.info(
                f"Position opened successfully - "
                f"Trade ID: {trade_id}, "
                f"Entry Order ID: {entry_result['order_id']}"
            )

            return {
                "success": True,
                "trade_id": trade_id,
                "order_id": entry_result['order_id'],
                "message": f"{signal['direction']} position opened"
            }

        except Exception as e:
            logger.error(f"Error entering position: {e}")
            return {
                "success": False,
                "trade_id": None,
                "order_id": None,
                "message": str(e)
            }

    def check_exit_conditions(self, trade, current_price):
        """
        Controlla se la posizione deve essere chiusa
        TP/SL sono già gestiti da trigger orders su Hyperliquid

        Questa funzione serve solo per sincronizzare DB con stato Hyperliquid

        Args:
            trade: dict con dati trade aperto dal DB
            current_price: float prezzo corrente

        Returns:
            dict: {
                "should_close": bool,
                "exit_type": str ("TP" | "SL" | "MANUAL") | None,
                "exit_price": float | None
            }
        """
        try:
            # Controlla se la posizione è ancora aperta su Hyperliquid
            account_info = self.hl_client.get_account_info()

            position_exists = False
            for pos in account_info['positions']:
                if pos['coin'] == self.symbol:
                    position_exists = True
                    break

            # Se posizione non esiste più su Hyperliquid ma è "open" nel DB
            if not position_exists and trade['status'] == 'open':
                logger.info(
                    f"Position no longer exists on Hyperliquid - "
                    f"Trade ID: {trade['id']}, closing in DB"
                )

                # Non possiamo determinare con certezza se TP o SL da qui
                # Lo segniamo come MANUAL (in futuro potremmo controllare order history)
                return {
                    "should_close": True,
                    "exit_type": "MANUAL",
                    "exit_price": current_price
                }

            return {"should_close": False, "exit_type": None, "exit_price": None}

        except Exception as e:
            logger.error(f"Error checking exit conditions: {e}")
            return {"should_close": False, "exit_type": None, "exit_price": None}
