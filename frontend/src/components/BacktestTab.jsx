import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import PlayerControls from './PlayerControls';
import BacktestChart from './BacktestChart';
import TradePanel from './TradePanel';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * BacktestTab - Manual backtest replay with trade execution
 * Progressive candle reveal + interactive trade entry/exit
 */
function BacktestTab({ candlesData, zonesData }) {
  // Playback state
  const [currentIndex, setCurrentIndex] = useState(0); // Start at candle 0
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(500); // ms per candle

  // Historical zones for backtest
  const [historicalZones, setHistoricalZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(true);

  // Trade state
  const [tradeMode, setTradeMode] = useState(null); // 'long' | 'short' | null
  const [activeTrade, setActiveTrade] = useState(null);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [tradeInputs, setTradeInputs] = useState({
    size: 100,
    leverage: 10,
    fees: 0.04,
    tpPercent: 0.5,  // TP in %
    slPercent: 0.5   // SL in %
  });

  const playIntervalRef = useRef(null);

  // Total candles
  const totalCandles = candlesData?.candles?.length || 0;

  // Slice data for progressive reveal (show only 0 to currentIndex)
  const getVisibleData = () => {
    if (!candlesData || !candlesData.candles) return null;

    const visibleCandles = candlesData.candles.slice(0, currentIndex + 1);
    const timestamps = visibleCandles.map(c => c.timestamp);

    return {
      price_ohlc: {
        index: timestamps,
        data: {
          open: visibleCandles.map(c => c.price_open),
          high: visibleCandles.map(c => c.price_high),
          low: visibleCandles.map(c => c.price_low),
          close: visibleCandles.map(c => c.price_close)
        }
      },
      cvd_ohlc: {
        index: timestamps,
        data: {
          open: visibleCandles.map(c => c.cvd_open),
          high: visibleCandles.map(c => c.cvd_high),
          low: visibleCandles.map(c => c.cvd_low),
          close: visibleCandles.map(c => c.cvd_close)
        }
      },
      vol_buy: {
        index: timestamps,
        values: visibleCandles.map(c => c.volume_buy)
      },
      vol_sell: {
        index: timestamps,
        values: visibleCandles.map(c => c.volume_sell)
      },
      weighted_cumulative_segments: [{
        index: timestamps,
        values: visibleCandles.map(c => c.cumulative_v2 || 0)
      }],
      momentum_v3_segments: [{
        index: timestamps,
        values: visibleCandles.map(c => c.cumulative_v3 || 0)
      }],
      cumulative_segments: [{
        index: timestamps,
        values: visibleCandles.map(c => c.cumulative_v1 || 0)
      }]
    };
  };

  const visibleData = getVisibleData();

  // Get current candle price for P&L calculations
  const getCurrentPrice = () => {
    if (!candlesData || !candlesData.candles || currentIndex >= candlesData.candles.length) {
      return 0;
    }
    return candlesData.candles[currentIndex].price_close;
  };

  const currentPrice = getCurrentPrice();

  // Get current candle for indicators
  const getCurrentCandle = () => {
    if (!candlesData || !candlesData.candles || currentIndex >= candlesData.candles.length) {
      return null;
    }
    return candlesData.candles[currentIndex];
  };

  const currentCandle = getCurrentCandle();

  // Load historical zones when candlesData changes
  useEffect(() => {
    const loadHistoricalZones = async () => {
      if (!candlesData || !candlesData.candles || candlesData.candles.length === 0) {
        setZonesLoading(false);
        return;
      }

      try {
        setZonesLoading(true);

        // Get time range from candlesData
        const firstCandle = candlesData.candles[0];
        const lastCandle = candlesData.candles[candlesData.candles.length - 1];

        const response = await axios.get(`${API_URL}/api/historical-zones`, {
          params: {
            symbol: 'BTC',
            start: firstCandle.timestamp,
            end: lastCandle.timestamp
          }
        });

        setHistoricalZones(response.data.zones || []);
        setZonesLoading(false);
      } catch (err) {
        console.error('[BacktestTab] Error loading historical zones:', err);
        setHistoricalZones([]);
        setZonesLoading(false);
      }
    };

    loadHistoricalZones();
  }, [candlesData]);

  // Find the zone snapshot closest to (but not after) the current candle timestamp
  const getCurrentZones = () => {
    if (!currentCandle || !historicalZones || historicalZones.length === 0) {
      return null;
    }

    const currentTimestamp = new Date(currentCandle.timestamp).getTime();

    // Find the most recent zone snapshot before or at current candle time
    let closestZone = null;
    let closestDiff = Infinity;

    for (const zone of historicalZones) {
      const zoneTimestamp = new Date(zone.timestamp).getTime();
      const diff = currentTimestamp - zoneTimestamp;

      // Only consider zones from before or at current candle (not future zones)
      if (diff >= 0 && diff < closestDiff) {
        closestZone = zone;
        closestDiff = diff;
      }
    }

    return closestZone;
  };

  const currentZones = getCurrentZones();

  // Debug: Log zone changes
  useEffect(() => {
    if (currentZones) {
      console.log('[BacktestTab] Current zones updated:', {
        timestamp: currentZones.timestamp,
        v2: currentZones.cumulative_v2 ? `${currentZones.cumulative_v2.zone_min} to ${currentZones.cumulative_v2.zone_max}` : 'N/A',
        v3: currentZones.cumulative_v3 ? `${currentZones.cumulative_v3.zone_min} to ${currentZones.cumulative_v3.zone_max}` : 'N/A',
        currentIndex
      });
    }
  }, [currentZones, currentIndex]);

  // ═══════════════════════════════════════════════════════════
  // PLAYBACK CONTROLS
  // ═══════════════════════════════════════════════════════════

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleStepBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleStepForward = () => {
    if (currentIndex < totalCandles - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setIsPlaying(false);
    setActiveTrade(null);
    setTradeHistory([]);
    setTradeMode(null);
  };

  const handleSliderChange = (newIndex) => {
    setCurrentIndex(newIndex);
    // Pause playback when manually scrubbing
    if (isPlaying) {
      setIsPlaying(false);
    }
  };

  // Play interval
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= totalCandles - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, playSpeed);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, playSpeed, totalCandles]);

  // ═══════════════════════════════════════════════════════════
  // TRADE MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  const calculatePnL = (entry, exit, direction, size, leverage, fees) => {
    const rawPnl = direction === 'long'
      ? (exit - entry) / entry * 100
      : (entry - exit) / entry * 100;

    const leveragedPnl = (rawPnl * leverage / 100) * size;
    const entryFee = (size * leverage) * (fees / 100);
    const exitFee = (size * leverage) * (fees / 100);
    const totalFees = entryFee + exitFee;
    const netPnl = leveragedPnl - totalFees;

    return { gross: leveragedPnl, fees: totalFees, net: netPnl };
  };

  const closePosition = (exitType, exitPrice, pnl) => {
    const closedTrade = {
      ...activeTrade,
      exitIndex: currentIndex,
      exitPrice,
      exitType,
      pnl: pnl.net,
      pnlGross: pnl.gross,
      fees: pnl.fees
    };

    setTradeHistory(prev => [...prev, closedTrade]);
    setActiveTrade(null);
    setTradeMode(null);
  };

  const handleManualExit = () => {
    if (!activeTrade) return;

    const pnl = calculatePnL(
      activeTrade.entryPrice,
      currentPrice,
      activeTrade.direction,
      activeTrade.size,
      activeTrade.leverage,
      activeTrade.fees
    );

    closePosition('MANUAL', currentPrice, pnl);
  };

  // Open trade immediately when Long/Short is clicked
  const handleOpenTrade = (direction) => {
    if (activeTrade || !currentCandle) return;

    const entryPrice = currentPrice;
    const tpPrice = direction === 'long'
      ? entryPrice * (1 + tradeInputs.tpPercent / 100)
      : entryPrice * (1 - tradeInputs.tpPercent / 100);
    const slPrice = direction === 'long'
      ? entryPrice * (1 - tradeInputs.slPercent / 100)
      : entryPrice * (1 + tradeInputs.slPercent / 100);

    setActiveTrade({
      entryIndex: currentIndex,
      entryPrice,
      direction,
      tp: tpPrice,
      sl: slPrice,
      size: tradeInputs.size,
      leverage: tradeInputs.leverage,
      fees: tradeInputs.fees
    });
  };

  // Update TP/SL dynamically while trade is active
  const handleUpdateTPSL = (field, value) => {
    if (!activeTrade) return;

    const { entryPrice, direction } = activeTrade;
    const percent = Number(value);

    let newTP = activeTrade.tp;
    let newSL = activeTrade.sl;

    if (field === 'tpPercent') {
      newTP = direction === 'long'
        ? entryPrice * (1 + percent / 100)
        : entryPrice * (1 - percent / 100);
    } else if (field === 'slPercent') {
      newSL = direction === 'long'
        ? entryPrice * (1 - percent / 100)
        : entryPrice * (1 + percent / 100);
    }

    setActiveTrade({
      ...activeTrade,
      tp: newTP,
      sl: newSL
    });
  };

  // Auto-exit on TP/SL hit
  useEffect(() => {
    if (!activeTrade || !candlesData || currentIndex >= totalCandles) return;

    const currentCandle = candlesData.candles[currentIndex];
    if (!currentCandle) return;

    const { entryPrice, tp, sl, direction, size, leverage, fees } = activeTrade;

    let exitType = null;
    let exitPrice = null;

    if (direction === 'long') {
      if (currentCandle.price_high >= tp) {
        exitType = 'TP';
        exitPrice = tp;
      } else if (currentCandle.price_low <= sl) {
        exitType = 'SL';
        exitPrice = sl;
      }
    } else { // short
      if (currentCandle.price_low <= tp) {
        exitType = 'TP';
        exitPrice = tp;
      } else if (currentCandle.price_high >= sl) {
        exitType = 'SL';
        exitPrice = sl;
      }
    }

    if (exitType) {
      const pnl = calculatePnL(entryPrice, exitPrice, direction, size, leverage, fees);
      closePosition(exitType, exitPrice, pnl);
    }
  }, [currentIndex, activeTrade, candlesData]);

  // ═══════════════════════════════════════════════════════════
  // STATISTICS
  // ═══════════════════════════════════════════════════════════

  const totalPnl = tradeHistory.reduce((sum, trade) => sum + trade.pnl, 0);
  const winningTrades = tradeHistory.filter(t => t.pnl > 0).length;
  const winRate = tradeHistory.length > 0 ? (winningTrades / tradeHistory.length) * 100 : 0;

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  if (!candlesData || totalCandles === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-gray-400 mb-2">No candle data available</div>
          <div className="text-xs text-gray-500">Switch to Order Flow tab to load data</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-void-900">
      {/* Player Controls (Full Width) */}
      <PlayerControls
        isPlaying={isPlaying}
        currentIndex={currentIndex}
        totalCandles={totalCandles}
        playSpeed={playSpeed}
        onPlayPause={handlePlayPause}
        onStepBack={handleStepBack}
        onStepForward={handleStepForward}
        onSpeedChange={setPlaySpeed}
        onReset={handleReset}
        onSliderChange={handleSliderChange}
      />

      {/* Main Layout: Chart (80%) + Trade Panel (20%) */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 p-3 overflow-y-auto">
        {/* Chart Card (80% width on desktop, full width on mobile) */}
        <div className="flex-1 lg:w-[80%] bg-void-800/50 border border-void-600/50 rounded-lg relative overflow-hidden">
          <BacktestChart
            data={visibleData}
            activeTrade={activeTrade}
            tradeHistory={tradeHistory}
            historicalZones={historicalZones}
          />
        </div>

        {/* Trade Panel Sidebar (20% width on desktop, full width on mobile) */}
        <aside className="w-full lg:w-[20%]">
          <TradePanel
            tradeMode={tradeMode}
            onOpenTrade={handleOpenTrade}
            tradeInputs={tradeInputs}
            onTradeInputsChange={setTradeInputs}
            onUpdateTPSL={handleUpdateTPSL}
            activeTrade={activeTrade}
            currentPrice={currentPrice}
            onManualExit={handleManualExit}
            tradeHistory={tradeHistory}
            totalPnl={totalPnl}
            winRate={winRate}
            currentCandle={currentCandle}
            zonesData={currentZones}
            zonesLoading={zonesLoading}
          />
        </aside>
      </div>
    </div>
  );
}

export default BacktestTab;
