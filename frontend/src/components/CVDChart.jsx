// ═══════════════════════════════════════════════════════════
// CVD PRO TERMINAL - React Component (Zero-Friction UX)
// ═══════════════════════════════════════════════════════════

import { useRef, useEffect } from 'react';
import * as echarts from 'echarts';

// ────────────────────────────────────────────────────────────
// CONFIGURATION
// ────────────────────────────────────────────────────────────

const CONFIG = {
    COLORS: {
        BG: '#0b0e11',
        GRID: '#1e232b',
        TEXT: '#8b93a0',
        PRICE_UP: '#00ff00',
        PRICE_DOWN: '#ff0000',
        CVD_UP: 'rgba(0, 240, 255, 0.3)',
        CVD_DOWN: 'rgba(255, 204, 0, 0.3)',
        EFF: '#00f0ff',
        CUM: '#ffcc00',
        VOL_UP: '#00f0ff',
        VOL_DOWN: '#ffcc00',
        SIGNAL_UP: '#00ff00',    // Pure green for positive signals
        SIGNAL_DOWN: '#ff0000'   // Pure red for negative signals
    },
    // Grid Layout Configuration (Percentages)
    // Total: 50% (price+cvd) + 1% + 10% (vol) + 1% + 11% (v2) + 1% + 11% (v3) + 1% + 11% (v1) + 3% (dataZoom) = 100%
    GRIDS: [
        { id: 'price', top: 2, height: 50, axisIndex: [0, 1] },    // 0=Price, 1=CVD (50%)
        { id: 'vol', top: 53, height: 10, axisIndex: [2] },        // Volume (10%)
        { id: 'v2', top: 64, height: 11, axisIndex: [3] },         // V2 Weighted (11%)
        { id: 'v3', top: 76, height: 11, axisIndex: [4] },         // V3 Momentum (11%)
        { id: 'v1', top: 88, height: 9, axisIndex: [5] }           // V1 Cumulative (9%, reduced for slider)
    ],
    AXIS_WIDTH: 60
};

// ────────────────────────────────────────────────────────────
// CVDCHART COMPONENT
// ────────────────────────────────────────────────────────────

/**
 * CVDChart - Professional React component for CVD visualization
 * @param {Object} props - Component props
 * @param {Object} props.data - Chart data object with candles array structure
 * @param {Object} props.zonesData - Zone data from /api/order-flow-zones
 */
