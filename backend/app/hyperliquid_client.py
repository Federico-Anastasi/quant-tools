"""
Hyperliquid API Client
Wrapper per interagire con Hyperliquid Exchange API
Estratto e adattato da L:\bot\2_prod\bot_hyperliquid_v2\functions.py
"""

import eth_account
from eth_account.signers.local import LocalAccount
from hyperliquid.exchange import Exchange
from hyperliquid.info import Info
import json
import os
import logging

logger = logging.getLogger(__name__)


class HyperliquidClient:
    """Client per interagire con Hyperliquid API"""

    def __init__(self, config_path='config_hyperliquid.json'):
        """
        Inizializza client Hyperliquid

        Args:
            config_path: Path al file di configurazione JSON
        """
        self.config_path = config_path
        self.address = None
        self.info = None
        self.exchange = None
        self._initialize()

    def _initialize(self):
        """Setup connessione Hyperliquid"""
        try:
            # Leggi config
            config_full_path = os.path.join(
                os.path.dirname(__file__),
                self.config_path
            )

            with open(config_full_path) as f:
                config = json.load(f)

            # Setup account
            account = eth_account.Account.from_key(config["secret_key"])
            self.address = config.get("account_address", account.address)

            # Initialize Hyperliquid clients
            self.info = Info(base_url=None, skip_ws=True)
            self.exchange = Exchange(
                account,
                base_url=None,
                account_address=self.address
            )

            # Validate account has balance
            user_state = self.info.user_state(self.address)
            account_value = float(user_state["marginSummary"]["accountValue"])

            if account_value == 0:
                logger.warning("Hyperliquid account has no equity")
            else:
                logger.info(f"Hyperliquid client initialized - Account value: ${account_value:.2f}")

        except FileNotFoundError:
            logger.error(f"Config file not found: {config_full_path}")
            raise
        except KeyError as e:
            logger.error(f"Missing key in config file: {e}")
            raise
        except Exception as e:
            logger.error(f"Error initializing Hyperliquid client: {e}")
            raise

    def get_account_info(self):
        """
        Ritorna balance e posizioni

        Returns:
            dict: {
                "accountValue": float,
                "totalMarginUsed": float,
                "positions": [
                    {
                        "coin": "BTC",
                        "szi": 0.5,  # size (signed)
                        "entryPx": 95000.0,
                        "positionValue": 47500.0,
                        "unrealizedPnl": 250.0,
                        "marginUsed": 1000.0
                    }
                ]
            }
        """
        try:
            user_state = self.info.user_state(self.address)
            margin_summary = user_state["marginSummary"]

            positions = []
            for asset_position in user_state.get("assetPositions", []):
                if "position" in asset_position:
                    positions.append(asset_position["position"])

            return {
                "accountValue": float(margin_summary["accountValue"]),
                "totalMarginUsed": float(margin_summary["totalMarginUsed"]),
                "positions": positions
            }

        except Exception as e:
            logger.error(f"Error fetching account info: {e}")
            raise

    def place_order(
        self,
        symbol,
        is_buy,
        size,
        limit_price,
        order_type={"limit": {"tif": "Gtc"}},
        reduce_only=False
    ):
        """
        Piazza ordine su Hyperliquid

        Args:
            symbol: Symbol da tradare (es. "BTC")
            is_buy: True per buy, False per sell
            size: Size dell'ordine
            limit_price: Prezzo limite
            order_type: Tipo ordine (limit, trigger, etc.)
            reduce_only: Se True, ordine reduce-only

        Returns:
            dict: {
                "order_id": str,
                "status": "ok" | "error",
                "result": dict
            }
        """
        try:
            # Round size e price ai decimali corretti (BTC)
            size = round(float(size), 5)  # BTC: 5 decimals
            limit_price = round(float(limit_price), 0)  # BTC: 0 decimals

            logger.info(
                f"Placing order: {symbol} {'BUY' if is_buy else 'SELL'} "
                f"{size} @ ${limit_price} (reduce_only={reduce_only})"
            )

            result = self.exchange.order(
                symbol,
                is_buy,
                size,
                limit_price,
                order_type,
                reduce_only=reduce_only
            )

            if result["status"] == "ok":
                status_data = result["response"]["data"]["statuses"][0]

                # Extract order ID
                order_id = None
                if "resting" in status_data:
                    order_id = status_data["resting"]["oid"]
                elif "filled" in status_data:
                    order_id = status_data["filled"]["oid"]

                if order_id:
                    logger.info(f"Order placed successfully: {order_id}")
                    return {
                        "order_id": order_id,
                        "status": "ok",
                        "result": result
                    }
                else:
                    logger.error(f"Order status unknown: {status_data}")
                    return {
                        "order_id": None,
                        "status": "error",
                        "result": result
                    }
            else:
                logger.error(f"Order failed: {result}")
                return {
                    "order_id": None,
                    "status": "error",
                    "result": result
                }

        except Exception as e:
            logger.error(f"Error placing order: {e}")
            return {
                "order_id": None,
                "status": "error",
                "result": {"error": str(e)}
            }

    def cancel_order(self, symbol, order_id):
        """
        Cancella ordine

        Args:
            symbol: Symbol dell'ordine
            order_id: ID dell'ordine da cancellare

        Returns:
            bool: True se successo
        """
        try:
            result = self.exchange.cancel(symbol, order_id)
            success = result["status"] == "ok"

            if success:
                logger.info(f"Order cancelled: {order_id}")
            else:
                logger.error(f"Failed to cancel order {order_id}: {result}")

            return success

        except Exception as e:
            logger.error(f"Error cancelling order: {e}")
            return False

    def get_open_orders(self):
        """
        Ritorna ordini aperti

        Returns:
            list: Lista ordini aperti
        """
        try:
            orders = self.info.open_orders(self.address)
            return orders

        except Exception as e:
            logger.error(f"Error fetching open orders: {e}")
            return []

    def get_user_fills(self, limit=100):
        """
        Get recent user fills from Hyperliquid
        Returns max 100 most recent fills (sorted desc by time)

        Returns:
            list: [
                {
                    "coin": "BTC",
                    "px": "95234.0",  # Fill price
                    "sz": "0.5",      # Fill size
                    "side": "B"|"A",  # Buy/Ask
                    "time": 1681222254710,  # Unix ms
                    "oid": 123456,    # Order ID
                    "closedPnl": "125.5",
                    "dir": "Close Long",
                    ...
                }
            ]
        """
        try:
            fills = self.info.user_fills(self.address)

            # Return last N fills (most recent)
            fills = fills[:limit] if fills else []

            logger.info(f"Fetched {len(fills)} user fills")
            return fills

        except Exception as e:
            logger.error(f"Error fetching user fills: {e}")
            return []

    def market_open(self, symbol, is_buy, size, slippage=0.01):
        """
        Piazza TRUE MARKET ORDER per aprire posizione
        Usa il metodo exchange.market_open() senza prezzo fisso

        Args:
            symbol: Symbol da tradare (es. "BTC")
            is_buy: True per buy, False per sell
            size: Size dell'ordine (arrotondato a 5 decimali per BTC)
            slippage: Slippage tollerance (default 1% = 0.01)

        Returns:
            dict: {
                "order_id": str,
                "status": "ok" | "error",
                "result": dict
            }
        """
        try:
            # Round size to correct decimals (BTC: 5 decimals)
            size = round(float(size), 5)

            logger.info(
                f"Placing MARKET order: {symbol} {'BUY' if is_buy else 'SELL'} "
                f"{size} (slippage={slippage*100:.1f}%)"
            )

            # TRUE market order: px=None, uses best available price
            result = self.exchange.market_open(
                symbol,
                is_buy,
                size,
                None,      # px = None → market order
                slippage   # slippage tolerance
            )

            if result["status"] == "ok":
                status_data = result["response"]["data"]["statuses"][0]

                # Extract order ID
                order_id = None
                if "filled" in status_data:
                    filled = status_data["filled"]
                    order_id = filled["oid"]
                    avg_px = filled.get("avgPx", "N/A")
                    total_sz = filled.get("totalSz", size)
                    logger.info(f"Market order filled: OID={order_id}, Size={total_sz}, AvgPx={avg_px}")

                if order_id:
                    return {
                        "order_id": order_id,
                        "status": "ok",
                        "result": result
                    }
                else:
                    logger.error(f"Market order status unknown: {status_data}")
                    return {
                        "order_id": None,
                        "status": "error",
                        "result": result
                    }
            else:
                logger.error(f"Market order failed: {result}")
                return {
                    "order_id": None,
                    "status": "error",
                    "result": result
                }

        except Exception as e:
            logger.error(f"Error placing market order: {e}")
            return {
                "order_id": None,
                "status": "error",
                "result": {"error": str(e)}
            }

    def set_leverage(self, symbol, leverage, is_cross=True):
        """
        Imposta leverage per un symbol

        Args:
            symbol: Symbol da tradare (es. "BTC")
            leverage: Leverage desiderato (int)
            is_cross: True per cross margin, False per isolated

        Returns:
            bool: True se successo
        """
        try:
            logger.info(f"Setting leverage for {symbol}: {leverage}x ({'cross' if is_cross else 'isolated'})")

            result = self.exchange.update_leverage(
                leverage=leverage,
                name=symbol,
                is_cross=is_cross
            )

            success = result.get("status") == "ok"

            if success:
                logger.info(f"Leverage set successfully: {leverage}x")
            else:
                logger.error(f"Failed to set leverage: {result}")

            return success

        except Exception as e:
            logger.error(f"Error setting leverage: {e}")
            return False
