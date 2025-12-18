import React from 'react';
import { calculatePnL } from '../utils/pnlCalculator';

/**
 * TradePanel - Trade inputs, active position display, and KPIs
 */
function TradePanel({
  tradeMode = null,
  onOpenTrade = () => {},
  tradeInputs = { size: 100, leverage: 10, fees: 0.04, tpPercent: 0.5, slPercent: 0.5 },
  onTradeInputsChange = () => {},
  onUpdateTPSL = () => {},
  activeTrade = null,
  currentPrice = 0,
  onManualExit = () => {},
  tradeHistory = [],
  totalPnl = 0,
  winRate = 0,
  currentCandle = null,
  zonesData = null
}) {
  const handleInputChange = (field, value) => {
    onTradeInputsChange({
      ...tradeInputs,
      [field]: Number(value)
    });
  };

  // Calculate unrealized P&L for active trade using shared utility
  const unrealizedPnl = activeTrade && currentPrice
    ? calculatePnL(
        activeTrade.entryPrice,
        currentPrice,
        activeTrade.direction,
        activeTrade.size,
        activeTrade.leverage,
        activeTrade.fees
      )
    : { gross: 0, fees: 0, net: 0 };

  // ═══════════════════════════════════════════════════════════
  // INDICATOR CARD HELPERS (from IndicatorsPanel)
  // ═══════════════════════════════════════════════════════════

  const getClassificationColor = (signal) => {
    if (signal === '--' || signal === null || signal === undefined) return 'text-gray-300';
    const classification = parseInt(signal);
    if (classification >= 2) return 'text-neon-cyan';
    if (classification === 1) return 'text-neon-cyan';
    if (classification <= -2) return 'text-neon-red';
    if (classification === -1) return 'text-neon-red';
    return 'text-gray-300';
  };

  const getClassificationBorderColor = (signal) => {
    if (signal === '--' || signal === null || signal === undefined) return 'border-void-600';
    const classification = parseInt(signal);
    if (classification >= 2) return 'border-neon-cyan/50';
    if (classification === 1) return 'border-neon-cyan/30';
    if (classification <= -2) return 'border-neon-red/50';
    if (classification === -1) return 'border-neon-red/30';
    return 'border-void-600';
  };

  const getValueColor = (value) => {
    if (value === '--' || value === null || value === undefined) return 'text-gray-300';
    const num = parseFloat(value);
    if (num > 5) return 'text-neon-cyan';
    if (num < -5) return 'text-neon-red';
    return 'text-gray-300';
  };

  const getMarketBias = () => {
    if (!zonesData || !zonesData.cumulative_v2 || !zonesData.cumulative_v3) {
      return { label: '--', color: 'text-gray-400', emoji: '⚪' };
    }

    const v2IsLong = zonesData.cumulative_v2.is_long;
    const v3IsLong = zonesData.cumulative_v3.is_long;

    if (v2IsLong && v3IsLong) {
      return { label: 'Positive regime observed', color: 'text-blue-400', emoji: '🔵' };
    } else if (!v2IsLong && !v3IsLong) {
      return { label: 'Negative regime observed', color: 'text-orange-400', emoji: '🟠' };
    } else {
      return { label: 'Mixed regime observed', color: 'text-gray-400', emoji: '⚪' };
    }
  };

  const getDirectionLabel = (isLong) => {
    return {
      label: isLong ? 'LONG' : 'SHORT',
      color: isLong ? 'text-green-400' : 'text-red-400',
      bgColor: 'bg-void-800 border-void-600'
    };
  };

  const getWarningLevel = (n) => {
    if (n < 10) return {
      color: 'text-red-400',
      icon: '🚨',
      text: `Critical: Only ${n} samples - Unreliable`
    };
    if (n < 20) return {
      color: 'text-orange-400',
      icon: '⚠️',
      text: `Warning: ${n} samples - High uncertainty`
    };
    if (n < 30) return {
      color: 'text-yellow-400',
      icon: '⚠️',
      text: `Low sample: ${n} trades - Use caution`
    };
    return {
      color: 'text-gray-500',
      icon: 'ℹ️',
      text: `${n} samples · 48h window`
    };
  };

  // Extract indicator values from current candle
  const lastSignal = currentCandle?.signal !== undefined && currentCandle?.signal !== null
    ? currentCandle.signal.toString()
    : '--';
  const cumulativeV1 = currentCandle?.cumulative_v1 !== undefined && currentCandle?.cumulative_v1 !== null
    ? currentCandle.cumulative_v1.toFixed(2)
    : '--';
  const cumulativeV2 = currentCandle?.cumulative_v2 !== undefined && currentCandle?.cumulative_v2 !== null
    ? currentCandle.cumulative_v2.toFixed(2)
    : '--';
  const cumulativeV3 = currentCandle?.cumulative_v3 !== undefined && currentCandle?.cumulative_v3 !== null
    ? currentCandle.cumulative_v3.toFixed(2)
    : '--';

  const marketBias = getMarketBias();

  return (
    <div className="bg-void-900 h-full overflow-y-auto">
      {/* Trade Entry Toolbar */}
      <div className="mb-3">
        <div className="flex flex-col gap-2">
          {/* Long/Short Buttons */}
          <button
            onClick={() => onOpenTrade('long')}
            disabled={!!activeTrade}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-md font-bold text-xs transition-all bg-void-700 border border-void-500 text-gray-300 hover:bg-green-500/20 hover:border-green-500 hover:text-green-400 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            Long
          </button>

          <button
            onClick={() => onOpenTrade('short')}
            disabled={!!activeTrade}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-md font-bold text-xs transition-all bg-void-700 border border-void-500 text-gray-300 hover:bg-red-500/20 hover:border-red-500 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Short
          </button>

          {/* Trade Inputs */}
          <div className="bg-void-800 border border-void-600 rounded-md p-2">
            <label className="text-[10px] text-gray-500 uppercase tracking-wide">Size ($)</label>
            <input
              type="number"
              value={tradeInputs.size}
              onChange={(e) => handleInputChange('size', e.target.value)}
              disabled={!!activeTrade}
              className="w-full bg-void-700 border border-void-500 text-gray-100 text-sm font-mono rounded-md px-2 py-1.5 mt-1 focus:outline-none focus:border-neon-cyan transition-all disabled:opacity-50"
              step="10"
              min="10"
            />
          </div>

          <div className="bg-void-800 border border-void-600 rounded-md p-2">
            <label className="text-[10px] text-gray-500 uppercase tracking-wide">Leverage</label>
            <input
              type="number"
              value={tradeInputs.leverage}
              onChange={(e) => handleInputChange('leverage', e.target.value)}
              disabled={!!activeTrade}
              className="w-full bg-void-700 border border-void-500 text-gray-100 text-sm font-mono rounded-md px-2 py-1.5 mt-1 focus:outline-none focus:border-neon-cyan transition-all disabled:opacity-50"
              step="1"
              min="1"
              max="100"
            />
          </div>

          <div className="bg-void-800 border border-void-600 rounded-md p-2">
            <label className="text-[10px] text-gray-500 uppercase tracking-wide">Fees (%)</label>
            <input
              type="number"
              value={tradeInputs.fees}
              onChange={(e) => handleInputChange('fees', e.target.value)}
              disabled={!!activeTrade}
              className="w-full bg-void-700 border border-void-500 text-gray-100 text-sm font-mono rounded-md px-2 py-1.5 mt-1 focus:outline-none focus:border-neon-cyan transition-all disabled:opacity-50"
              step="0.01"
              min="0"
              max="1"
            />
          </div>

          {/* TP/SL Sliders */}
          <div className="bg-void-800 border border-void-600 rounded-md p-2">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] text-gray-500 uppercase tracking-wide">Take Profit (%)</label>
              <span className="text-xs text-green-400 font-mono font-bold">{tradeInputs.tpPercent}%</span>
            </div>
            <input
              type="range"
              value={tradeInputs.tpPercent}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (activeTrade) {
                  onUpdateTPSL('tpPercent', value);
                }
                handleInputChange('tpPercent', value);
              }}
              className="w-full h-1.5 bg-void-700 rounded-full appearance-none cursor-pointer accent-green-500"
              min="0.1"
              max="5"
              step="0.1"
            />
          </div>

          <div className="bg-void-800 border border-void-600 rounded-md p-2">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] text-gray-500 uppercase tracking-wide">Stop Loss (%)</label>
              <span className="text-xs text-red-400 font-mono font-bold">{tradeInputs.slPercent}%</span>
            </div>
            <input
              type="range"
              value={tradeInputs.slPercent}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (activeTrade) {
                  onUpdateTPSL('slPercent', value);
                }
                handleInputChange('slPercent', value);
              }}
              className="w-full h-1.5 bg-void-700 rounded-full appearance-none cursor-pointer accent-red-500"
              min="0.1"
              max="5"
              step="0.1"
            />
          </div>
        </div>
      </div>

      {/* Active Position Display */}
      {activeTrade && (
        <div className="bg-void-800 border border-void-600 rounded-md p-3 mb-3">
          <div className="mb-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Active Position</div>
            <div className={`text-lg font-bold ${activeTrade.direction === 'long' ? 'text-green-400' : 'text-red-400'}`}>
              {activeTrade.direction.toUpperCase()}
            </div>
            <div className="text-[10px] text-gray-500">{activeTrade.leverage}× Leverage</div>
          </div>

          <div className="space-y-1.5 text-xs mb-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Entry:</span>
              <span className="text-gray-100 font-mono font-bold">${activeTrade.entryPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Current:</span>
              <span className="text-gray-100 font-mono font-bold">${currentPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-400">TP:</span>
              <span className="text-gray-100 font-mono font-bold">${activeTrade.tp.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-400">SL:</span>
              <span className="text-gray-100 font-mono font-bold">${activeTrade.sl.toFixed(2)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-void-700 mb-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Unrealized P&L</div>
            <div className={`text-base font-bold font-mono ${unrealizedPnl.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {unrealizedPnl.net >= 0 ? '+' : ''}{unrealizedPnl.net.toFixed(2)} USD
            </div>
            <div className="text-[10px] text-gray-500">
              Gross: {unrealizedPnl.gross.toFixed(2)} | Fees: {unrealizedPnl.fees.toFixed(2)}
            </div>
          </div>

          <button
            onClick={onManualExit}
            className="w-full px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500 text-amber-400 rounded-md text-xs font-bold transition-all"
          >
            Close Position
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="space-y-2 mb-4">
        <div className="bg-void-800 border border-void-600 rounded-md p-2.5 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-500"></div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">Total Trades</span>
            <div className="text-base font-bold font-mono text-gray-100">{tradeHistory.length}</div>
          </div>
        </div>

        <div className="bg-void-800 border border-void-600 rounded-md p-2.5 relative overflow-hidden">
          <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${winRate >= 50 ? 'bg-green-400' : 'bg-red-400'}`}></div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">Win Rate</span>
            <div className={`text-base font-bold font-mono ${winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
              {winRate.toFixed(0)}%
            </div>
          </div>
        </div>

        <div className="bg-void-800 border border-void-600 rounded-md p-2.5 relative overflow-hidden">
          <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${totalPnl >= 0 ? 'bg-green-400' : 'bg-red-400'}`}></div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">Net P&L</span>
            <div className={`text-base font-bold font-mono ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Order Flow Indicators */}
      <div className="space-y-4">
        {/* Last Classification */}
        <div>
          <h2 className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-2">Last Classification</h2>
          <div className={`bg-void-800 border ${getClassificationBorderColor(lastSignal)} rounded-md p-2.5 relative overflow-hidden transition-colors`}>
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-500"></div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-gray-500">Classification</span>
              <div className={`text-base font-bold font-mono ${getClassificationColor(lastSignal)}`}>{lastSignal}</div>
            </div>
          </div>
        </div>

        {/* Cumulative Indicators */}
        <div>
          <h2 className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-2">Cumulative Indicators</h2>
          <div className="grid gap-2">
            {/* V1 Cumulative */}
            <div className="bg-void-800 border border-amber-400/20 rounded-md p-2.5 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400"></div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-500">V1 Cumulative</span>
                <div className={`text-base font-bold font-mono ${getValueColor(cumulativeV1)}`}>
                  {cumulativeV1}
                </div>
              </div>
            </div>

            {/* V2 Weighted */}
            <div className="bg-void-800 border border-purple-500/20 rounded-md p-2.5 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-purple-500"></div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-500">V2 Weighted</span>
                <div className={`text-base font-bold font-mono ${getValueColor(cumulativeV2)}`}>
                  {cumulativeV2}
                </div>
              </div>
            </div>

            {/* V3 Momentum */}
            <div className="bg-void-800 border border-neon-cyan/20 rounded-md p-2.5 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-neon-cyan"></div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-500">V3 Momentum</span>
                <div className={`text-base font-bold font-mono ${getValueColor(cumulativeV3)}`}>
                  {cumulativeV3}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Statistical Patterns (Experimental) */}
        <div>
          <h2 className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-2">Statistical Patterns (Experimental)</h2>

          {/* Order Flow Regime */}
          <div className="bg-void-800 border border-void-600 rounded-md p-3 mb-2">
            <div className="text-xs text-gray-500 mb-1">Order Flow Regime (48h)</div>
            <div className={`text-sm font-bold ${marketBias.color} flex items-center justify-center gap-2`}>
              <span>{marketBias.emoji}</span>
              <span>{marketBias.label}</span>
            </div>
            {zonesData && zonesData.cumulative_v2 && (
              <div className={`text-[9px] ${getWarningLevel(zonesData.cumulative_v2.n_trades).color} flex items-center gap-1 justify-center mt-2`}>
                <span>{getWarningLevel(zonesData.cumulative_v2.n_trades).icon}</span>
                <span>{getWarningLevel(zonesData.cumulative_v2.n_trades).text}</span>
              </div>
            )}
          </div>

          {/* V2 Zone */}
          {zonesData?.cumulative_v2 && (() => {
            const v2 = zonesData.cumulative_v2;
            const dir = getDirectionLabel(v2.is_long);
            const warning = getWarningLevel(v2.n_trades);
            return (
              <div className={`bg-void-800 border rounded-md p-3 mb-2 ${dir.bgColor}`} key="v2-zone">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-purple-400 font-bold">V2 Weighted</span>
                  <span className={`text-xs font-bold ${dir.color}`}>{dir.label}</span>
                </div>
                <div className="space-y-2 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Zone</span>
                    <span className="text-gray-300 font-mono font-bold">{v2.zone_min.toFixed(1)} to {v2.zone_max.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg Return (backtest)</span>
                    <span className={`font-mono font-bold ${v2.mean_return > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {v2.mean_return > 0 ? '+' : ''}{v2.mean_return.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">CI 95%</span>
                    <span className="text-gray-300 font-mono text-[9px]">
                      {v2.ci_95_lower ? `±${((v2.ci_95_upper - v2.ci_95_lower) / 2).toFixed(2)}% (${v2.ci_95_lower.toFixed(2)}-${v2.ci_95_upper.toFixed(2)}%)` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Trades (n)</span>
                    <span className="text-gray-300 font-mono">{v2.n_trades}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">TP / SL</span>
                    <span className="text-gray-300 font-mono">{v2.tp_pct.toFixed(1)}% / {v2.sl_pct.toFixed(1)}%</span>
                  </div>
                </div>
                <div className={`text-[9px] ${warning.color} flex items-center gap-1 mt-2`}>
                  <span>{warning.icon}</span>
                  <span>{warning.text}</span>
                </div>
              </div>
            );
          })()}

          {/* V3 Zone */}
          {zonesData?.cumulative_v3 && (() => {
            const v3 = zonesData.cumulative_v3;
            const dir = getDirectionLabel(v3.is_long);
            const warning = getWarningLevel(v3.n_trades);
            return (
              <div className={`bg-void-800 border rounded-md p-3 ${dir.bgColor}`} key="v3-zone">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-cyan-400 font-bold">V3 Momentum</span>
                  <span className={`text-xs font-bold ${dir.color}`}>{dir.label}</span>
                </div>
                <div className="space-y-2 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Zone</span>
                    <span className="text-gray-300 font-mono font-bold">{v3.zone_min.toFixed(1)} to {v3.zone_max.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg Return (backtest)</span>
                    <span className={`font-mono font-bold ${v3.mean_return > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {v3.mean_return > 0 ? '+' : ''}{v3.mean_return.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">CI 95%</span>
                    <span className="text-gray-300 font-mono text-[9px]">
                      {v3.ci_95_lower ? `±${((v3.ci_95_upper - v3.ci_95_lower) / 2).toFixed(2)}% (${v3.ci_95_lower.toFixed(2)}-${v3.ci_95_upper.toFixed(2)}%)` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Trades (n)</span>
                    <span className="text-gray-300 font-mono">{v3.n_trades}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">TP / SL</span>
                    <span className="text-gray-300 font-mono">{v3.tp_pct.toFixed(1)}% / {v3.sl_pct.toFixed(1)}%</span>
                  </div>
                </div>
                <div className={`text-[9px] ${warning.color} flex items-center gap-1 mt-2`}>
                  <span>{warning.icon}</span>
                  <span>{warning.text}</span>
                </div>
              </div>
            );
          })()}

          {!zonesData && (
            <div className="bg-void-800 border border-void-600 rounded-md p-3 text-center text-gray-500 text-xs">
              Loading zones...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TradePanel;
