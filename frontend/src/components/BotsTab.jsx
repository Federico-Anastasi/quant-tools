import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BotCard from './BotCard';
import TradeHistoryModal from './TradeHistoryModal';
import EquityComparisonChart from './EquityComparisonChart';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * BotsTab - Professional bot leaderboard and management interface
 * Premium UX/UI consistent with PsiQuant design system
 */
function BotsTab() {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBot, setSelectedBot] = useState(null);  // For trade history modal
  const [trades, setTrades] = useState([]);
  const [equityCurves, setEquityCurves] = useState({});  // bot_id -> equity data

  // Fetch all bots data
  const fetchBots = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${API_URL}/api/bots`);
      console.log('[BotsTab] Fetched bots:', response.data);

      setBots(response.data.bots || []);

    } catch (err) {
      console.error('[BotsTab] Error fetching bots:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch equity curve for a bot
  const fetchEquityCurve = async (botId) => {
    try {
      const response = await axios.get(`${API_URL}/api/bots/${botId}/equity?limit=10000`);
      console.log(`[BotsTab] Fetched equity for bot ${botId}:`, response.data);

      setEquityCurves(prev => ({
        ...prev,
        [botId]: response.data.snapshots || []
      }));

    } catch (err) {
      console.error(`[BotsTab] Error fetching equity for bot ${botId}:`, err);
    }
  };

  // Fetch trade history for a bot
  const fetchBotTrades = async (botId) => {
    try {
      const response = await axios.get(`${API_URL}/api/bots/${botId}/trades`);
      console.log(`[BotsTab] Fetched trades for bot ${botId}:`, response.data);

      setTrades(response.data.trades || []);

    } catch (err) {
      console.error(`[BotsTab] Error fetching trades for bot ${botId}:`, err);
      setTrades([]);
    }
  };

  // Handle bot card click - show trade history modal
  const handleBotClick = async (bot) => {
    setSelectedBot(bot);
    await fetchBotTrades(bot.id);
  };

  // Close modal
  const handleCloseModal = () => {
    setSelectedBot(null);
    setTrades([]);
  };

  // Lifecycle - initial fetch
  useEffect(() => {
    fetchBots();

    // Refresh bots AND equity curves every 10 seconds
    const interval = setInterval(() => {
      fetchBots();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Separate effect to fetch equity curves when bots change OR every 10 seconds
  useEffect(() => {
    if (bots.length === 0) return;

    // Initial fetch
    bots.forEach(bot => {
      fetchEquityCurve(bot.id);
    });

    // Refresh equity every 10 seconds
    const interval = setInterval(() => {
      bots.forEach(bot => {
        fetchEquityCurve(bot.id);
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [bots.map(b => b.id).join(',')]);

  // Fetch equity curves for all bots after initial load
  useEffect(() => {
    if (bots.length > 0) {
      bots.forEach(bot => {
        if (!equityCurves[bot.id]) {
          fetchEquityCurve(bot.id);
        }
      });
    }
  }, [bots]);

  // Sort bots by P&L percentage (descending)
  const sortedBots = [...bots].sort((a, b) => (b.total_pnl_pct || 0) - (a.total_pnl_pct || 0));

  // Render loading state
  if (loading && bots.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-void-600 border-t-neon-cyan rounded-full animate-spin mx-auto mb-3" />
          <div className="text-sm text-gray-400">Loading bots...</div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && bots.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-void-800 border border-neon-red p-6 rounded-lg max-w-md">
          <h3 className="text-neon-red font-bold mb-2">Error Loading Bots</h3>
          <p className="text-gray-400 text-sm">{error}</p>
          <button
            onClick={fetchBots}
            className="mt-4 bg-void-700 hover:bg-void-600 border border-void-500 px-4 py-2 rounded text-sm transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-void-900 overflow-y-auto">
      <div className="p-4">
        {/* Disclaimer Banner */}
        <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-amber-400 mb-1">Paper Trading Simulation - Experimental Phase</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                This is a live paper trading simulation with virtual funds only. No real orders are executed, and no actual accounts are involved.
                This is a faithful simulation in experimental phase. Do not use as the sole reference for trading decisions. The statistical data collected is not yet sufficient to prove a relevant edge.
              </p>
            </div>
          </div>
        </div>

        {/* Equity Comparison Chart */}
        {sortedBots.length > 0 && (
          <EquityComparisonChart
            bots={sortedBots}
            equityCurves={equityCurves}
          />
        )}

        {/* Bots Grid */}
        {sortedBots.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500">No bots found</p>
              <p className="text-xs text-gray-600 mt-1">Run the backfill to generate bot data</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
            {sortedBots.map((bot, index) => (
              <BotCard
                key={bot.id}
                bot={bot}
                rank={index + 1}
                equityCurve={equityCurves[bot.id] || []}
                onClick={() => handleBotClick(bot)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Trade History Modal */}
      {selectedBot && (
        <TradeHistoryModal
          bot={selectedBot}
          trades={trades}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

export default BotsTab;
