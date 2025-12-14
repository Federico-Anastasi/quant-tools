"""
Live Trading Executor
Background task che esegue strategia V3 Momentum su candle finalization
Pattern identico a bot_executor.py
"""

import asyncio
import logging
from datetime import datetime
from app.live_trading_service import LiveTradingService

logger = logging.getLogger(__name__)


class LiveExecutor:
    """Esecutore strategia live - trigger su candle finalization"""

    def __init__(self, strategy_config, database_service):
        """
        Inizializza executor

        Args:
            strategy_config: dict configurazione strategia
            database_service: DatabaseService instance
        """
        self.service = LiveTradingService(strategy_config)
        self.database_service = database_service
        self.is_running = False
        self.is_active = strategy_config.get('is_active', False)
        self.symbol = strategy_config.get('symbol', 'BTC')

        # Store config path for dynamic reload
        import os
        self.config_path = os.path.join(os.path.dirname(__file__), 'config_hyperliquid.json')

        status = "ACTIVE" if self.is_active else "INACTIVE"
        logger.info(f"LiveExecutor initialized - V3 Momentum strategy ({status})")

    def _reload_config(self):
        """Reload is_active flag from config file (hot-reload without restart)"""
        try:
            import json
            with open(self.config_path) as f:
                config = json.load(f)
            new_is_active = config.get('is_active', False)

            # Log only when status changes
            if new_is_active != self.is_active:
                old_status = "ACTIVE" if self.is_active else "INACTIVE"
                new_status = "ACTIVE" if new_is_active else "INACTIVE"
                logger.info(f"[CONFIG RELOAD] Strategy status changed: {old_status} → {new_status}")
                self.is_active = new_is_active

            return new_is_active
        except Exception as e:
            logger.error(f"Error reloading config: {e}")
            return self.is_active  # Keep current value on error

    async def execution_loop(self):
        """Loop principale - esegue quando si finalizza candle CVD"""
        self.is_running = True
        status = "ACTIVE" if self.is_active else "INACTIVE"
        logger.info(f"Live executor started - V3 Momentum strategy ({status})")

        while self.is_running:
            try:
                # Wait for new finalized candle
                await self._wait_for_candle_finalization()

                # Reload config to check if strategy is active (hot-reload)
                is_active = self._reload_config()

                if not is_active:
                    logger.debug("Strategy INACTIVE - skipping execution cycle")
                    continue

                # Execute strategy cycle (only if active)
                await self._execute_cycle()

            except Exception as e:
                logger.error(f"Error in live execution cycle: {e}", exc_info=True)
                await asyncio.sleep(5)

    async def _wait_for_candle_finalization(self):
        """
        Attende che si finalizzi una nuova candle CVD
        Polling ogni 2 secondi per controllare timestamp ultima candle
        """
        last_candle_id = None

        while True:
            try:
                # Get latest finalized candle
                latest_candle = self.database_service.get_last_finalized_candle(
                    symbol=self.symbol
                )

                if latest_candle:
                    candle_id = latest_candle.get('id')

                    if candle_id and candle_id != last_candle_id:
                        last_candle_id = candle_id
                        logger.debug(f"New candle detected: ID={candle_id}")
                        return  # Nuova candle disponibile

                await asyncio.sleep(2)

            except Exception as e:
                logger.error(f"Error waiting for candle: {e}")
                await asyncio.sleep(2)

    async def _execute_cycle(self):
        """Esegue un ciclo completo della strategia"""
        timestamp = datetime.utcnow()
        logger.info(f"[{timestamp.strftime('%H:%M:%S')}] Live strategy cycle started")

        try:
            # 1. Get latest data
            candle = self.database_service.get_last_finalized_candle(symbol=self.symbol)
            zones = self.database_service.get_latest_zones(symbol=self.symbol)

            if not candle:
                logger.warning("No candle data available, skipping cycle")
                return

            if not zones:
                logger.warning("No zones data available, skipping cycle")
                return

            # 2. Check current position on Hyperliquid
            account_info = self.service.hl_client.get_account_info()
            has_position = any(
                pos['coin'] == self.symbol
                for pos in account_info['positions']
            )

            if has_position:
                # Position management (sync DB with Hyperliquid)
                logger.info("Position exists - checking exit conditions")
                open_trade = self.database_service.get_open_live_trade(symbol=self.symbol)

                if open_trade:
                    exit_check = self.service.check_exit_conditions(
                        open_trade,
                        candle['price_close']
                    )

                    if exit_check['should_close']:
                        self.database_service.close_live_trade(
                            trade_id=open_trade['id'],
                            exit_price=exit_check['exit_price'],
                            exit_time=timestamp,
                            exit_type=exit_check['exit_type']
                        )
                        logger.info(f"Position closed in DB: {exit_check['exit_type']}")
                else:
                    logger.warning("Position exists on Hyperliquid but not in DB")

            else:
                # Check entry signal
                logger.info("No position - checking entry signals")
                signal = self.service.check_entry_signal(candle, zones)

                if signal:
                    logger.info(f"Entry signal detected: {signal['direction']}")
                    result = self.service.enter_position(signal, self.database_service)

                    if result['success']:
                        logger.info(
                            f"Position opened successfully - "
                            f"Trade ID: {result['trade_id']}"
                        )
                    else:
                        logger.error(f"Failed to open position: {result['message']}")
                else:
                    logger.info("No entry signal - waiting")

        except Exception as e:
            logger.error(f"Error in execute cycle: {e}", exc_info=True)

    def stop(self):
        """Stop executor"""
        self.is_running = False
        logger.info("Live executor stopped")
