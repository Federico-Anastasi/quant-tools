// ═══════════════════════════════════════════════════════════
// HYPERLIQUID ACCOUNT CARD - Account Info + Position Display
// ═══════════════════════════════════════════════════════════

import React from 'react'

/**
 * HyperliquidAccountCard - Display Hyperliquid account balance, equity, and open position
 * @param {Object} account - Account data from /api/live/account (includes sessionPnl, sessionPnlPct)
 * @param {Object} position - Position data from /api/live/position
 */
function HyperliquidAccountCard({ account, position }) {
  // ────────────────────────────────────────────────────────────
  // DERIVED STATE
  // ────────────────────────────────────────────────────────────

  const hasAccount = account && account.accountValue !== undefined && account.accountValue !== null
  const hasPosition = position && position.has_position === true

  // Calculate derived values
  // Hyperliquid accountValue is the total equity (balance + unrealized P&L)
  const equity = hasAccount ? (account.accountValue ?? 0) : 0
  const unrealizedPnl = hasAccount ? (account.unrealizedPnl ?? 0) : 0

  // Position details
  const positionSide = hasPosition ? position.side : null
  const positionSize = hasPosition ? (position.size ?? 0) : 0
  const entryPrice = hasPosition ? (position.entry_price ?? 0) : 0
  const currentPrice = hasPosition ? (position.current_price ?? 0) : 0
  const tpPrice = hasPosition ? (position.tp_price ?? 0) : 0
  const slPrice = hasPosition ? (position.sl_price ?? 0) : 0
  const positionPnl = hasPosition ? (position.unrealized_pnl ?? 0) : 0
  const positionPnlPct = hasPosition ? (position.pnl_pct ?? 0) : 0

  // Calculate TP/SL distances
  const tpDistance = hasPosition && tpPrice
    ? ((Math.abs(tpPrice - entryPrice) / entryPrice) * 100).toFixed(2)
    : 0
  const slDistance = hasPosition && slPrice
    ? ((Math.abs(slPrice - entryPrice) / entryPrice) * 100).toFixed(2)
    : 0

  // Use session P&L from backend (already calculated from first snapshot)
  const sessionPnl = hasAccount ? (account.sessionPnl ?? 0) : 0
  const sessionPnlPct = hasAccount ? (account.sessionPnlPct ?? 0) : 0

  // ────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────

  return (
    <div className="bg-void-800/50 border border-void-600/50 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-void-600">
        <h3 className="text-sm font-bold text-gray-200 tracking-wide uppercase">Hyperliquid Account</h3>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
          <span className="text-xs text-gray-400">Live</span>
        </div>
      </div>

      {/* Account Metrics */}
      {!hasAccount ? (
        <div className="text-center py-6">
          <div className="text-sm text-gray-500">No account data</div>
        </div>
      ) : (
        <>
          {/* Equity & P&L */}
          <div className="space-y-4 mb-4">
            {/* Equity */}
            <div className="bg-void-900/50 rounded-md p-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Equity</span>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white font-mono">
                    ${equity.toFixed(2)}
                  </div>
                  {account.sessionPnl !== undefined && (
                    <div className={`text-sm ${sessionPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {sessionPnl >= 0 ? '+' : ''}${sessionPnl.toFixed(2)} ({sessionPnl >= 0 ? '+' : ''}{sessionPnlPct.toFixed(2)}%)
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Unrealized P&L (only if position open) */}
            {hasPosition && (
              <div className="bg-void-900/50 rounded-md p-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Unrealized P&L</span>
                  <div className={`text-xl font-bold font-mono ${unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-void-600 my-4" />

          {/* Position Info */}
          {!hasPosition ? (
            <div className="text-center py-4">
              <div className="text-sm text-gray-500">No open position</div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Position Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Position</span>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded text-xs font-bold ${
                    positionSide === 'LONG'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                      : 'bg-red-500/20 text-red-400 border border-red-500/40'
                  }`}>
                    {positionSide}
                  </span>
                  <span className="text-sm font-mono text-white">
                    {positionSize.toFixed(5)} BTC
                  </span>
                </div>
              </div>

              {/* Entry Price */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Entry Price</span>
                <span className="text-sm font-mono text-gray-300">
                  ${entryPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>

              {/* Current Price */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Current Price</span>
                <span className="text-sm font-mono text-white">
                  ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>

              {/* TP */}
              {tpPrice > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Take Profit</span>
                  <div className="text-right">
                    <div className="text-sm font-mono text-green-400">
                      ${tpPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs text-gray-500">
                      ({tpDistance}%)
                    </div>
                  </div>
                </div>
              )}

              {/* SL */}
              {slPrice > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Stop Loss</span>
                  <div className="text-right">
                    <div className="text-sm font-mono text-red-400">
                      ${slPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs text-gray-500">
                      ({slDistance}%)
                    </div>
                  </div>
                </div>
              )}

              {/* Position P&L */}
              <div className="bg-void-900/50 rounded-md p-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Position P&L</span>
                  <div className="text-right">
                    <div className={`text-lg font-bold font-mono ${positionPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {positionPnl >= 0 ? '+' : ''}${positionPnl.toFixed(2)}
                    </div>
                    <div className={`text-xs ${positionPnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ({positionPnlPct >= 0 ? '+' : ''}{positionPnlPct.toFixed(2)}%)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default HyperliquidAccountCard
