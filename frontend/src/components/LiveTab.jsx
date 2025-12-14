// ═══════════════════════════════════════════════════════════
// LIVE TRADING TAB - Hyperliquid V3 Momentum Strategy
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import LiveChart from './LiveChart'
import HyperliquidAccountCard from './HyperliquidAccountCard'
import V3SignalsCard from './V3SignalsCard'
import LiveTradesTable from './LiveTradesTable'

const API_URL = import.meta.env.VITE_API_URL || ''

/**
 * LiveTab - Main container for live trading dashboard
 * Polls live account, position, trades data every 5 seconds
 * Displays charts, account info, signals, and trade history
 *
 * @param {Object} candlesData - Candles data from Dashboard (shared, no need to fetch)
 * @param {Object} zonesData - Zones data from Dashboard (shared, no need to fetch)
 */
function LiveTab({ candlesData, zonesData }) {
  // ────────────────────────────────────────────────────────────
  // STATE
  // ────────────────────────────────────────────────────────────

  const [liveAccount, setLiveAccount] = useState(null)
  const [livePosition, setLivePosition] = useState(null)
  const [liveTrades, setLiveTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const lastUpdateRef = useRef(Date.now())

  // ────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ────────────────────────────────────────────────────────────

  /**
   * Fetch Hyperliquid account info (balance, equity, margin)
   */
  const fetchLiveAccount = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/live/account`)
      setLiveAccount(response.data)
    } catch (err) {
      console.error('[LiveTab] Error fetching account:', err)
      // Don't set error state - allow other requests to continue
    }
  }

  /**
   * Fetch current open position on Hyperliquid
   */
  const fetchLivePosition = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/live/position`)
      setLivePosition(response.data)
    } catch (err) {
      console.error('[LiveTab] Error fetching position:', err)
    }
  }

  /**
   * Fetch live trades history
   */
  const fetchLiveTrades = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/live/trades`, {
        params: { limit: 50 }
      })
      setLiveTrades(response.data.trades || [])
    } catch (err) {
      console.error('[LiveTab] Error fetching trades:', err)
    }
  }

  /**
   * Fetch live-specific data (NOT candles/zones - those come from Dashboard props)
   */
  const fetchLiveData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Parallel fetches (only live-specific data)
      await Promise.all([
        fetchLiveAccount(),
        fetchLivePosition(),
        fetchLiveTrades()
      ])

      lastUpdateRef.current = Date.now()
    } catch (err) {
      console.error('[LiveTab] Error fetching live data:', err)
      setError('Failed to load live data')
    } finally {
      setLoading(false)
    }
  }

  // ────────────────────────────────────────────────────────────
  // DATA ADAPTER (CVDChart format)
  // ────────────────────────────────────────────────────────────

  /**
   * Convert API candles to CVDChart format
   */
  const adaptDataForChart = (apiResponse) => {
    if (!apiResponse || !apiResponse.candles || apiResponse.candles.length === 0) {
      return null
    }

    const candles = apiResponse.candles
    const count = candles.length

    const timestamps = []
    const price_open = []
    const price_high = []
    const price_low = []
    const price_close = []
    const volume_buy = []
    const volume_sell = []
    const cumulative_v3 = []

    for (let i = 0; i < count; i++) {
      const c = candles[i]
      timestamps.push(c.timestamp)
      price_open.push(c.price_open)
      price_high.push(c.price_high)
      price_low.push(c.price_low)
      price_close.push(c.price_close)
      volume_buy.push(c.volume_buy)
      volume_sell.push(c.volume_sell)
      cumulative_v3.push(c.cumulative_v3 || 0)
    }

    return {
      price_ohlc: {
        index: timestamps,
        data: {
          open: price_open,
          high: price_high,
          low: price_low,
          close: price_close
        }
      },
      vol_buy: {
        index: timestamps,
        values: volume_buy
      },
      vol_sell: {
        index: timestamps,
        values: volume_sell
      },
      momentum_v3_segments: [{
        index: timestamps,
        values: cumulative_v3
      }]
    }
  }

  // ────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ────────────────────────────────────────────────────────────

  useEffect(() => {
    // Initial load (only live-specific data)
    fetchLiveData()

    // Refresh every 10 seconds (reduced from 5s - live account/position don't change that fast)
    const interval = setInterval(() => {
      fetchLiveData()
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  // ────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────

  const chartData = candlesData ? adaptDataForChart(candlesData) : null

  // Get current V3 value and zone info
  const currentCandle = candlesData?.candles?.[candlesData.candles.length - 1] || null
  const currentV3 = currentCandle?.cumulative_v3 ?? 0
  const v3Zone = zonesData?.cumulative_v3 ?? null

  if (loading && !chartData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-void-600 border-t-neon-cyan rounded-full animate-spin mx-auto mb-3" />
          <div className="text-sm text-gray-400">Loading live trading data...</div>
        </div>
      </div>
    )
  }

  if (error && !chartData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-void-800 border border-neon-red p-6 rounded-lg max-w-md">
          <h3 className="text-neon-red font-bold mb-2">Error Loading Live Data</h3>
          <p className="text-gray-400 text-sm">{error}</p>
          <button
            onClick={fetchLiveData}
            className="mt-4 bg-void-700 hover:bg-void-600 border border-void-500 px-4 py-2 rounded text-sm transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-3 h-full p-3">
      {/* Left: Charts (70% width on desktop) */}
      <div className="flex-1 lg:w-[70%] flex flex-col gap-3">
        {/* Main Chart */}
        <div className="flex-1 bg-void-800/50 border border-void-600/50 rounded-lg relative min-h-[600px] overflow-hidden">
          {chartData ? (
            <LiveChart
              data={chartData}
              zonesData={zonesData}
              position={livePosition}
              trades={liveTrades}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-gray-400">No chart data available</div>
            </div>
          )}
        </div>

        {/* Live Trades Table (Bottom) */}
        <div className="bg-void-800/50 border border-void-600/50 rounded-lg p-4 max-h-[300px] overflow-auto">
          <LiveTradesTable trades={liveTrades} />
        </div>
      </div>

      {/* Right: Cards (30% width on desktop) */}
      <aside className="w-full lg:w-[30%] flex flex-col gap-3">
        {/* Hyperliquid Account Card */}
        <HyperliquidAccountCard
          account={liveAccount}
          position={livePosition}
        />

        {/* V3 Signals Card */}
        <V3SignalsCard
          currentV3={currentV3}
          v3Zone={v3Zone}
          currentCandle={currentCandle}
        />
      </aside>
    </div>
  )
}

export default LiveTab
