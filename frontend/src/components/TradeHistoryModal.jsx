import React from 'react';

/**
 * TradeHistoryModal - Premium modal for displaying bot trade history
 * Professional data grid with PsiQuant design system
 * @param {Object} props - Component props
 * @param {Object} props.bot - Bot data
 * @param {Array} props.trades - Array of trade objects
 * @param {function} props.onClose - Close handler
 */
function TradeHistoryModal({ bot, trades = [], onClose = () => {} }) {
  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '--';
    const date = new Date(timestamp);
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month} ${day}, ${hours}:${minutes}`;
  };

  // Format P&L with color
  const formatPnL = (pnl, pnlPct) => {
    const value = pnl || 0;
    const pct = pnlPct || 0;
    const color = value >= 0 ? 'text-neon-cyan' : 'text-neon-red';
    const sign = value >= 0 ? '+' : '';
    return (
      <span className={`font-bold ${color}`}>
        {sign}${value.toFixed(2)} ({sign}{pct.toFixed(2)}%)
      </span>
    );
  };

  // Exit type badge
  const getExitBadge = (exitType) => {
    if (exitType === 'TP') return { bg: 'bg-neon-cyan/20', text: 'text-neon-cyan', label: 'TP' };
    if (exitType === 'SL') return { bg: 'bg-neon-red/20', text: 'text-neon-red', label: 'SL' };
    return { bg: 'bg-gray-600/20', text: 'text-gray-400', label: '--' };
  };

  // Calculate summary stats
  const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const avgPnL = trades.length > 0 ? totalPnL / trades.length : 0;
  const avgHoldTime = trades.length > 0
    ? trades.reduce((sum, t) => sum + (t.candles_held || 0), 0) / trades.length
    : 0;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-void-900 border border-void-600 rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-void-600">
          <div>
            <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
              <svg className="w-5 h-5 text-neon-cyan" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
              {bot.name} - Trade History
            </h2>
            <p className="text-xs text-gray-500 mt-1">{trades.length} total trades</p>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 p-4 border-b border-void-600 bg-void-800/50">
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Total P&L</div>
            <div className={`text-lg font-bold ${totalPnL >= 0 ? 'text-neon-cyan' : 'text-neon-red'}`}>
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Avg P&L</div>
            <div className={`text-lg font-bold ${avgPnL >= 0 ? 'text-neon-cyan' : 'text-neon-red'}`}>
              {avgPnL >= 0 ? '+' : ''}${avgPnL.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Avg Hold Time</div>
            <div className="text-lg font-bold text-gray-300">
              {avgHoldTime.toFixed(1)} candles
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Win Rate</div>
            <div className="text-lg font-bold text-gray-300">
              {(bot.win_rate || 0).toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Trade Grid */}
        <div className="flex-1 overflow-auto p-4">
          {trades.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500">No trades yet</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-void-600">
                    <th className="text-left py-2 px-3 text-gray-500 font-bold uppercase tracking-wider">#</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-bold uppercase tracking-wider">Entry Time</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-bold uppercase tracking-wider">Exit Time</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-bold uppercase tracking-wider">Direction</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-bold uppercase tracking-wider">Entry Price</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-bold uppercase tracking-wider">Exit Price</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-bold uppercase tracking-wider">Capital</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-bold uppercase tracking-wider">P&L</th>
                    <th className="text-center py-2 px-3 text-gray-500 font-bold uppercase tracking-wider">Hold</th>
                    <th className="text-center py-2 px-3 text-gray-500 font-bold uppercase tracking-wider">Exit</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade, index) => {
                    const exitBadge = getExitBadge(trade.exit_type);
                    return (
                      <tr
                        key={trade.id}
                        className="border-b border-void-700/50 hover:bg-void-800/30 transition-colors"
                      >
                        <td className="py-2 px-3 text-gray-400 font-mono">{index + 1}</td>
                        <td className="py-2 px-3 text-gray-300">{formatTimestamp(trade.entry_timestamp)}</td>
                        <td className="py-2 px-3 text-gray-300">{formatTimestamp(trade.exit_timestamp)}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            trade.direction === 'LONG'
                              ? 'bg-neon-cyan/20 text-neon-cyan'
                              : 'bg-neon-red/20 text-neon-red'
                          }`}>
                            {trade.direction}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-gray-300 font-mono">
                          ${trade.entry_price ? parseFloat(trade.entry_price).toFixed(2) : '--'}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-300 font-mono">
                          ${trade.exit_price ? parseFloat(trade.exit_price).toFixed(2) : '--'}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-300 font-mono">
                          ${trade.capital_allocated ? parseFloat(trade.capital_allocated).toFixed(2) : '--'}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {formatPnL(trade.pnl, trade.pnl_pct)}
                        </td>
                        <td className="py-2 px-3 text-center text-gray-400 font-mono">
                          {trade.candles_held || 0}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${exitBadge.bg} ${exitBadge.text}`}>
                            {exitBadge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-void-600 flex justify-end">
          <button
            onClick={onClose}
            className="bg-void-700 hover:bg-void-600 border border-void-600 hover:border-neon-cyan/30 text-gray-300 hover:text-neon-cyan px-4 py-2 rounded text-sm font-bold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default TradeHistoryModal;
