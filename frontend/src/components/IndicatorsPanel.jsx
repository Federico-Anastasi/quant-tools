import React from 'react';

export default function IndicatorsPanel({ kpis = {}, systemInfo = {}, zonesData = null }) {
  const {
    last_signal = '--',
    cumulative_v1 = '--',
    cumulative_v2 = '--',
    cumulative_v3 = '--'
  } = kpis;

  const {
    total_candles = '0',
    timeframe = '3 min',
    last_update = '--'
  } = systemInfo;

  // Determine classification color based on strength
  const getClassificationColor = () => {
    if (last_signal === '--') return 'text-gray-300';
    const classification = parseInt(last_signal);
    if (classification >= 2) return 'text-neon-cyan';
    if (classification === 1) return 'text-neon-cyan';
    if (classification <= -2) return 'text-neon-red';
    if (classification === -1) return 'text-neon-red';
    return 'text-gray-300';
  };

  // Determine border color for last classification card
  const getClassificationBorderColor = () => {
    if (last_signal === '--') return 'border-void-600';
    const classification = parseInt(last_signal);
    if (classification >= 2) return 'border-neon-cyan/50';
    if (classification === 1) return 'border-neon-cyan/30';
    if (classification <= -2) return 'border-neon-red/50';
    if (classification === -1) return 'border-neon-red/30';
    return 'border-void-600';
  };

  // Color based on value
  const getValueColor = (value) => {
    if (value === '--') return 'text-gray-300';
    const num = parseFloat(value);
    if (num > 5) return 'text-neon-cyan';
    if (num < -5) return 'text-neon-red';
    return 'text-gray-300';
  };

  // Calculate market bias from zone data (Order Flow Regime)
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

  // Get direction label and color for a zone (green for LONG, red for SHORT)
  const getDirectionLabel = (isLong) => {
    return {
      label: isLong ? 'LONG' : 'SHORT',
      color: isLong ? 'text-green-400' : 'text-red-400',
      bgColor: 'bg-void-800 border-void-600'
    };
  };

  // Sample size warning system
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

  return (
    <div className="h-full flex flex-col gap-4">

      {/* Last Classification with inline Legend tooltip */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xs uppercase tracking-widest text-gray-500 font-bold">Last Classification</h2>
          {/* Info icon with tooltip */}
          <div className="group relative">
            <svg className="w-4 h-4 text-gray-500 hover:text-neon-cyan cursor-help transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {/* Tooltip - Classification Legend */}
            <div className="absolute right-0 top-6 w-64 bg-void-800 border border-void-600 rounded-md p-3 text-xs font-mono space-y-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2 font-bold">Classification Scale</div>

              <div className="flex justify-between items-center">
                <span className="text-neon-cyan font-bold">+3</span>
                <span className="text-gray-400">Strong Coherence</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-neon-cyan font-bold">+2</span>
                <span className="text-gray-400">Divergence</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-neon-cyan font-bold">+1</span>
                <span className="text-gray-400">Absorption</span>
              </div>

              <div className="border-t border-void-600 my-1"></div>

              <div className="flex justify-between items-center">
                <span className="text-neon-red font-bold">-1</span>
                <span className="text-gray-400">Absorption</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-neon-red font-bold">-2</span>
                <span className="text-gray-400">Divergence</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-neon-red font-bold">-3</span>
                <span className="text-gray-400">Strong Coherence</span>
              </div>
            </div>
          </div>
        </div>
        <div className={`bg-void-800 border ${getClassificationBorderColor()} rounded-md p-2.5 relative overflow-hidden transition-colors`}>
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-500"></div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-gray-500">Classification</span>
            <div className={`text-base font-bold font-mono ${getClassificationColor()}`}>{last_signal}</div>
          </div>
        </div>
      </div>

      {/* Cumulative Indicators (renamed from Directional Consensus) */}
      <div>
        <h2 className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-3">Cumulative Indicators</h2>

        {/* Individual Values */}
        <div className="grid gap-2">

          {/* v1 - Yellow/Amber (Cumulative Layer) */}
          <div className="bg-void-800 border border-amber-400/20 rounded-md p-2.5 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400"></div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-gray-500">V1 Cumulative</span>
              <div className={`text-base font-bold font-mono ${getValueColor(cumulative_v1)}`}>
                {cumulative_v1}
              </div>
            </div>
          </div>

          {/* v2 - Violet (Weighted Layer) */}
          <div className="bg-void-800 border border-purple-500/20 rounded-md p-2.5 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-purple-500"></div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-gray-500">V2 Weighted</span>
              <div className={`text-base font-bold font-mono ${getValueColor(cumulative_v2)}`}>
                {cumulative_v2}
              </div>
            </div>
          </div>

          {/* v3 - Cyan (Momentum Layer) */}
          <div className="bg-void-800 border border-neon-cyan/20 rounded-md p-2.5 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-neon-cyan"></div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-gray-500">V3 Momentum</span>
              <div className={`text-base font-bold font-mono ${getValueColor(cumulative_v3)}`}>
                {cumulative_v3}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Statistical Patterns (Experimental) */}
      <div>
        <h2 className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-3">Statistical Patterns (Experimental)</h2>

        {/* Order Flow Regime (48h) */}
        {(() => {
          const bias = getMarketBias();
          return (
            <div className="bg-void-800 border border-void-600 rounded-md p-3 mb-3">
              <div className="text-xs text-gray-500 mb-1">Order Flow Regime (48h)</div>
              <div className={`text-sm font-bold ${bias.color} flex items-center justify-center gap-2`}>
                <span>{bias.emoji}</span>
                <span>{bias.label}</span>
              </div>
              {zonesData && zonesData.cumulative_v2 && (
                <div className={`text-[9px] ${getWarningLevel(zonesData.cumulative_v2.n_trades).color} flex items-center gap-1 justify-center mt-2`}>
                  <span>{getWarningLevel(zonesData.cumulative_v2.n_trades).icon}</span>
                  <span>{getWarningLevel(zonesData.cumulative_v2.n_trades).text}</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* V2 Zone */}
        {zonesData?.cumulative_v2 && (() => {
          const v2 = zonesData.cumulative_v2;
          const dir = getDirectionLabel(v2.is_long);
          const warning = getWarningLevel(v2.n_trades);
          return (
            <div className={`bg-void-800 border rounded-md p-3 mb-2 ${dir.bgColor}`}>
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
              {/* Sample warning */}
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
            <div className={`bg-void-800 border rounded-md p-3 ${dir.bgColor}`}>
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
                  <span className={`font-mono font-bold ${(v3.mean_return ?? 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {v3.mean_return !== undefined && v3.mean_return !== null ?
                      `${v3.mean_return > 0 ? '+' : ''}${v3.mean_return.toFixed(2)}%` :
                      'N/A'
                    }
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
              {/* Sample warning */}
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

      {/* System Info */}
      <div className="mt-auto">
        <h2 className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-3">System</h2>
        <div className="bg-void-800 border border-void-600 rounded-md p-3 text-xs text-gray-500 space-y-1 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-neon-cyan to-purple-500"></div>

          <div className="font-sans">
            Total Candles: <span className="text-gray-300 font-mono font-bold">{total_candles}</span>
          </div>

          <div className="font-sans">
            Timeframe: <span className="text-neon-cyan font-mono font-bold">{timeframe}</span>
          </div>

          <div className="font-sans">
            Last Update: <span className="text-gray-300 font-mono font-bold">{last_update}</span>
          </div>

        </div>
      </div>

    </div>
  );
}
