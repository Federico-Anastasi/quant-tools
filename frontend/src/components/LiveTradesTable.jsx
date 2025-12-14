// ═══════════════════════════════════════════════════════════
// LIVE TRADES TABLE - History of live trading operations
// ═══════════════════════════════════════════════════════════

import React from 'react'

/**
 * LiveTradesTable - Display live trades history
 * @param {Array} trades - Trades from /api/live/trades
 */
function LiveTradesTable({ trades = [] }) {
  // ────────────────────────────────────────────────────────────
  // HELPERS
  // ────────────────────────────────────────────────────────────

  /**
   * Format timestamp to readable date/time
   */
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '--'
    const date = new Date(timestamp)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${month}/${day} ${hours}:${minutes}:${seconds}`
  }

  /**
   * Format price with commas
   */
  const formatPrice = (price) => {
    if (price === null || price === undefined) return '--'
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  }

  /**
   * Calculate P&L (realized or unrealized)
   */
  const calculatePnl = (trade) => {
    // Prefer realized_pnl for closed trades
    if (trade.status === 'closed' && trade.realized_pnl !== null) {
      return trade.realized_pnl
    }
    // Fallback to unrealized_pnl for open trades
    if (trade.unrealized_pnl !== null) {
      return trade.unrealized_pnl
    }
    // Calculate manually if not available
    if (trade.exit_price && trade.entry_price && trade.size) {
      const priceDiff = trade.side === 'LONG'
        ? trade.exit_price - trade.entry_price
        : trade.entry_price - trade.exit_price
      return priceDiff * trade.size
    }
    return null
  }

  // ────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────

  if (!trades || trades.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-sm text-gray-500">No live trades yet</div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      {/* Table Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-200 tracking-wide uppercase">Live Trades History</h3>
        <span className="text-xs text-gray-500">{trades.length} trades</span>
      </div>

      {/* Table */}
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-void-600">
            <th className="text-left py-2 px-2 text-gray-400 font-medium">#</th>
            <th className="text-left py-2 px-2 text-gray-400 font-medium">Entry Time</th>
            <th className="text-left py-2 px-2 text-gray-400 font-medium">Exit Time</th>
            <th className="text-center py-2 px-2 text-gray-400 font-medium">Direction</th>
            <th className="text-right py-2 px-2 text-gray-400 font-medium">Entry $</th>
            <th className="text-right py-2 px-2 text-gray-400 font-medium">Exit $</th>
            <th className="text-right py-2 px-2 text-gray-400 font-medium">Size</th>
            <th className="text-right py-2 px-2 text-gray-400 font-medium">P&L</th>
            <th className="text-center py-2 px-2 text-gray-400 font-medium">Status</th>
            <th className="text-center py-2 px-2 text-gray-400 font-medium">Exit Type</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade, index) => {
            const pnl = calculatePnl(trade)
            const isOpen = trade.status === 'open'
            const isProfit = pnl !== null && pnl >= 0

            return (
              <tr
                key={trade.id || index}
                className={`border-b border-void-700/50 hover:bg-void-700/30 transition-colors ${
                  isOpen ? 'bg-amber-500/5' : ''
                }`}
              >
                {/* # */}
                <td className="py-2 px-2 text-gray-300 font-mono">
                  {index + 1}
                </td>

                {/* Entry Time */}
                <td className="py-2 px-2 text-gray-300 font-mono">
                  {formatTimestamp(trade.entry_time)}
                </td>

                {/* Exit Time */}
                <td className="py-2 px-2 text-gray-300 font-mono">
                  {trade.exit_time ? formatTimestamp(trade.exit_time) : (
                    <span className="text-amber-400">--</span>
                  )}
                </td>

                {/* Direction */}
                <td className="py-2 px-2 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    trade.side === 'LONG'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {trade.side}
                  </span>
                </td>

                {/* Entry Price */}
                <td className="py-2 px-2 text-right text-gray-300 font-mono">
                  {formatPrice(trade.entry_price)}
                </td>

                {/* Exit Price */}
                <td className="py-2 px-2 text-right text-gray-300 font-mono">
                  {trade.exit_price ? formatPrice(trade.exit_price) : (
                    <span className="text-gray-500">--</span>
                  )}
                </td>

                {/* Size */}
                <td className="py-2 px-2 text-right text-gray-300 font-mono">
                  {trade.size ? trade.size.toFixed(5) : '--'} BTC
                </td>

                {/* P&L */}
                <td className="py-2 px-2 text-right font-mono">
                  {pnl !== null ? (
                    <span className={`font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                      {isProfit ? '+' : ''}${pnl.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-gray-500">--</span>
                  )}
                </td>

                {/* Status */}
                <td className="py-2 px-2 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                    trade.status === 'open'
                      ? 'bg-amber-500/20 text-amber-400'
                      : trade.status === 'closed'
                      ? 'bg-gray-500/20 text-gray-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {trade.status}
                  </span>
                </td>

                {/* Exit Type */}
                <td className="py-2 px-2 text-center">
                  {trade.exit_type ? (
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      trade.exit_type === 'TP'
                        ? 'bg-green-500/20 text-green-400'
                        : trade.exit_type === 'SL'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {trade.exit_type}
                    </span>
                  ) : (
                    <span className="text-gray-500">--</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default LiveTradesTable
