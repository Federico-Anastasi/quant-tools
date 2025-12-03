import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts';

/**
 * BotCard - Premium bot performance card with mini equity sparkline
 * Consistent with PsiQuant design system
 * @param {Object} props - Component props
 * @param {Object} props.bot - Bot data
 * @param {number} props.rank - Bot ranking (1, 2, 3, ...)
 * @param {Array} props.equityCurve - Equity curve data [{timestamp, equity}, ...]
 * @param {function} props.onClick - Click handler
 */
function BotCard({ bot, rank, equityCurve = [], onClick = () => {} }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  // Strategy type badge colors - ALIGNED WITH EQUITY CHART COLORS
  const strategyColors = {
    v2_pure: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', label: 'V2 Pure', chartColor: '#3b82f6' },
    v3_momentum: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400', label: 'V3 Momentum', chartColor: '#a855f7' },
    consensus: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400', label: 'Consensus', chartColor: '#10b981' },
    v2v3_or: { bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-400', label: 'V2+V3 OR', chartColor: '#f59e0b' },
    v2v3_or_aggressive: { bg: 'bg-pink-500/20', border: 'border-pink-500/30', text: 'text-pink-400', label: 'V2+V3 Aggressive', chartColor: '#ec4899' }
  };

  const strategyStyle = strategyColors[bot.strategy_type] || strategyColors.v2_pure;

  // Calculate bot uptime from first snapshot (when bot actually started trading)
  const getUptime = () => {
    if (!equityCurve || equityCurve.length === 0) return 'N/A';

    const firstSnapshot = equityCurve[0];
    const startTime = new Date(firstSnapshot.timestamp);
    const now = new Date();
    const diffMs = now - startTime;

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Calculate REAL-TIME total P&L (closed trades + unrealized)
  const realTimePnL = (bot.total_pnl || 0) + (bot.unrealized_pnl || 0);
  const realTimePnLPct = ((realTimePnL / bot.starting_capital) * 100);

  // P&L color based on real-time P&L
  const pnlColor = realTimePnLPct >= 0 ? 'text-neon-cyan' : 'text-neon-red';
  const pnlBg = realTimePnLPct >= 0 ? 'bg-neon-cyan/10' : 'bg-neon-red/10';
  const pnlBorder = realTimePnLPct >= 0 ? 'border-neon-cyan/20' : 'border-neon-red/20';

  // Initialize equity sparkline chart
  useEffect(() => {
    if (!chartRef.current || equityCurve.length === 0) return;

    // Dispose existing chart
    if (chartInstance.current) {
      chartInstance.current.dispose();
    }

    // Create new chart
    const chart = echarts.init(chartRef.current);
    chartInstance.current = chart;

    // Prepare data
    const timestamps = equityCurve.map(d => d.timestamp);
    const equityValues = equityCurve.map(d => d.equity);

    // Determine color based on trend
    const firstEquity = equityValues[0] || bot.starting_capital;
    const lastEquity = equityValues[equityValues.length - 1] || bot.current_equity;
    const trendColor = lastEquity >= firstEquity ? '#00E5FF' : '#FF0055';

    const option = {
      grid: {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0
      },
      xAxis: {
        type: 'category',
        data: timestamps,
        show: false
      },
      yAxis: {
        type: 'value',
        show: false
      },
      series: [
        {
          type: 'line',
          data: equityValues,
          smooth: true,
          symbol: 'none',
          lineStyle: {
            width: 1.5,
            color: trendColor
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${trendColor}30` },
                { offset: 1, color: `${trendColor}05` }
              ]
            }
          }
        }
      ]
    };

    chart.setOption(option);

    // Handle resize
    const handleResize = () => {
      chart.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [equityCurve, bot.starting_capital, bot.current_equity]);

  return (
    <div
      onClick={onClick}
      className="
        relative overflow-hidden
        bg-gradient-to-br from-void-800 to-void-900
        border border-void-600/50 hover:border-neon-cyan/30
        rounded-lg
        transition-all duration-200
        hover:shadow-lg hover:shadow-neon-cyan/5
        cursor-pointer
        group
      "
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: strategyStyle.chartColor
      }}
    >
      {/* Hover Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan/0 via-neon-cyan/5 to-neon-cyan/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Card Inner Content with Padding */}
      <div className="p-4">
        {/* Header Row - Rank + Name + Position Badge */}
        <div className="relative z-10 flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Rank Number - Simple numeric ranking */}
            <div className="bg-void-700 border border-void-600 rounded w-6 h-6 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-gray-400">{rank}</span>
            </div>

            {/* Bot Name + Uptime + Position Badge */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-100 truncate">{bot.name}</h3>
                {/* Position Badge - Moved here from card */}
                {bot.has_open_position && (
                  <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    bot.position_direction === 'LONG'
                      ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30'
                      : 'bg-neon-red/20 text-neon-red border border-neon-red/30'
                  }`}>
                    {bot.position_direction}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                Uptime: <span className="text-gray-400 font-mono">{getUptime()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="relative z-10 grid grid-cols-2 gap-2 mb-3">
          {/* Equity */}
          <div className="bg-void-700/40 border border-void-600/50 rounded p-2">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">Equity</div>
            <div className="text-sm font-bold text-gray-200">
              ${(bot.current_equity || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Leverage + Trading Fee + Entry Size - Combined, less prominent */}
          <div className="bg-void-700/20 border border-void-600/30 rounded p-2">
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[9px]">
                <div>
                  <span className="text-gray-600 uppercase tracking-wider">Leverage</span>
                  <span className="ml-1 font-bold text-gray-400">{(bot.leverage || 10).toFixed(0)}x</span>
                </div>
                <div className="border-l border-void-600/30 pl-2">
                  <span className="text-gray-600 uppercase tracking-wider">Fee</span>
                  <span className="ml-1 font-bold text-gray-400">{(bot.trading_fee_pct || 0.04).toFixed(2)}%</span>
                </div>
              </div>
              <div className="text-[8px] text-gray-500 pt-0.5 border-t border-void-600/20">
                Entry: <span className="text-gray-400">10% of equity</span>
              </div>
            </div>
          </div>

          {/* P&L % (Highlighted) - REAL-TIME including unrealized */}
          <div className={`${pnlBg} ${pnlBorder} border rounded p-2 col-span-2`}>
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">Total P&L</div>
            <div className={`text-lg font-bold ${pnlColor}`}>
              {realTimePnLPct >= 0 ? '+' : ''}{realTimePnLPct.toFixed(2)}%
              <span className="text-xs ml-2 text-gray-400">
                (${realTimePnL.toFixed(2)})
              </span>
            </div>
          </div>
        </div>

        {/* Open Position Details (only when position is open) */}
        {bot.has_open_position && (
          <div className="relative z-10 mt-3 mb-4 bg-void-700/30 border border-void-600/40 rounded p-2">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <span>Open Position</span>
              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                bot.position_direction === 'LONG'
                  ? 'bg-neon-cyan/20 text-neon-cyan'
                  : 'bg-neon-red/20 text-neon-red'
              }`}>
                {bot.position_direction}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              {/* Entry Price */}
              <div>
                <span className="text-gray-500">Entry:</span>
                <span className="ml-1 font-mono text-gray-300">
                  ${(bot.entry_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Size (Allocated Capital) */}
              <div>
                <span className="text-gray-500">Size:</span>
                <span className="ml-1 font-mono text-gray-300">
                  ${(bot.allocated_capital || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>

              {/* Take Profit */}
              <div>
                <span className="text-gray-500">TP:</span>
                <span className="ml-1 font-mono text-neon-cyan">
                  ${(bot.take_profit_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="text-[9px] ml-1">
                    ({((((bot.take_profit_price || 0) - (bot.entry_price || 1)) / (bot.entry_price || 1)) * 100).toFixed(2)}%)
                  </span>
                </span>
              </div>

              {/* Stop Loss */}
              <div>
                <span className="text-gray-500">SL:</span>
                <span className="ml-1 font-mono text-neon-red">
                  ${(bot.stop_loss_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="text-[9px] ml-1">
                    ({((((bot.stop_loss_price || 0) - (bot.entry_price || 1)) / (bot.entry_price || 1)) * 100).toFixed(2)}%)
                  </span>
                </span>
              </div>

              {/* Current Unrealized P&L */}
              <div className="col-span-2 mt-1 pt-1 border-t border-void-600/40">
                <span className="text-gray-500">Position P&L:</span>
                <span className={`ml-1 font-mono font-bold ${
                  (bot.unrealized_pnl || 0) >= 0 ? 'text-neon-cyan' : 'text-neon-red'
                }`}>
                  {(bot.unrealized_pnl || 0) >= 0 ? '+' : ''}${(bot.unrealized_pnl || 0).toFixed(2)}
                  <span className="text-[9px] ml-1">
                    ({(((bot.unrealized_pnl || 0) / (bot.allocated_capital || 1)) * 100).toFixed(2)}%)
                  </span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="relative z-10 grid grid-cols-3 gap-2 text-center">
          {/* Win Rate */}
          <div>
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">Win Rate</div>
            <div className="text-xs font-bold text-gray-300">{(bot.win_rate || 0).toFixed(1)}%</div>
          </div>

          {/* Total Trades */}
          <div>
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">Trades</div>
            <div className="text-xs font-bold text-gray-300">{bot.total_trades || 0}</div>
          </div>

          {/* Win/Loss */}
          <div>
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">W/L</div>
            <div className="text-xs font-bold text-gray-300">
              <span className="text-neon-cyan">{bot.winning_trades || 0}</span>
              /
              <span className="text-neon-red">{bot.losing_trades || 0}</span>
            </div>
          </div>
        </div>

        {/* Click Hint */}
        <div className="absolute bottom-2 right-2 text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
          Click for trades →
        </div>
      </div>
    </div>
  );
}

export default BotCard;