const CVDChart = ({ data, zonesData }) => {
    const chartRef = useRef(null);
    const chartInstanceRef = useRef(null);
    const stateRef = useRef({
        lastData: null,
        rawData: null,

        // Axis State (Min/Max for manual control)
        // 0: Price, 1: CVD, 2: Order Flow (Vol), 3: V2, 4: V3, 5: V1
        yAxisState: {
            0: { min: null, max: null, auto: true },
            1: { min: null, max: null, auto: true },
            2: { min: null, max: null, auto: true },
            3: { min: null, max: null, auto: true },
            4: { min: null, max: null, auto: true },
            5: { min: null, max: null, auto: true }
        },

        // Drag Interaction State
        drag: {
            active: false,
            axisIndex: null,
            startY: 0,
            startMin: 0,
            startMax: 0,
            gridHeight: 0
        },

        // View State
        viewState: {
            isFirstLoad: true,
            dataZoom: null
        }
    });

    // ────────────────────────────────────────────────────────────
    // ZONE BANDS CALCULATION
    // ────────────────────────────────────────────────────────────

    /**
     * Calculate zone bands for markArea
     * Returns array of markArea data for both primary and symmetric zones
     */
    const calculateZoneBands = (zoneInfo) => {
        if (!zoneInfo) return [];

        const { is_long, zone_min, zone_max } = zoneInfo;
        const bands = [];

        // Primary zone (best performing direction)
        const primaryColor = is_long ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)';  // green LONG, red SHORT
        bands.push([
            { yAxis: zone_min, itemStyle: { color: primaryColor } },
            { yAxis: zone_max }
        ]);

        // Symmetric zone (opposite direction, calculated by negating boundaries)
        const symColor = is_long ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)';  // red for SHORT, green for LONG
        bands.push([
            { yAxis: -zone_max, itemStyle: { color: symColor } },
            { yAxis: -zone_min }
        ]);

        return bands;
    };

    // ────────────────────────────────────────────────────────────
    // DATA PROCESSING
    // ────────────────────────────────────────────────────────────

    /**
     * Calculate font size for signal numbers based on visible candle count (zoom level)
     * Returns base size in pixels that scales with chart zoom
     */
    const calculateBadgeSize = () => {
        if (!chartInstanceRef.current) return 24; // Default fallback

        try {
            const option = chartInstanceRef.current.getOption();
            const dataZoom = option.dataZoom?.[0];

            if (!dataZoom) return 24;

            // Get total number of candles
            const totalCandles = stateRef.current.rawData?.price_ohlc?.index?.length || 100;

            // Calculate visible candle count based on zoom range
            const start = dataZoom.start || 0;
            const end = dataZoom.end || 100;
            const visiblePercent = (end - start) / 100;
            const visibleCandles = Math.max(5, totalCandles * visiblePercent);

            // Get chart width (grid area width)
            const chartWidth = chartInstanceRef.current.getWidth();
            const gridLeft = 60;
            const gridRight = 60;
            const effectiveWidth = chartWidth - gridLeft - gridRight;

            // Calculate candle width in pixels
            const candleWidth = effectiveWidth / visibleCandles;

            // Badge size = 95% of candle width (approximately same as candle)
            // Clamp between 12px (min readable) and 50px (max size)
            const badgeSize = Math.max(12, Math.min(50, candleWidth * 0.95));

            return badgeSize;
        } catch (e) {
            return 24; // Fallback
        }
    };

    const processData = (rawData) => {
        if (!rawData.price_ohlc || !rawData.price_ohlc.index) return null;

        const timestamps = [...rawData.price_ohlc.index]; // Clone
        const count = timestamps.length;

        const processed = {
            timestamps: timestamps,
            candles: [],
            cvdCandles: [],
            volumeBuy: [],
            volumeSell: [],
            cumulative: [],
            cumulativeBullBase: [],
            cumulativeBullZone: [],
            cumulativeBearBase: [],
            cumulativeBearZone: [],
            markers: []
        };

        for (let i = 0; i < count; i++) {
            // Price (Raw - no filtering)
            if (rawData.price_ohlc.data?.open) {
                processed.candles.push([
                    rawData.price_ohlc.data.open[i],
                    rawData.price_ohlc.data.close[i],
                    rawData.price_ohlc.data.low[i],
                    rawData.price_ohlc.data.high[i]
                ]);
            }
            // CVD (Raw - no filtering)
            if (rawData.cvd_ohlc?.data?.open) {
                processed.cvdCandles.push([
                    rawData.cvd_ohlc.data.open[i],
                    rawData.cvd_ohlc.data.close[i],
                    rawData.cvd_ohlc.data.low[i],
                    rawData.cvd_ohlc.data.high[i]
                ]);
            }
            // Volume (separate buy and sell)
            const volBuy = rawData.vol_buy?.values?.[i] || 0;
            const volSell = rawData.vol_sell?.values?.[i] || 0;
            processed.volumeBuy.push(volBuy);
            processed.volumeSell.push(-volSell); // Negative for visual stacking
        }

        // Cumulative v1, v2, v3 (show all 3 versions together)
        processed.cumulative_v1 = [];
        processed.cumulative_v2 = [];
        processed.cumulative_v3 = [];

        // Process v1 (cumulative_segments)
        if (rawData.cumulative_segments && Array.isArray(rawData.cumulative_segments)) {
            const v1Map = new Map();
            rawData.cumulative_segments.forEach(seg => {
                if (!seg.index || !seg.values) return;
                for (let j = 0; j < seg.index.length; j++) v1Map.set(seg.index[j], seg.values[j]);
            });
            timestamps.forEach(ts => processed.cumulative_v1.push(v1Map.get(ts) || 0));
        }

        // Process v2 (weighted_cumulative_segments)
        if (rawData.weighted_cumulative_segments && Array.isArray(rawData.weighted_cumulative_segments)) {
            const v2Map = new Map();
            rawData.weighted_cumulative_segments.forEach(seg => {
                if (!seg.index || !seg.values) return;
                for (let j = 0; j < seg.index.length; j++) v2Map.set(seg.index[j], seg.values[j]);
            });
            timestamps.forEach(ts => processed.cumulative_v2.push(v2Map.get(ts) || 0));
        }

        // Process v3 (momentum_v3_segments)
        if (rawData.momentum_v3_segments && Array.isArray(rawData.momentum_v3_segments)) {
            const v3Map = new Map();
            rawData.momentum_v3_segments.forEach(seg => {
                if (!seg.index || !seg.values) return;
                for (let j = 0; j < seg.index.length; j++) v3Map.set(seg.index[j], seg.values[j]);
            });
            timestamps.forEach(ts => processed.cumulative_v3.push(v3Map.get(ts) || 0));
        }

        // Markers
        if (rawData.signals?.values) {
            // Fixed offset in price units (adjust based on your asset's typical price range)
            const fixedOffset = 20; // Fixed distance from candle

            for (let i = 0; i < rawData.signals.values.length; i++) {
                const sig = rawData.signals.values[i];
                if (sig === 0) continue;
                const candle = processed.candles[i];
                if (!candle) continue;

                // Positive signals: position below candle low
                // Negative signals: position above candle high
                const yPosition = sig > 0 ? candle[2] - fixedOffset : candle[3] + fixedOffset;

                // Just colored numbers - no shapes
                const badgeSize = calculateBadgeSize();
                const fontSize = Math.max(10, Math.floor(badgeSize * 0.6));  // Larger font for readability

                processed.markers.push({
                    coord: [i, yPosition],
                    value: Math.abs(sig).toString(),
                    itemStyle: {
                        color: 'transparent'  // No background shape
                    },
                    label: {
                        show: true,
                        formatter: '{c}',
                        color: sig > 0 ? CONFIG.COLORS.SIGNAL_UP : CONFIG.COLORS.SIGNAL_DOWN,
                        fontWeight: 'bold',
                        fontSize: fontSize
                    },
                    symbol: 'circle',
                    symbolSize: 1  // Minimal invisible dot
                });
            }
        }

        return processed;
    };

    // ────────────────────────────────────────────────────────────
    // SMART SCALING (TradingView-like)
    // ────────────────────────────────────────────────────────────

    const handleSmartScaling = () => {
        if (!stateRef.current.lastData || !chartInstanceRef.current) return;

        // Only scale axes in auto mode
        if (!stateRef.current.yAxisState[0].auto && !stateRef.current.yAxisState[1].auto) return;

        // Get current zoom range (percentage)
        const model = chartInstanceRef.current.getModel().getComponent('dataZoom', 0);
        const start = model.option.start;
        const end = model.option.end;

        // Calculate indices
        const total = stateRef.current.lastData.timestamps.length;
        const startIdx = Math.floor((start / 100) * total);
        const endIdx = Math.ceil((end / 100) * total);

        let minPrice = Infinity, maxPrice = -Infinity;
        let minCvd = Infinity, maxCvd = -Infinity;
        let hasData = false;

        // Iterate visible range
        for (let i = startIdx; i < endIdx; i++) {
            if (i >= stateRef.current.lastData.candles.length) break;

            const candle = stateRef.current.lastData.candles[i];
            if (candle) {
                if (candle[2] < minPrice) minPrice = candle[2];
                if (candle[3] > maxPrice) maxPrice = candle[3];
                hasData = true;
            }

            const cvd = stateRef.current.lastData.cvdCandles[i];
            if (cvd) {
                if (cvd[2] < minCvd) minCvd = cvd[2];
                if (cvd[3] > maxCvd) maxCvd = cvd[3];
            }
        }

        if (!hasData) return;

        // Add padding (5%)
        const priceRange = maxPrice - minPrice;
        const cvdRange = maxCvd - minCvd;
        const pricePad = priceRange * 0.05;
        const cvdPad = cvdRange * 0.05;

        // Update only axes in auto mode
        const yAxisUpdates = [{}, {}, {}, {}, {}];

        if (stateRef.current.yAxisState[0].auto) {
            yAxisUpdates[0] = { min: minPrice - pricePad, max: maxPrice + pricePad };
        }

        if (stateRef.current.yAxisState[1].auto) {
            yAxisUpdates[1] = { min: minCvd - cvdPad, max: maxCvd + cvdPad };
        }

        chartInstanceRef.current.setOption({ yAxis: yAxisUpdates });
    };

    // ────────────────────────────────────────────────────────────
    // INTERACTION LOGIC (GRID-AWARE)
    // ────────────────────────────────────────────────────────────

    const setupInteractions = () => {
        if (!chartInstanceRef.current) return;

        const zr = chartInstanceRef.current.getZr();

        // Helper: Find which grid the Y-coordinate belongs to
        const getGridIndex = (y) => {
            const height = chartInstanceRef.current.getHeight();

            for (let i = 0; i < CONFIG.GRIDS.length; i++) {
                const g = CONFIG.GRIDS[i];
                const topPx = (g.top / 100) * height;
                const bottomPx = ((g.top + g.height) / 100) * height;
                if (y >= topPx && y <= bottomPx) return i;
            }
            return -1;
        };

        // 1. MOUSE DOWN
        zr.on('mousedown', (e) => {
            const x = e.offsetX;
            const y = e.offsetY;
            const width = zr.getWidth();
            const isShift = e.event.shiftKey;

            stateRef.current.drag.active = false;
            stateRef.current.drag.axisIndex = null;

            // 1. Identify Grid
            const gridIdx = getGridIndex(y);
            if (gridIdx === -1) return; // Clicked in gap

            // 2. Identify Zone (Left/Right Gutter)
            let axisIndex = null;

            if (gridIdx === 0) {
                // Main Chart (Price/CVD) - SWAPPED: CVD left, Price right
                if (x < 60) axisIndex = 1; // CVD (now on left)
                else if (x > width - 60 || isShift) axisIndex = 0; // Price (now on right)
            } else {
                // Sub Charts (Vol/Eff/Cum)
                // Allow dragging from either side for convenience
                if (x < 60 || x > width - 60) {
                    axisIndex = CONFIG.GRIDS[gridIdx].axisIndex[0];
                }
            }

            if (axisIndex === null) return; // Clicked in center (pan time)

            // 3. Init Drag
            stateRef.current.drag.active = true;
            stateRef.current.drag.axisIndex = axisIndex;
            stateRef.current.drag.startY = y;
            stateRef.current.drag.gridHeight = (CONFIG.GRIDS[gridIdx].height / 100) * chartInstanceRef.current.getHeight();

            const model = chartInstanceRef.current.getModel().getComponent('yAxis', axisIndex);
            const extent = model.axis.scale.getExtent();
            stateRef.current.drag.startMin = extent[0];
            stateRef.current.drag.startMax = extent[1];

            stateRef.current.yAxisState[axisIndex].auto = false;
            zr.setCursorStyle('ns-resize');

            // Stop propagation ONLY if we are dragging an axis
            e.stop();
        });

        // 2. MOUSE MOVE
        zr.on('mousemove', (e) => {
            const x = e.offsetX;
            const y = e.offsetY;
            const width = zr.getWidth();
            const isShift = e.event.shiftKey;

            // Cursor Feedback
            if (!stateRef.current.drag.active) {
                const gridIdx = getGridIndex(y);
                if (gridIdx !== -1 && (x < 60 || x > width - 60 || isShift)) {
                    zr.setCursorStyle('ns-resize');
                } else {
                    zr.setCursorStyle('default');
                }
                return;
            }

            // Execute Drag
            const deltaY = e.offsetY - stateRef.current.drag.startY;
            const range = stateRef.current.drag.startMax - stateRef.current.drag.startMin;

            // Sensitivity: 1 full grid height drag = 1 full range shift
            const shift = (range / stateRef.current.drag.gridHeight) * deltaY;

            // Invert because screen Y is down
            const newMin = stateRef.current.drag.startMin + shift;
            const newMax = stateRef.current.drag.startMax + shift;

            const idx = stateRef.current.drag.axisIndex;
            stateRef.current.yAxisState[idx].min = newMin;
            stateRef.current.yAxisState[idx].max = newMax;

            // Apply
            chartInstanceRef.current.setOption({
                yAxis: [
                    { min: stateRef.current.yAxisState[0].min, max: stateRef.current.yAxisState[0].max },
                    { min: stateRef.current.yAxisState[1].min, max: stateRef.current.yAxisState[1].max },
                    { min: stateRef.current.yAxisState[2].min, max: stateRef.current.yAxisState[2].max },
                    { min: stateRef.current.yAxisState[3].min, max: stateRef.current.yAxisState[3].max },
                    { min: stateRef.current.yAxisState[4].min, max: stateRef.current.yAxisState[4].max },
                    { min: stateRef.current.yAxisState[5].min, max: stateRef.current.yAxisState[5].max }
                ]
            });
        });

        // 3. MOUSE UP
        zr.on('mouseup', () => {
            stateRef.current.drag.active = false;
            zr.setCursorStyle('default');
        });

        // 4. DOUBLE CLICK (Reset)
        zr.on('dblclick', (e) => {
            const x = e.offsetX;
            const y = e.offsetY;
            const width = zr.getWidth();

            const gridIdx = getGridIndex(y);
            if (gridIdx === -1) return;

            let axisIndex = null;
            if (gridIdx === 0) {
                // SWAPPED: CVD left, Price right
                if (x < 60) axisIndex = 1; // CVD (now on left)
                else if (x > width - 60) axisIndex = 0; // Price (now on right)
            } else {
                if (x < 60 || x > width - 60) axisIndex = CONFIG.GRIDS[gridIdx].axisIndex[0];
            }

            if (axisIndex !== null) {
                stateRef.current.yAxisState[axisIndex].auto = true;
                stateRef.current.yAxisState[axisIndex].min = null;
                stateRef.current.yAxisState[axisIndex].max = null;
                if (stateRef.current.rawData) {
                    updateChart(stateRef.current.rawData);
                    handleSmartScaling(); // Re-apply smart scaling immediately
                }
            }
        });
    };

    // ────────────────────────────────────────────────────────────
    // CHART UPDATE
    // ────────────────────────────────────────────────────────────

    const updateChart = (rawData) => {
        if (!chartInstanceRef.current) return;

        stateRef.current.rawData = rawData;
        const processed = processData(rawData);
        if (!processed) return;

        // Save Zoom
        let currentZoom = null;
        if (!stateRef.current.viewState.isFirstLoad) {
            currentZoom = chartInstanceRef.current.getOption().dataZoom?.[0];
        }

        // Prepare Options
        const option = {
            xAxis: [
                { data: processed.timestamps },
                { data: processed.timestamps },
                { data: processed.timestamps },
                { data: processed.timestamps },
                { data: processed.timestamps }
            ],
            yAxis: [
                { min: stateRef.current.yAxisState[0].auto ? null : stateRef.current.yAxisState[0].min, max: stateRef.current.yAxisState[0].auto ? null : stateRef.current.yAxisState[0].max },
                { min: stateRef.current.yAxisState[1].auto ? null : stateRef.current.yAxisState[1].min, max: stateRef.current.yAxisState[1].auto ? null : stateRef.current.yAxisState[1].max },
                { min: stateRef.current.yAxisState[2].auto ? null : stateRef.current.yAxisState[2].min, max: stateRef.current.yAxisState[2].auto ? null : stateRef.current.yAxisState[2].max },
                { min: stateRef.current.yAxisState[3].auto ? null : stateRef.current.yAxisState[3].min, max: stateRef.current.yAxisState[3].auto ? null : stateRef.current.yAxisState[3].max },
                { min: stateRef.current.yAxisState[4].auto ? null : stateRef.current.yAxisState[4].min, max: stateRef.current.yAxisState[4].auto ? null : stateRef.current.yAxisState[4].max },
                { min: stateRef.current.yAxisState[5].auto ? null : stateRef.current.yAxisState[5].min, max: stateRef.current.yAxisState[5].auto ? null : stateRef.current.yAxisState[5].max }
            ],
            series: [
                { data: processed.candles, markPoint: { data: processed.markers } },  // Price candlestick
                { data: processed.cvdCandles },  // CVD candlestick
                { data: processed.volumeBuy },   // Volume buy bars
                { data: processed.volumeSell },  // Volume sell bars
                // V2 Weighted with zone bands
                {
                    data: processed.cumulative_v2 || [],
                    markArea: zonesData?.cumulative_v2 ? {
                        data: calculateZoneBands(zonesData.cumulative_v2),
                        silent: true
                    } : undefined
                },
                // V3 Momentum with zone bands
                {
                    data: processed.cumulative_v3 || [],
                    markArea: zonesData?.cumulative_v3 ? {
                        data: calculateZoneBands(zonesData.cumulative_v3),
                        silent: true
                    } : undefined
                },
                { data: processed.cumulative_v1 || [] }   // v1 line (no zones)
            ]
        };

        chartInstanceRef.current.setOption(option, false);

        // Restore or Init Zoom
        if (currentZoom) {
            // Keep existing zoom window (start/end percentages)
            chartInstanceRef.current.setOption({ dataZoom: [{ start: currentZoom.start, end: currentZoom.end }] });
        } else if (stateRef.current.viewState.isFirstLoad) {
            stateRef.current.viewState.isFirstLoad = false;
            // Initial view: show last 5% of data (recent candles)
        }

        stateRef.current.lastData = processed;

        // Trigger Smart Scaling
        handleSmartScaling();
    };

    // ────────────────────────────────────────────────────────────
    // ECHARTS INITIALIZATION
    // ────────────────────────────────────────────────────────────

    const initializeChart = () => {
        if (!chartRef.current) return;

        chartInstanceRef.current = echarts.init(chartRef.current, null, {
            renderer: 'canvas',
            useDirtyRect: false
        });

        const option = {
            backgroundColor: CONFIG.COLORS.BG,
            animation: false, // Disable animation for performance during drag

            axisPointer: {
                link: [{ xAxisIndex: 'all' }],
                label: { backgroundColor: '#777' }
            },

            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' },
                formatter: () => ''  // Empty formatter hides the tooltip box
            },

            title: [
                {
                    text: 'Price and CVD',
                    left: 75,
                    top: '3%',
                    textStyle: { color: '#8b93a0', fontSize: 11, fontWeight: 'normal' }
                },
                {
                    text: 'Order Flow',
                    left: 75,
                    top: '54%',
                    textStyle: { color: '#8b93a0', fontSize: 11, fontWeight: 'normal' }
                },
                {
                    text: 'V2 Weighted Directional',
                    left: 75,
                    top: '65%',
                    textStyle: { color: '#a855f7', fontSize: 11, fontWeight: 'normal' }
                },
                {
                    text: 'V3 Momentum Directional',
                    left: 75,
                    top: '77%',
                    textStyle: { color: '#00f0ff', fontSize: 11, fontWeight: 'normal' }
                },
                {
                    text: 'V1 Simple Cumulative',
                    left: 75,
                    top: '89%',
                    textStyle: { color: '#fbbf24', fontSize: 11, fontWeight: 'normal' }
                }
            ],

            dataZoom: [
                {
                    type: 'inside',
                    xAxisIndex: [0, 1, 2, 3, 4],
                    start: 60, // Show last ~400 candles (40% of ~1000 total) - wider view
                    end: 100,
                    minValueSpan: 5, // Allow zooming in to 5 candles
                    zoomOnMouseWheel: true,
                    moveOnMouseWheel: true, // Enable Zoom on Wheel
                    preventDefaultMouseMove: false // Allow default behavior (pan)
                },
                {
                    type: 'slider',
                    xAxisIndex: [0, 1, 2, 3, 4],
                    bottom: 5,
                    height: 18,
                    borderColor: '#454d5f',
                    fillerColor: 'rgba(0, 240, 255, 0.1)',
                    handleStyle: { color: '#00f0ff', borderColor: '#00f0ff' },
                    textStyle: { color: '#8b93a0' }
                }
            ],

            grid: CONFIG.GRIDS.map(g => ({
                left: 45, right: 45,
                top: g.top + '%',
                height: g.height + '%',
                show: true,
                borderColor: '#2a2e39',
                backgroundColor: CONFIG.COLORS.BG,
                containLabel: false
            })),

            xAxis: [0, 1, 2, 3, 4].map(i => ({
                type: 'category', gridIndex: i, data: [],
                axisLine: { lineStyle: { color: '#454d5f' } },
                axisLabel: {
                    show: i === 4,  // Only show labels on bottom grid (v1)
                    color: '#8b93a0',
                    fontSize: 10,
                    formatter: (v) => {
                        // Format: "2024-11-26T19:30:00.000" -> "26 Nov 19:30"
                        try {
                            const date = new Date(v);
                            const day = date.getDate();
                            const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()];
                            const hours = String(date.getHours()).padStart(2, '0');
                            const minutes = String(date.getMinutes()).padStart(2, '0');
                            return `${day} ${month} ${hours}:${minutes}`;
                        } catch {
                            return v;
                        }
                    }
                },
                axisTick: { show: i === 4, lineStyle: { color: '#454d5f' } },
                splitLine: { show: false },
                axisPointer: {
                    label: {
                        show: i === 4,
                        formatter: (params) => {
                            try {
                                const date = new Date(params.value);
                                const day = date.getDate();
                                const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()];
                                const hours = String(date.getHours()).padStart(2, '0');
                                const minutes = String(date.getMinutes()).padStart(2, '0');
                                return `${day} ${month} ${hours}:${minutes}`;
                            } catch {
                                return params.value;
                            }
                        }
                    }
                }
            })),

            yAxis: [
                // 0: Price (Right - SWAPPED)
                { type: 'value', gridIndex: 0, scale: true, position: 'right', axisLine: { lineStyle: { color: '#454d5f' } }, axisLabel: { color: '#8b93a0', fontSize: 10, formatter: (v) => v.toFixed(0) }, splitLine: { show: false } },
                // 1: CVD (Left - SWAPPED)
                { type: 'value', gridIndex: 0, scale: true, position: 'left', axisLine: { lineStyle: { color: '#454d5f' } }, axisLabel: { show: true, color: CONFIG.COLORS.CVD_UP, fontSize: 10, formatter: (v) => v.toFixed(0) }, splitLine: { lineStyle: { color: '#1e232b' } } },
                // 2: Order Flow (Volume)
                { type: 'value', gridIndex: 1, axisLine: { lineStyle: { color: '#454d5f' } }, axisLabel: { color: '#8b93a0', fontSize: 10, formatter: (v) => v.toFixed(2) }, splitLine: { lineStyle: { color: '#1e232b' } } },
                // 3: V2 Weighted
                { type: 'value', gridIndex: 2, axisLine: { lineStyle: { color: '#454d5f' } }, axisLabel: { color: '#a855f7', fontSize: 10, formatter: (v) => v.toFixed(1) }, splitLine: { lineStyle: { color: '#1e232b' } } },
                // 4: V3 Momentum
                { type: 'value', gridIndex: 3, axisLine: { lineStyle: { color: '#454d5f' } }, axisLabel: { color: '#00f0ff', fontSize: 10, formatter: (v) => v.toFixed(1) }, splitLine: { lineStyle: { color: '#1e232b' } } },
                // 5: V1 Cumulative
                { type: 'value', gridIndex: 4, axisLine: { lineStyle: { color: '#454d5f' } }, axisLabel: { color: '#fbbf24', fontSize: 10, formatter: (v) => v.toFixed(1) }, splitLine: { lineStyle: { color: '#1e232b' } } }
            ],

            series: [
                // Grid 0 (Top): Price + CVD
                { name: 'Price', type: 'candlestick', data: [], xAxisIndex: 0, yAxisIndex: 0, clip: true, itemStyle: { color: CONFIG.COLORS.PRICE_UP, color0: CONFIG.COLORS.PRICE_DOWN, borderColor: CONFIG.COLORS.PRICE_UP, borderColor0: CONFIG.COLORS.PRICE_DOWN } },
                { name: 'CVD', type: 'candlestick', data: [], xAxisIndex: 0, yAxisIndex: 1, clip: true, itemStyle: { color: CONFIG.COLORS.CVD_UP, color0: CONFIG.COLORS.CVD_DOWN, borderColor: 'rgba(255, 255, 255, 0.2)', borderColor0: 'rgba(255, 255, 255, 0.2)' } },

                // Grid 1: Volume
                { name: 'Volume Buy', type: 'bar', data: [], xAxisIndex: 1, yAxisIndex: 2, stack: 'volume', clip: true, itemStyle: { color: CONFIG.COLORS.VOL_UP }, barMaxWidth: 20 },
                { name: 'Volume Sell', type: 'bar', data: [], xAxisIndex: 1, yAxisIndex: 2, stack: 'volume', clip: true, itemStyle: { color: CONFIG.COLORS.VOL_DOWN }, barMaxWidth: 20 },

                // Grid 2: V2 Weighted (Violet/Purple)
                {
                    name: 'V2 Weighted',
                    type: 'line',
                    data: [],
                    xAxisIndex: 2,
                    yAxisIndex: 3,
                    clip: true,
                    lineStyle: {
                        color: '#a855f7', // Violet
                        width: 2
                    },
                    areaStyle: {
                        color: 'rgba(168, 85, 247, 0.15)'
                    },
                    showSymbol: false,
                    smooth: 0.3
                },

                // Grid 3: V3 Momentum (Cyan/Neon)
                {
                    name: 'V3 Momentum',
                    type: 'line',
                    data: [],
                    xAxisIndex: 3,
                    yAxisIndex: 4,
                    clip: true,
                    lineStyle: {
                        color: '#00f0ff', // Neon Cyan
                        width: 2
                    },
                    areaStyle: {
                        color: 'rgba(0, 240, 255, 0.15)'
                    },
                    showSymbol: false,
                    smooth: 0.3
                },

                // Grid 4: V1 Cumulative (Yellow/Amber)
                {
                    name: 'V1 Cumulative',
                    type: 'line',
                    data: [],
                    xAxisIndex: 4,
                    yAxisIndex: 5,
                    clip: true,
                    lineStyle: {
                        color: '#fbbf24', // Amber/Yellow
                        width: 2
                    },
                    areaStyle: {
                        color: 'rgba(251, 191, 36, 0.15)'
                    },
                    showSymbol: false,
                    smooth: 0.3
                }
            ]
        };

        chartInstanceRef.current.setOption(option);

        // Smart Scaling on Zoom
        chartInstanceRef.current.on('dataZoom', () => {
            handleSmartScaling();
        });

        // Setup interactions
        setupInteractions();
    };

    // ────────────────────────────────────────────────────────────
    // REACT LIFECYCLE
    // ────────────────────────────────────────────────────────────

    // Initialize chart on mount
    useEffect(() => {
        initializeChart();

        // Handle window resize
        const handleResize = () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.resize();
            }
        };

        window.addEventListener('resize', handleResize);

        // Cleanup on unmount
        return () => {
            window.removeEventListener('resize', handleResize);
            if (chartInstanceRef.current) {
                chartInstanceRef.current.dispose();
                chartInstanceRef.current = null;
            }
        };
    }, []);

    // Update chart when data or activeTab changes
    useEffect(() => {
        if (data && chartInstanceRef.current) {
            updateChart(data);
        }
    }, [data]);

    // ────────────────────────────────────────────────────────────
    // RENDER
    // ────────────────────────────────────────────────────────────

    return (
        <div
            ref={chartRef}
            style={{
                width: '100%',
                height: '100%'
            }}
        />
    );
};

export default CVDChart;
