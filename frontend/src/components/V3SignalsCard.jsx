// ═══════════════════════════════════════════════════════════
// V3 SIGNALS CARD - V3 Momentum Signals Display
// ═══════════════════════════════════════════════════════════

import React from 'react'

/**
 * V3SignalsCard - Display V3 Momentum signals and current zone info
 * @param {Number} currentV3 - Current V3 momentum value
 * @param {Object} v3Zone - V3 zone data from /api/order-flow-zones
 * @param {Object} currentCandle - Latest candle data
 */
function V3SignalsCard({ currentV3 = 0, v3Zone, currentCandle }) {
  // ────────────────────────────────────────────────────────────
  // DERIVED STATE
  // ────────────────────────────────────────────────────────────

  const hasZone = v3Zone &&
                  v3Zone.zone_min !== undefined &&
                  v3Zone.zone_min !== null &&
                  v3Zone.zone_max !== undefined &&
                  v3Zone.zone_max !== null

  // Zone data
  const zoneMin = hasZone ? v3Zone.zone_min : 0
  const zoneMax = hasZone ? v3Zone.zone_max : 0
  const isLongZone = hasZone ? v3Zone.is_long : false
  const tpPct = hasZone ? (v3Zone.tp_pct ?? 0) : 0
  const slPct = hasZone ? (v3Zone.sl_pct ?? 0) : 0
  const nTrades = hasZone ? (v3Zone.n_trades ?? 0) : 0

  // Calculate classification (-1, 0, 1)
  let classification = 0
  let classificationLabel = 'NEUTRAL'
  let classificationColor = 'text-gray-400'

  if (hasZone) {
    // Check if V3 is in primary zone
    const v3InZone = currentV3 >= zoneMin && currentV3 <= zoneMax
    // Check if V3 is in symmetric (opposite) zone
    const v3InOpposite = currentV3 >= -zoneMax && currentV3 <= -zoneMin

    if (v3InZone) {
      classification = isLongZone ? 1 : -1
      classificationLabel = isLongZone ? 'LONG' : 'SHORT'
      classificationColor = isLongZone ? 'text-green-400' : 'text-red-400'
    } else if (v3InOpposite) {
      classification = isLongZone ? -1 : 1
      classificationLabel = isLongZone ? 'SHORT' : 'LONG'
      classificationColor = isLongZone ? 'text-red-400' : 'text-green-400'
    }
  }

  // ────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────

  return (
    <div className="bg-void-800/50 border border-void-600/50 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-void-600">
        <h3 className="text-sm font-bold text-gray-200 tracking-wide uppercase">V3 Momentum Signals</h3>
        <div className="px-2 py-1 rounded text-xs font-mono bg-amber-500/20 text-amber-400 border border-amber-500/40">
          V3
        </div>
      </div>

      {/* V3 Value */}
      <div className="space-y-3 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">V3 Value</span>
          <span className={`text-xl font-bold font-mono ${currentV3 >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {currentV3.toFixed(2)}
          </span>
        </div>

        {/* Classification Badge */}
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">Classification</span>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded text-xs font-bold ${
              classification === 1
                ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                : classification === -1
                ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                : 'bg-gray-500/20 text-gray-400 border border-gray-500/40'
            }`}>
              {classificationLabel}
            </span>
            <span className={`text-sm font-bold font-mono ${classificationColor}`}>
              {classification > 0 ? '+' : ''}{classification}
            </span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-void-600 my-4" />

      {/* Zone Info */}
      {!hasZone ? (
        <div className="text-center py-4">
          <div className="text-sm text-gray-500">No zone data available</div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Zone Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Current V3 Zone</span>
            <span className={`px-2 py-1 rounded text-xs font-bold ${
              isLongZone
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {isLongZone ? 'LONG Zone' : 'SHORT Zone'}
            </span>
          </div>

          {/* Zone Range */}
          <div className="bg-void-900/50 rounded-md p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-400">Zone Range</span>
              <div className="text-right">
                <div className="text-sm font-mono text-white">
                  {zoneMin.toFixed(2)} → {zoneMax.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">
                  (Δ {(zoneMax - zoneMin).toFixed(2)})
                </div>
              </div>
            </div>
          </div>

          {/* Direction Indicator */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Zone Direction</span>
            <span className={`text-sm font-bold ${isLongZone ? 'text-green-400' : 'text-red-400'}`}>
              {isLongZone ? '↑ LONG' : '↓ SHORT'}
            </span>
          </div>

          {/* TP Target */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">TP Target</span>
            <span className="text-sm font-mono text-green-400">
              +{tpPct.toFixed(2)}%
            </span>
          </div>

          {/* SL Distance */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">SL Distance</span>
            <span className="text-sm font-mono text-red-400">
              -{slPct.toFixed(2)}%
            </span>
          </div>

          {/* Trades in Zone */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Trades in Zone</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-gray-300">
                {nTrades}
              </span>
              {nTrades >= 10 ? (
                <span className="text-xs text-green-400">✓ Valid</span>
              ) : (
                <span className="text-xs text-amber-400">⚠ Low sample</span>
              )}
            </div>
          </div>

          {/* Zone Quality Indicator */}
          <div className="bg-void-900/50 rounded-md p-3 mt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Zone Quality</span>
              <div className="flex items-center gap-2">
                {/* Quality bars */}
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((bar) => {
                    const threshold = bar * 10
                    const isActive = nTrades >= threshold
                    return (
                      <div
                        key={bar}
                        className={`w-1.5 h-4 rounded-sm ${
                          isActive
                            ? nTrades >= 50
                              ? 'bg-green-400'
                              : nTrades >= 30
                              ? 'bg-amber-400'
                              : 'bg-gray-400'
                            : 'bg-void-700'
                        }`}
                      />
                    )
                  })}
                </div>
                <span className="text-xs text-gray-400">
                  {nTrades >= 50 ? 'High' : nTrades >= 30 ? 'Medium' : nTrades >= 10 ? 'Low' : 'Very Low'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default V3SignalsCard
