/**
 * P&L Calculator - Shared utility for trade profit/loss calculations
 *
 * Used by:
 * - BacktestTab.jsx (manual backtest trading)
 * - TradePanel.jsx (unrealized P&L display)
 */

/**
 * Calculate trade P&L with fees
 *
 * @param {number} entry - Entry price
 * @param {number} exit - Exit price
 * @param {string} direction - 'long' or 'short'
 * @param {number} size - Position size in USD
 * @param {number} leverage - Leverage multiplier
 * @param {number} fees - Fee percentage (e.g., 0.04 for 0.04%)
 * @returns {Object} { gross, fees, net } - P&L breakdown
 */
export const calculatePnL = (entry, exit, direction, size, leverage, fees) => {
  // Calculate raw P&L percentage
  const rawPnl = direction === 'long'
    ? (exit - entry) / entry * 100
    : (entry - exit) / entry * 100;

  // Apply leverage to P&L
  const leveragedPnl = (rawPnl * leverage / 100) * size;

  // Calculate entry and exit fees
  const entryFee = (size * leverage) * (fees / 100);
  const exitFee = (size * leverage) * (fees / 100);
  const totalFees = entryFee + exitFee;

  // Net P&L after fees
  const netPnl = leveragedPnl - totalFees;

  return {
    gross: leveragedPnl,
    fees: totalFees,
    net: netPnl
  };
};
