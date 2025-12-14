import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import CVDChart from '../components/CVDChart'
import LOBChart from '../components/LOBChart'
import BotsTab from '../components/BotsTab'
import BacktestTab from '../components/BacktestTab'
import LiveTab from '../components/LiveTab'
import IndicatorsPanel from '../components/IndicatorsPanel'
import Header from '../components/Header'
import Footer from '../components/Footer'
import AboutModal from '../components/AboutModal'
import { useRequestCache } from '../hooks/useRequestCache'

const API_URL = import.meta.env.VITE_API_URL || ''  // Empty = same origin via Nginx proxy

export default function Dashboard() {
  const cachedRequest = useRequestCache()

  const [candlesData, setCandlesData] = useState(null)
  const [lobData, setLobData] = useState(null)
  const [zonesData, setZonesData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [activeTab, setActiveTab] = useState('cvd')  // CVD tab by default
  const [sidebarOpen, setSidebarOpen] = useState(false)  // Mobile sidebar toggle
  const [showAboutModal, setShowAboutModal] = useState(false)  // About modal state
  const [kpis, setKpis] = useState({
    current_price: '--',
    cvd_net: '--',
    trades_per_min: '--',
    last_signal: '--',
    cumulative_v1: '--',
    cumulative_v2: '--',
    cumulative_v3: '--'
  })
  const [systemInfo, setSystemInfo] = useState({
    total_candles: '0',
    timeframe: '3 min',
    last_update: '--'
  })
  const [uptime, setUptime] = useState('--')
  const [priceBin, setPriceBin] = useState(50)  // LOB bin size (fixed at 50 for cache optimization)

  const startTimeRef = useRef(Date.now())
  const lastUpdateRef = useRef(Date.now())

  // ────────────────────────────────────────────────────────────
  // DATA ADAPTER: Convert API response to CVDChart format
  // ────────────────────────────────────────────────────────────

  /**
   * Convert flat candles array from API to nested structure for CVDChart
   * API format: [{ price_open, price_high, price_low, price_close, cvd_open, ... }]
   * CVDChart format: { price_ohlc: { index: [...], data: { open: [...], high: [...], ... } }, ... }
   */
  const adaptDataForChart = (apiResponse) => {
    if (!apiResponse || !apiResponse.candles || apiResponse.candles.length === 0) {
      return null
    }

    const candles = apiResponse.candles
    const count = candles.length

    // Extract all arrays
    const timestamps = []
    const price_open = []
    const price_high = []
    const price_low = []
    const price_close = []
    const cvd_open = []
    const cvd_high = []
    const cvd_low = []
    const cvd_close = []
    const volume_buy = []
    const volume_sell = []
    const efficiency_ratio = []
    const signals = []
    const signal_quality = []
    const weighted_cumulative_v2 = []
    const momentum_v3 = []
    const cumulative_signals = []

    for (let i = 0; i < count; i++) {
      const c = candles[i]
      timestamps.push(c.timestamp)
      price_open.push(c.price_open)
      price_high.push(c.price_high)
      price_low.push(c.price_low)
      price_close.push(c.price_close)
      cvd_open.push(c.cvd_open)
      cvd_high.push(c.cvd_high)
      cvd_low.push(c.cvd_low)
      cvd_close.push(c.cvd_close)
      volume_buy.push(c.volume_buy)
      volume_sell.push(c.volume_sell)
      efficiency_ratio.push(c.efficiency_ratio)
      signals.push(c.signal)
      signal_quality.push(c.signal_quality || 0)
      weighted_cumulative_v2.push(c.cumulative_v2 || 0)  // Backend field: cumulative_v2
      momentum_v3.push(c.cumulative_v3 || 0)  // Backend field: cumulative_v3
      cumulative_signals.push(c.cumulative_v1 || 0)  // Backend field: cumulative_v1
    }

    // Build cumulative segments structure
    const cumulative_segments = [{
      index: timestamps,
      values: cumulative_signals
    }]

    // Build weighted cumulative segments (v2)
    const weighted_cumulative_segments = [{
      index: timestamps,
      values: weighted_cumulative_v2
    }]

    // Build momentum v3 segments
    const momentum_v3_segments = [{
      index: timestamps,
      values: momentum_v3
    }]

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
      cvd_ohlc: {
        index: timestamps,
        data: {
          open: cvd_open,
          high: cvd_high,
          low: cvd_low,
          close: cvd_close
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
      ratio: {
        index: timestamps,
        values: efficiency_ratio
      },
      signals: {
        index: timestamps,
        values: signals
      },
      cumulative_segments: cumulative_segments,
      // v2 signal fields
      signal_quality: {
        index: timestamps,
        values: signal_quality
      },
      weighted_cumulative_segments: weighted_cumulative_segments,
      // v3 signal fields
      momentum_v3_segments: momentum_v3_segments
    }
  }

  // ────────────────────────────────────────────────────────────
  // KPI CALCULATION
  // ────────────────────────────────────────────────────────────

  /**
   * Calculate KPIs from candle data
   */
  const calculateKPIs = (apiResponse) => {
    if (!apiResponse || !apiResponse.candles || apiResponse.candles.length === 0) {
      return {
        current_price: '--',
        cvd_net: '--',
        trades_per_min: '--',
        last_signal: '--',
        signal_quality: '--',
        weighted_cumulative_v2: '--',
        momentum_v3: '--'
      }
    }

    const candles = apiResponse.candles
    const lastCandle = candles[candles.length - 1]

    // Current Price
    const current_price = `$${lastCandle.price_close.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })}`

    // CVD Net (last CVD close value)
    const cvd_net = lastCandle.cvd_close.toFixed(2)

    // Trades/Min (estimate from volume)
    // Since we have 3-minute candles, divide total volume by 3
    const total_volume = lastCandle.volume_buy + lastCandle.volume_sell
    const trades_per_min = (total_volume / 3).toFixed(1)

    // Last Signal (from signal field) - Updated nomenclature
    let last_signal = '--'
    if (lastCandle.signal !== 0 && lastCandle.signal !== null && lastCandle.signal !== undefined) {
      const sig = lastCandle.signal
      const absVal = Math.abs(sig)
      const sign = sig > 0 ? '+' : ''

      let label = ''
      if (absVal === 3) label = 'Strong Coherence'
      else if (absVal === 2) label = 'Divergence'
      else if (absVal === 1) label = 'Absorption'

      last_signal = `${sign}${sig} ${label}`
    }

    // Cumulative values (v1, v2, v3)
    const cumulative_v1 = lastCandle.cumulative_v1 !== null && lastCandle.cumulative_v1 !== undefined
      ? lastCandle.cumulative_v1.toFixed(2)
      : '--'

    const cumulative_v2 = lastCandle.cumulative_v2 !== null && lastCandle.cumulative_v2 !== undefined
      ? lastCandle.cumulative_v2.toFixed(2)
      : '--'

    const cumulative_v3 = lastCandle.cumulative_v3 !== null && lastCandle.cumulative_v3 !== undefined
      ? lastCandle.cumulative_v3.toFixed(2)
      : '--'

    return {
      current_price,
      cvd_net,
      trades_per_min,
      last_signal,
      cumulative_v1,
      cumulative_v2,
      cumulative_v3
    }
  }

  // ────────────────────────────────────────────────────────────
  // UPTIME CALCULATION
  // ────────────────────────────────────────────────────────────

  const calculateUptime = () => {
    const elapsed = Date.now() - startTimeRef.current
    const seconds = Math.floor(elapsed / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  // ────────────────────────────────────────────────────────────
  // LAST UPDATE CALCULATION
  // ────────────────────────────────────────────────────────────

  const calculateLastUpdate = () => {
    const elapsed = Date.now() - lastUpdateRef.current
    const seconds = Math.floor(elapsed / 1000)

    if (seconds < 5) return 'just now'
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  // ────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ────────────────────────────────────────────────────────────

  const fetchCandles = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await cachedRequest('candles', () =>
        axios.get(`${API_URL}/api/candles`, {
          params: { hours: 24, limit: 1000 }
        })
      )

      // Update raw data
      setCandlesData(response.data)

      // Calculate KPIs
      const newKpis = calculateKPIs(response.data)
      setKpis(newKpis)

      // Update system info
      setSystemInfo({
        total_candles: response.data.total_candles.toString(),
        timeframe: '3 min',
        last_update: 'just now'
      })

      // Update connection status
      setConnectionStatus('connected')

      // Update last update time
      lastUpdateRef.current = Date.now()

    } catch (err) {
      console.error('[Dashboard] Error fetching candles:', err)
      setError(err.message)
      setConnectionStatus('error')
    } finally {
      setLoading(false)
    }
  }

  const fetchLOBDensity = async () => {
    try {
      const response = await cachedRequest(`lob-density-${priceBin}`, () =>
        axios.get(`${API_URL}/api/lob-density`, {
          params: {
            symbol: 'BTC',
            hours: 720,           // Fixed 30 days
            price_bin: priceBin   // User-controlled bin size
          }
        })
      )

      setLobData(response.data)

    } catch (err) {
      console.error('[Dashboard] Error fetching LOB density:', err)
    }
  }

  const fetchOrderFlowZones = async () => {
    try {
      const response = await cachedRequest('order-flow-zones', () =>
        axios.get(`${API_URL}/api/order-flow-zones`, {
          params: { symbol: 'BTC' }
        })
      )

      setZonesData(response.data)

    } catch (err) {
      console.error('[Dashboard] Error fetching order flow zones:', err)
    }
  }

  // ────────────────────────────────────────────────────────────
  // TAB CHANGE HANDLER
  // ────────────────────────────────────────────────────────────

  const handleTabChange = (tab) => {
    setActiveTab(tab)
  }

  // ────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ────────────────────────────────────────────────────────────

  // Initial load - PRIORITIZED ORDER to avoid browser connection queuing
  useEffect(() => {
    // Priority 1: Candles (critical, fast - 30ms)
    fetchCandles()

    // Priority 2: Order flow zones (critical for CVD, very fast - 5ms, 0.8kB)
    fetchOrderFlowZones()

    // Priority 3: LOB density (slower query, only if tab active)
    // Delayed by 50ms to ensure candles + zones complete first
    setTimeout(() => {
      if (activeTab === 'lob') {
        fetchLOBDensity()
      }
    }, 50)

    // Refresh data every 6 seconds (offset from backend 5s save to avoid race conditions)
    const dataInterval = setInterval(() => {
      fetchCandles()
      fetchOrderFlowZones()  // Update zones together with candles to keep signals in sync
      if (activeTab === 'lob') {
        fetchLOBDensity()
      }
    }, 6000)

    // Update uptime and last update display every second
    const uiInterval = setInterval(() => {
      setUptime(calculateUptime())
      setSystemInfo(prev => ({
        ...prev,
        last_update: calculateLastUpdate()
      }))
    }, 1000)

    return () => {
      clearInterval(dataInterval)
      clearInterval(uiInterval)
    }
  }, [])  // Only run on mount, not on activeTab/priceBin changes

  // Fetch LOB when tab changes to LOB
  useEffect(() => {
    if (activeTab === 'lob' && !lobData) {
      fetchLOBDensity()
    }
  }, [activeTab])

  // ────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────

  // Adapt data for CVDChart
  const chartData = candlesData ? adaptDataForChart(candlesData) : null

  return (
    <div id="app-container" className="h-screen w-screen flex flex-col bg-void-900 text-gray-100 font-sans antialiased overflow-hidden">

      {/* Header */}
      <Header
        status={connectionStatus}
        btcPrice={kpis.current_price}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
        onAboutClick={() => setShowAboutModal(true)}
      />

      {/* Main Layout - Conditional: 80/20 for CVD, Full width for LOB/Bots */}
      {activeTab === 'cvd' ? (
        // Order Flow Tab: 80/20 Layout with Indicators Panel
        <div className="flex-1 flex flex-col lg:flex-row gap-3 p-3 overflow-y-auto">
          {/* Chart Card (80% width on desktop, full width on mobile) */}
          <div className="flex-1 lg:w-[80%] bg-void-800/50 border border-void-600/50 rounded-lg relative min-h-[800px] overflow-hidden">
            {/* Loading Overlay (Only on first load) */}
            {loading && !candlesData && (
              <div className="absolute inset-0 bg-void-900/90 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-void-600 border-t-neon-cyan rounded-full animate-spin mx-auto mb-3" />
                  <div className="text-sm text-gray-400">Loading data...</div>
                </div>
              </div>
            )}

            {/* Error State (Only if no data) */}
            {error && !candlesData && (
              <div className="absolute inset-0 flex items-center justify-center z-50">
                <div className="bg-void-800 border border-neon-red p-6 rounded-lg max-w-md">
                  <h3 className="text-neon-red font-bold mb-2">Error Loading Data</h3>
                  <p className="text-gray-400 text-sm">{error}</p>
                  <button
                    onClick={() => fetchCandles()}
                    className="mt-4 bg-void-700 hover:bg-void-600 border border-void-500 px-4 py-2 rounded text-sm transition-all"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* CVD Chart */}
            {chartData && (
              <CVDChart
                data={chartData}
                zonesData={zonesData}
              />
            )}
          </div>

          {/* Indicator Cards (20% width on desktop, full width on mobile) */}
          <aside className="w-full lg:w-[20%]">
            <IndicatorsPanel
              kpis={kpis}
              systemInfo={systemInfo}
              zonesData={zonesData}
            />
          </aside>
        </div>
      ) : (
        // LOB & Bots Tabs: Full width layout
        <div className="flex-1 p-1 lg:p-3 overflow-y-auto">
          {/* LOB Chart (Full width) */}
          {activeTab === 'lob' && (
            <>
              {chartData && lobData ? (
                <LOBChart
                  priceData={chartData}
                  lobData={lobData}
                  priceBin={priceBin}
                  onPriceBinChange={setPriceBin}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-void-600 border-t-neon-cyan rounded-full animate-spin mx-auto mb-3" />
                    <div className="text-sm text-gray-400">Loading LOB data...</div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Bots Tab (Full width) */}
          {activeTab === 'bots' && (
            <BotsTab />
          )}

          {/* Backtest Tab (Full width) */}
          {activeTab === 'backtest' && (
            <BacktestTab candlesData={candlesData} zonesData={zonesData} />
          )}

          {/* Live Tab (Full width) */}
          {activeTab === 'live' && (
            <LiveTab candlesData={candlesData} zonesData={zonesData} />
          )}
        </div>
      )}

      {/* Footer */}
      <Footer uptime={uptime} />

      {/* About Modal */}
      <AboutModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />
    </div>
  )
}
