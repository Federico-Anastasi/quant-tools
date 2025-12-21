// ═══════════════════════════════════════════════════════════
// BACKTEST CHART - Clone of CVDChart with Trade Overlay
// ═══════════════════════════════════════════════════════════

import { useRef, useEffect, useMemo } from 'react';
import * as echarts from 'echarts';
import { calculateHistoricalZoneBands } from '../utils/zoneRenderer';
import { useDeviceType } from '../hooks/useDeviceType';

// ────────────────────────────────────────────────────────────
// RESPONSIVE GRID CONFIGURATION
// ────────────────────────────────────────────────────────────

/**
 * Get responsive grid layouts based on device type
 * Mobile: 3 grids (Price, OrderFlow, V3) - V2 and V1 hidden
 * Tablet: All 5 grids with optimized spacing
 * Desktop: Original 5-grid layout
 */
const getResponsiveGrids = (isMobile, isTablet) => {
    if (isMobile) {
        // Mobile: Show only Price, OrderFlow, V3 Momentum (hide V2, V1)
        return [
            { id: 'price', top: 2, height: 50, axisIndex: [0, 1] },
            { id: 'vol', top: 54, height: 15, axisIndex: [2] },
            { id: 'v3', top: 71, height: 17, axisIndex: [3] }
        ];
    }

    if (isTablet) {
        // Tablet: All 5 grids with better spacing
        return [
            { id: 'price', top: 2, height: 52, axisIndex: [0, 1] },
            { id: 'vol', top: 55, height: 9, axisIndex: [2] },
            { id: 'v2', top: 65, height: 10, axisIndex: [3] },
            { id: 'v3', top: 76, height: 10, axisIndex: [4] },
            { id: 'v1', top: 87, height: 10, axisIndex: [5] }
        ];
    }

    // Desktop: Original layout
    return [
        { id: 'price', top: 2, height: 50, axisIndex: [0, 1] },
        { id: 'vol', top: 53, height: 10, axisIndex: [2] },
        { id: 'v2', top: 64, height: 11, axisIndex: [3] },
        { id: 'v3', top: 76, height: 11, axisIndex: [4] },
        { id: 'v1', top: 88, height: 9, axisIndex: [5] }
    ];
};

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
        SIGNAL_UP: '#00ff00',
        SIGNAL_DOWN: '#ff0000'
    },
    AXIS_WIDTH: 60
};

/**
 * BacktestChart - Identical to CVDChart with trade box overlay
 */
const BacktestChart = ({ data, activeTrade, tradeHistory = [], onChartClick, tradeMode, historicalZones = [] }) => {
    // ────────────────────────────────────────────────────────────
    // DEVICE DETECTION & RESPONSIVE GRIDS
    // ────────────────────────────────────────────────────────────
    const { isMobile, isTablet } = useDeviceType();
    const GRIDS = useMemo(() => getResponsiveGrids(isMobile, isTablet), [isMobile, isTablet]);

    const chartRef = useRef(null);
    const chartInstanceRef = useRef(null);
    const stateRef = useRef({
        lastData: null,
        rawData: null,

        // Axis State (Min/Max for manual control)
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
    // DATA PROCESSING (Simplified - data already processed by parent)
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

        const timestamps = [...rawData.price_ohlc.index];
        const count = timestamps.length;

        const processed = {
            timestamps: timestamps,
            candles: [],
            cvdCandles: [],
            volumeBuy: [],
            volumeSell: [],
            cumulative_v1: [],
            cumulative_v2: [],
            cumulative_v3: [],
            markers: []
        };

        for (let i = 0; i < count; i++) {
            // Price
            if (rawData.price_ohlc.data?.open) {
                processed.candles.push([
                    rawData.price_ohlc.data.open[i],
                    rawData.price_ohlc.data.close[i],
                    rawData.price_ohlc.data.low[i],
                    rawData.price_ohlc.data.high[i]
                ]);
            }
            // CVD
            if (rawData.cvd_ohlc?.data?.open) {
                processed.cvdCandles.push([
                    rawData.cvd_ohlc.data.open[i],
                    rawData.cvd_ohlc.data.close[i],
                    rawData.cvd_ohlc.data.low[i],
                    rawData.cvd_ohlc.data.high[i]
                ]);
            }
            // Volume
            const volBuy = rawData.vol_buy?.values?.[i] || 0;
            const volSell = rawData.vol_sell?.values?.[i] || 0;
            processed.volumeBuy.push(volBuy);
            processed.volumeSell.push(-volSell);
        }

        // Process cumulative indicators
        if (rawData.cumulative_segments && Array.isArray(rawData.cumulative_segments)) {
            const v1Map = new Map();
            rawData.cumulative_segments.forEach(seg => {
                if (!seg.index || !seg.values) return;
                for (let j = 0; j < seg.index.length; j++) v1Map.set(seg.index[j], seg.values[j]);
            });
            timestamps.forEach(ts => processed.cumulative_v1.push(v1Map.get(ts) || 0));
        }

        if (rawData.weighted_cumulative_segments && Array.isArray(rawData.weighted_cumulative_segments)) {
            const v2Map = new Map();
            rawData.weighted_cumulative_segments.forEach(seg => {
                if (!seg.index || !seg.values) return;
                for (let j = 0; j < seg.index.length; j++) v2Map.set(seg.index[j], seg.values[j]);
            });
            timestamps.forEach(ts => processed.cumulative_v2.push(v2Map.get(ts) || 0));
        }

        if (rawData.momentum_v3_segments && Array.isArray(rawData.momentum_v3_segments)) {
            const v3Map = new Map();
            rawData.momentum_v3_segments.forEach(seg => {
                if (!seg.index || !seg.values) return;
                for (let j = 0; j < seg.index.length; j++) v3Map.set(seg.index[j], seg.values[j]);
            });
            timestamps.forEach(ts => processed.cumulative_v3.push(v3Map.get(ts) || 0));
        }

        // Markers (Classification numbers)
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
        const yAxisUpdates = [{}, {}, {}, {}, {}, {}];

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

            for (let i = 0; i < GRIDS.length; i++) {
                const g = GRIDS[i];
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
            if (gridIdx === -1) return;

            // 2. Identify Zone (Left/Right Gutter) - INCREASED ZONE TO 100px
            let axisIndex = null;

            if (gridIdx === 0) {
                if (x < 100) axisIndex = 1; // CVD (left) - increased from 60 to 100
                else if (x > width - 100 || isShift) axisIndex = 0; // Price (right) - increased from 60 to 100
            } else {
                if (x < 100 || x > width - 100) {
                    axisIndex = GRIDS[gridIdx].axisIndex[0];
                }
            }

            if (axisIndex === null) return;

            // 3. Init Drag
            stateRef.current.drag.active = true;
            stateRef.current.drag.axisIndex = axisIndex;
            stateRef.current.drag.startY = y;
            stateRef.current.drag.gridHeight = (GRIDS[gridIdx].height / 100) * chartInstanceRef.current.getHeight();

            const model = chartInstanceRef.current.getModel().getComponent('yAxis', axisIndex);
            const extent = model.axis.scale.getExtent();
            stateRef.current.drag.startMin = extent[0];
            stateRef.current.drag.startMax = extent[1];

            stateRef.current.yAxisState[axisIndex].auto = false;
            zr.setCursorStyle('ns-resize');

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
                if (gridIdx !== -1 && (x < 100 || x > width - 100 || isShift)) {
                    zr.setCursorStyle('ns-resize');
                } else {
                    zr.setCursorStyle('default');
                }
                return;
            }

            // Execute Drag
            const deltaY = e.offsetY - stateRef.current.drag.startY;
            const range = stateRef.current.drag.startMax - stateRef.current.drag.startMin;
            const shift = (range / stateRef.current.drag.gridHeight) * deltaY;

            const newMin = stateRef.current.drag.startMin + shift;
            const newMax = stateRef.current.drag.startMax + shift;

            const idx = stateRef.current.drag.axisIndex;
            stateRef.current.yAxisState[idx].min = newMin;
            stateRef.current.yAxisState[idx].max = newMax;

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
                if (x < 100) axisIndex = 1; // CVD
                else if (x > width - 100) axisIndex = 0; // Price
            } else {
                if (x < 100 || x > width - 100) axisIndex = CONFIG.GRIDS[gridIdx].axisIndex[0];
            }

            if (axisIndex !== null) {
                stateRef.current.yAxisState[axisIndex].auto = true;
                stateRef.current.yAxisState[axisIndex].min = null;
                stateRef.current.yAxisState[axisIndex].max = null;
                if (stateRef.current.rawData) {
                    updateChart(stateRef.current.rawData);
                    handleSmartScaling();
                }
            }
        });

        // 5. MOUSE WHEEL (Zoom on Y-axis)
        zr.on('mousewheel', (e) => {
            const x = e.offsetX;
            const y = e.offsetY;
            const width = zr.getWidth();
            const delta = e.wheelDelta;

            // Check if mouse is over axis area
            const gridIdx = getGridIndex(y);
            if (gridIdx === -1) return;

            let axisIndex = null;
            if (gridIdx === 0) {
                if (x < 100) axisIndex = 1; // CVD (left)
                else if (x > width - 100) axisIndex = 0; // Price (right)
            } else {
                if (x < 100 || x > width - 100) axisIndex = CONFIG.GRIDS[gridIdx].axisIndex[0];
            }

            if (axisIndex === null) return;

            e.stop();

            // Get current axis range
            const model = chartInstanceRef.current.getModel().getComponent('yAxis', axisIndex);
            const extent = model.axis.scale.getExtent();
            const currentMin = extent[0];
            const currentMax = extent[1];
            const range = currentMax - currentMin;

            // Zoom factor (positive delta = zoom in, negative = zoom out)
            const zoomFactor = delta > 0 ? 0.9 : 1.1;
            const newRange = range * zoomFactor;
            const center = (currentMin + currentMax) / 2;

            const newMin = center - newRange / 2;
            const newMax = center + newRange / 2;

            // Update state
            stateRef.current.yAxisState[axisIndex].auto = false;
            stateRef.current.yAxisState[axisIndex].min = newMin;
            stateRef.current.yAxisState[axisIndex].max = newMax;

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
    };

    // ────────────────────────────────────────────────────────────
    // TOUCH INTERACTION (Mobile/Tablet)
    // ────────────────────────────────────────────────────────────

    const setupTouchInteraction = () => {
        if (!chartRef.current || !chartInstanceRef.current) return () => {};

        let touchState = {
            active: false,
            axisIndex: null,
            startY: 0,
            startMin: 0,
            startMax: 0
        };

        const getGridIndex = (y) => {
            const height = chartInstanceRef.current.getHeight();
            for (let i = 0; i < GRIDS.length; i++) {
                const g = GRIDS[i];
                const topPx = (g.top / 100) * height;
                const bottomPx = ((g.top + g.height) / 100) * height;
                if (y >= topPx && y <= bottomPx) return i;
            }
            return -1;
        };

        const handleTouchStart = (e) => {
            if (e.touches.length !== 1) return;

            const touch = e.touches[0];
            const rect = chartRef.current.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            const width = chartInstanceRef.current.getWidth();

            // Check if touch is on Y-axis area (right 60px or left 100px for CVD)
            const gridIdx = getGridIndex(y);
            if (gridIdx === -1) return;

            let axisIndex = null;
            if (gridIdx === 0) {
                if (x < 100) axisIndex = 1; // CVD (left)
                else if (x > width - CONFIG.AXIS_WIDTH) axisIndex = 0; // Price (right)
            } else {
                if (x < 100 || x > width - CONFIG.AXIS_WIDTH) {
                    axisIndex = GRIDS[gridIdx].axisIndex[0];
                }
            }

            if (axisIndex === null) return;

            e.preventDefault();

            const model = chartInstanceRef.current.getModel().getComponent('yAxis', axisIndex);
            const extent = model.axis.scale.getExtent();

            touchState = {
                active: true,
                axisIndex,
                startY: y,
                startMin: extent[0],
                startMax: extent[1]
            };

            stateRef.current.yAxisState[axisIndex].auto = false;
        };

        const handleTouchMove = (e) => {
            if (!touchState.active || e.touches.length !== 1) return;

            e.preventDefault();

            const touch = e.touches[0];
            const rect = chartRef.current.getBoundingClientRect();
            const y = touch.clientY - rect.top;
            const deltaY = y - touchState.startY;

            const gridIdx = GRIDS.findIndex(g => g.axisIndex[0] === touchState.axisIndex || (g.axisIndex.length > 1 && g.axisIndex.includes(touchState.axisIndex)));
            if (gridIdx === -1) return;

            const gridHeight = (GRIDS[gridIdx].height / 100) * chartInstanceRef.current.getHeight();
            const range = touchState.startMax - touchState.startMin;
            const shift = (range / gridHeight) * deltaY;

            stateRef.current.yAxisState[touchState.axisIndex].min = touchState.startMin + shift;
            stateRef.current.yAxisState[touchState.axisIndex].max = touchState.startMax + shift;

            // Build yAxis update array based on device type
            const yAxisUpdates = isMobile
                ? [
                    { min: stateRef.current.yAxisState[0].min, max: stateRef.current.yAxisState[0].max },
                    { min: stateRef.current.yAxisState[1].min, max: stateRef.current.yAxisState[1].max },
                    { min: stateRef.current.yAxisState[2].min, max: stateRef.current.yAxisState[2].max },
                    { min: stateRef.current.yAxisState[3].min, max: stateRef.current.yAxisState[3].max }
                ]
                : [
                    { min: stateRef.current.yAxisState[0].min, max: stateRef.current.yAxisState[0].max },
                    { min: stateRef.current.yAxisState[1].min, max: stateRef.current.yAxisState[1].max },
                    { min: stateRef.current.yAxisState[2].min, max: stateRef.current.yAxisState[2].max },
                    { min: stateRef.current.yAxisState[3].min, max: stateRef.current.yAxisState[3].max },
                    { min: stateRef.current.yAxisState[4].min, max: stateRef.current.yAxisState[4].max },
                    { min: stateRef.current.yAxisState[5].min, max: stateRef.current.yAxisState[5].max }
                ];

            chartInstanceRef.current.setOption({ yAxis: yAxisUpdates });
        };

        const handleTouchEnd = () => {
            touchState.active = false;
        };

        chartRef.current.addEventListener('touchstart', handleTouchStart, { passive: false });
        chartRef.current.addEventListener('touchmove', handleTouchMove, { passive: false });
        chartRef.current.addEventListener('touchend', handleTouchEnd);

        return () => {
            if (chartRef.current) {
                chartRef.current.removeEventListener('touchstart', handleTouchStart);
                chartRef.current.removeEventListener('touchmove', handleTouchMove);
                chartRef.current.removeEventListener('touchend', handleTouchEnd);
            }
        };
    };

    // ────────────────────────────────────────────────────────────
    // CHART INITIALIZATION
    // ────────────────────────────────────────────────────────────

    const initializeChart = () => {
        if (!chartRef.current) return;

        chartInstanceRef.current = echarts.init(chartRef.current, null, {
            renderer: 'canvas',
            useDirtyRect: false
        });

        const option = {
            backgroundColor: CONFIG.COLORS.BG,
            animation: false,

            axisPointer: {
                link: [{ xAxisIndex: 'all' }],
                label: { backgroundColor: '#777' }
            },

            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' },
                formatter: () => ''
            },

            title: (() => {
                // Desktop: All 5 titles
                if (!isMobile && !isTablet) {
                    return [
                        { text: 'Price and CVD', left: 75, top: '3%', textStyle: { color: '#8b93a0', fontSize: 11, fontWeight: 'normal' } },
                        { text: 'Order Flow', left: 75, top: '54%', textStyle: { color: '#8b93a0', fontSize: 11, fontWeight: 'normal' } },
                        { text: 'V2 Weighted Directional', left: 75, top: '65%', textStyle: { color: '#a855f7', fontSize: 11, fontWeight: 'normal' } },
                        { text: 'V3 Momentum Directional', left: 75, top: '77%', textStyle: { color: '#00f0ff', fontSize: 11, fontWeight: 'normal' } },
                        { text: 'V1 Simple Cumulative', left: 75, top: '89%', textStyle: { color: '#fbbf24', fontSize: 11, fontWeight: 'normal' } }
                    ];
                }
                // Tablet: All 5 titles with adjusted positions
                if (isTablet) {
                    return [
                        { text: 'Price and CVD', left: 75, top: '3%', textStyle: { color: '#8b93a0', fontSize: 11, fontWeight: 'normal' } },
                        { text: 'Order Flow', left: 75, top: '56%', textStyle: { color: '#8b93a0', fontSize: 11, fontWeight: 'normal' } },
                        { text: 'V2 Weighted', left: 75, top: '66%', textStyle: { color: '#a855f7', fontSize: 10, fontWeight: 'normal' } },
                        { text: 'V3 Momentum', left: 75, top: '77%', textStyle: { color: '#00f0ff', fontSize: 10, fontWeight: 'normal' } },
                        { text: 'V1 Cumulative', left: 75, top: '88%', textStyle: { color: '#fbbf24', fontSize: 10, fontWeight: 'normal' } }
                    ];
                }
                // Mobile: Only 3 titles (Price, OrderFlow, V3)
                return [
                    { text: 'Price and CVD', left: 75, top: '3%', textStyle: { color: '#8b93a0', fontSize: 11, fontWeight: 'normal' } },
                    { text: 'Order Flow', left: 75, top: '55%', textStyle: { color: '#8b93a0', fontSize: 11, fontWeight: 'normal' } },
                    { text: 'V3 Momentum', left: 75, top: '72%', textStyle: { color: '#00f0ff', fontSize: 11, fontWeight: 'normal' } }
                ];
            })(),

            dataZoom: [
                {
                    type: 'inside',
                    xAxisIndex: isMobile ? [0, 1, 2] : [0, 1, 2, 3, 4],
                    start: 0,
                    end: 100,
                    minValueSpan: isMobile ? 3 : 5,
                    zoomOnMouseWheel: true,  // Abilita sempre zoom con rotella mouse
                    moveOnMouseWheel: false,
                    preventDefaultMouseMove: true,
                    throttle: 100
                },
                {
                    type: 'slider',
                    xAxisIndex: isMobile ? [0, 1, 2] : [0, 1, 2, 3, 4],
                    bottom: isMobile ? 1 : 0.5,
                    height: isMobile ? 25 : 18,
                    handleSize: isMobile ? '120%' : '100%',
                    borderColor: '#454d5f',
                    fillerColor: 'rgba(0, 240, 255, 0.1)',
                    handleStyle: {
                        color: '#00f0ff',
                        borderColor: '#00f0ff',
                        borderWidth: isMobile ? 2 : 1
                    },
                    moveHandleSize: isMobile ? 10 : 7,
                    textStyle: { color: '#8b93a0', fontSize: isMobile ? 10 : 11 }
                }
            ],

            grid: GRIDS.map(g => ({
                left: isMobile ? 50 : isTablet ? 48 : 45,
                right: isMobile ? 50 : isTablet ? 48 : 45,
                top: g.top + '%',
                height: g.height + '%',
                show: true,
                borderColor: '#2a2e39',
                backgroundColor: CONFIG.COLORS.BG,
                containLabel: false
            })),

            xAxis: (isMobile ? [0, 1, 2] : [0, 1, 2, 3, 4]).map(i => ({
                type: 'category', gridIndex: i, data: [],
                axisLine: { lineStyle: { color: '#454d5f' } },
                axisLabel: {
                    show: i === (isMobile ? 2 : 4),  // Show on last grid
                    color: '#8b93a0',
                    fontSize: 10,
                    formatter: (v) => {
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
                axisTick: { show: i === (isMobile ? 2 : 4), lineStyle: { color: '#454d5f' } },
                splitLine: { show: false },
                axisPointer: {
                    label: {
                        show: i === (isMobile ? 2 : 4),
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

            yAxis: (() => {
                // Mobile: 4 axes (Price, CVD, OrderFlow, V3)
                if (isMobile) {
                    return [
                        { type: 'value', gridIndex: 0, scale: true, position: 'right', axisLine: { lineStyle: { color: '#454d5f' } }, axisLabel: { color: '#8b93a0', fontSize: 10, formatter: (v) => v.toFixed(0) }, splitLine: { show: false } },
                        { type: 'value', gridIndex: 0, scale: true, position: 'left', axisLine: { lineStyle: { color: '#454d5f' } }, axisLabel: { show: true, color: CONFIG.COLORS.CVD_UP, fontSize: 10, formatter: (v) => v.toFixed(0) }, splitLine: { lineStyle: { color: '#1e232b' } } },
                        { type: 'value', gridIndex: 1, axisLine: { lineStyle: { color: '#454d5f' } }, axisLabel: { color: '#8b93a0', fontSize: 10, formatter: (v) => v.toFixed(2) }, splitLine: { lineStyle: { color: '#1e232b' } } },
                        { type: 'value', gridIndex: 2, axisLine: { lineStyle: { color: '#454d5f' } }, axisLabel: { color: '#00f0ff', fontSize: 10, formatter: (v) => v.toFixed(1) }, splitLine: { lineStyle: { color: '#1e232b' } } }
                    ];
                }
                // Desktop/Tablet: All 6 axes
                return [
                    { type: 'value', gridIndex: 0, scale: true, position: 'right', axisLine: { lineStyle: { color: '#454d5f' } }, axisLabel: { color: '#8b93a0', fontSize: 10, formatter: (v) => v.toFixed(0) }, splitLine: { show: false } },
                    { type: 'value', gridIndex: 0, scale: true, position: 'left', axisLine: { lineStyle: { color: '#454d5f' } }, axisLabel: { show: true, color: CONFIG.COLORS.CVD_UP, fontSize: 10, formatter: (v) => v.toFixed(0) }, splitLine: { lineStyle: { color: '#1e232b' } } },
                    { type: 'value', gridIndex: 1, axisLine: { lineStyle: { color: '#454d5f' } }, axisLabel: { color: '#8b93a0', fontSize: 10, formatter: (v) => v.toFixed(2) }, splitLine: { lineStyle: { color: '#1e232b' } } },
                    { type: 'value', gridIndex: 2, axisLine: { lineStyle: { color: '#454d5f' } }, axisLabel: { color: '#a855f7', fontSize: 10, formatter: (v) => v.toFixed(1) }, splitLine: { lineStyle: { color: '#1e232b' } } },
                    { type: 'value', gridIndex: 3, axisLine: { lineStyle: { color: '#454d5f' } }, axisLabel: { color: '#00f0ff', fontSize: 10, formatter: (v) => v.toFixed(1) }, splitLine: { lineStyle: { color: '#1e232b' } } },
                    { type: 'value', gridIndex: 4, axisLine: { lineStyle: { color: '#454d5f' } }, axisLabel: { color: '#fbbf24', fontSize: 10, formatter: (v) => v.toFixed(1) }, splitLine: { lineStyle: { color: '#1e232b' } } }
                ];
            })(),

            series: (() => {
                // Base series (always shown)
                const baseSeries = [
                    { name: 'Price', type: 'candlestick', data: [], xAxisIndex: 0, yAxisIndex: 0, clip: true, itemStyle: { color: CONFIG.COLORS.PRICE_UP, color0: CONFIG.COLORS.PRICE_DOWN, borderColor: CONFIG.COLORS.PRICE_UP, borderColor0: CONFIG.COLORS.PRICE_DOWN } },
                    { name: 'CVD', type: 'candlestick', data: [], xAxisIndex: 0, yAxisIndex: 1, clip: true, itemStyle: { color: CONFIG.COLORS.CVD_UP, color0: CONFIG.COLORS.CVD_DOWN, borderColor: 'rgba(255, 255, 255, 0.2)', borderColor0: 'rgba(255, 255, 255, 0.2)' } },
                    { name: 'Volume Buy', type: 'bar', data: [], xAxisIndex: 1, yAxisIndex: 2, stack: 'volume', clip: true, itemStyle: { color: CONFIG.COLORS.VOL_UP }, barMaxWidth: 20 },
                    { name: 'Volume Sell', type: 'bar', data: [], xAxisIndex: 1, yAxisIndex: 2, stack: 'volume', clip: true, itemStyle: { color: CONFIG.COLORS.VOL_DOWN }, barMaxWidth: 20 }
                ];

                // Mobile: Only V3 (index 2 on mobile grids)
                if (isMobile) {
                    return [
                        ...baseSeries,
                        {
                            name: 'V3 Momentum',
                            type: 'line',
                            data: [],
                            xAxisIndex: 2,
                            yAxisIndex: 3,
                            clip: true,
                            lineStyle: { color: '#00f0ff', width: 2 },
                            areaStyle: { color: 'rgba(0, 240, 255, 0.15)' },
                            showSymbol: false,
                            smooth: 0.3
                        }
                    ];
                }

                // Desktop/Tablet: All series (V2, V3, V1)
                return [
                    ...baseSeries,
                    {
                        name: 'V2 Weighted',
                        type: 'line',
                        data: [],
                        xAxisIndex: 2,
                        yAxisIndex: 3,
                        clip: true,
                        lineStyle: { color: '#a855f7', width: 2 },
                        areaStyle: { color: 'rgba(168, 85, 247, 0.15)' },
                        showSymbol: false,
                        smooth: 0.3
                    },
                    {
                        name: 'V3 Momentum',
                        type: 'line',
                        data: [],
                        xAxisIndex: 3,
                        yAxisIndex: 4,
                        clip: true,
                        lineStyle: { color: '#00f0ff', width: 2 },
                        areaStyle: { color: 'rgba(0, 240, 255, 0.15)' },
                        showSymbol: false,
                        smooth: 0.3
                    },
                    {
                        name: 'V1 Cumulative',
                        type: 'line',
                        data: [],
                        xAxisIndex: 4,
                        yAxisIndex: 5,
                        clip: true,
                        lineStyle: { color: '#fbbf24', width: 2 },
                        areaStyle: { color: 'rgba(251, 191, 36, 0.15)' },
                        showSymbol: false,
                        smooth: 0.3
                    }
                ];
            })()
        };

        chartInstanceRef.current.setOption(option);

        // Smart Scaling on Zoom
        chartInstanceRef.current.on('dataZoom', () => {
            handleSmartScaling();
        });

        // Setup interactions
        setupInteractions();

        // Click handler for trade entry
        chartInstanceRef.current.on('click', (params) => {
            if (params.componentType === 'series' && params.seriesName === 'Price') {
                onChartClick && onChartClick(params);
            }
        });

        // Setup touch interactions for mobile/tablet
        let touchCleanup = null;
        if (isMobile || isTablet) {
            touchCleanup = setupTouchInteraction();
        }

        // Window resize
        const handleResize = () => {
            chartInstanceRef.current && chartInstanceRef.current.resize();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (touchCleanup) touchCleanup();
        };
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

        const option = {
            xAxis: isMobile
                ? [
                    { data: processed.timestamps },
                    { data: processed.timestamps },
                    { data: processed.timestamps }
                ]
                : [
                    { data: processed.timestamps },
                    { data: processed.timestamps },
                    { data: processed.timestamps },
                    { data: processed.timestamps },
                    { data: processed.timestamps }
                ],
            yAxis: isMobile
                ? [
                    { min: stateRef.current.yAxisState[0].auto ? null : stateRef.current.yAxisState[0].min, max: stateRef.current.yAxisState[0].auto ? null : stateRef.current.yAxisState[0].max },
                    { min: stateRef.current.yAxisState[1].auto ? null : stateRef.current.yAxisState[1].min, max: stateRef.current.yAxisState[1].auto ? null : stateRef.current.yAxisState[1].max },
                    { min: stateRef.current.yAxisState[2].auto ? null : stateRef.current.yAxisState[2].min, max: stateRef.current.yAxisState[2].auto ? null : stateRef.current.yAxisState[2].max },
                    { min: stateRef.current.yAxisState[3].auto ? null : stateRef.current.yAxisState[3].min, max: stateRef.current.yAxisState[3].auto ? null : stateRef.current.yAxisState[3].max }
                ]
                : [
                    { min: stateRef.current.yAxisState[0].auto ? null : stateRef.current.yAxisState[0].min, max: stateRef.current.yAxisState[0].auto ? null : stateRef.current.yAxisState[0].max },
                    { min: stateRef.current.yAxisState[1].auto ? null : stateRef.current.yAxisState[1].min, max: stateRef.current.yAxisState[1].auto ? null : stateRef.current.yAxisState[1].max },
                    { min: stateRef.current.yAxisState[2].auto ? null : stateRef.current.yAxisState[2].min, max: stateRef.current.yAxisState[2].auto ? null : stateRef.current.yAxisState[2].max },
                    { min: stateRef.current.yAxisState[3].auto ? null : stateRef.current.yAxisState[3].min, max: stateRef.current.yAxisState[3].auto ? null : stateRef.current.yAxisState[3].max },
                    { min: stateRef.current.yAxisState[4].auto ? null : stateRef.current.yAxisState[4].min, max: stateRef.current.yAxisState[4].auto ? null : stateRef.current.yAxisState[4].max },
                    { min: stateRef.current.yAxisState[5].auto ? null : stateRef.current.yAxisState[5].min, max: stateRef.current.yAxisState[5].auto ? null : stateRef.current.yAxisState[5].max }
                ],
            series: isMobile
                ? [
                    { data: processed.candles, markPoint: { data: processed.markers } },
                    { data: processed.cvdCandles },
                    { data: processed.volumeBuy },
                    { data: processed.volumeSell },
                    { data: processed.cumulative_v3 || [] }
                ]
                : [
                    { data: processed.candles, markPoint: { data: processed.markers } },
                    { data: processed.cvdCandles },
                    { data: processed.volumeBuy },
                    { data: processed.volumeSell },
                    { data: processed.cumulative_v2 || [] },
                    { data: processed.cumulative_v3 || [] },
                    { data: processed.cumulative_v1 || [] }
                ]
        };

        chartInstanceRef.current.setOption(option, false);

        // Restore or Init Zoom
        if (currentZoom) {
            chartInstanceRef.current.setOption({ dataZoom: [{ start: currentZoom.start, end: currentZoom.end }] });
        } else if (stateRef.current.viewState.isFirstLoad) {
            stateRef.current.viewState.isFirstLoad = false;
        }

        stateRef.current.lastData = processed;

        // Trigger Smart Scaling
        handleSmartScaling();

        // Render trade boxes immediately after data update (for smooth playback)
        renderTradeBoxes();
    };

    // ────────────────────────────────────────────────────────────
    // TRADE BOX OVERLAY - Synchronous rendering for smooth playback
    // ────────────────────────────────────────────────────────────

    const renderTradeBoxes = () => {
        if (!chartInstanceRef.current || !data || !data.price_ohlc?.index) {
            return;
        }

        // Helper: Find candle index by timestamp (stable across data updates)
        const findIndexByTimestamp = (timestamp) => {
            if (!timestamp) return -1;
            const idx = data.price_ohlc.index.findIndex(ts => ts === timestamp);
            if (idx === -1) {
                console.error('[BacktestChart] Timestamp NOT FOUND:', {
                    searchingFor: timestamp,
                    availableTimestamps: data.price_ohlc.index.slice(0, 5),
                    totalAvailable: data.price_ohlc.index.length
                });
            }
            return idx;
        };

        // Collect all trades to render (active + closed)
        const tradesToRender = [];

        // Add active trade if exists
        if (activeTrade) {
            tradesToRender.push(activeTrade);
        }

        // Add all closed trades from history
        tradeHistory.forEach(trade => {
            tradesToRender.push(trade);
        });

        // If no trades, clear graphics
        if (tradesToRender.length === 0) {
            chartInstanceRef.current.setOption({
                graphic: { elements: [] }
            });
            return;
        }

        const allElements = [];

        try {
            tradesToRender.forEach((trade, idx) => {
                const { entryTimestamp, entryPrice, tp, sl, direction, exitTimestamp } = trade;

                // Find indices using timestamp matching (stable across data updates)
                const entryIndex = findIndexByTimestamp(entryTimestamp);
                if (entryIndex === -1) return;  // Entry not in visible range, skip trade

                // If trade has exitTimestamp (closed), find that index; otherwise use last visible candle
                const endIndex = exitTimestamp
                    ? findIndexByTimestamp(exitTimestamp)
                    : data.price_ohlc.index.length - 1;

                if (endIndex === -1) return;  // Exit not in visible range (shouldn't happen but safety check)
                const endPrice = data.price_ohlc.data.close[endIndex];

                // Use chart coordinate system for position calculations
                const entryCoord = chartInstanceRef.current.convertToPixel(
                    { seriesIndex: 0 },
                    [entryIndex, entryPrice]
                );
                const currentCoord = chartInstanceRef.current.convertToPixel(
                    { seriesIndex: 0 },
                    [endIndex, endPrice]
                );
                const tpCoord = chartInstanceRef.current.convertToPixel(
                    { seriesIndex: 0 },
                    [endIndex, tp]
                );
                const slCoord = chartInstanceRef.current.convertToPixel(
                    { seriesIndex: 0 },
                    [endIndex, sl]
                );

                if (!entryCoord || !currentCoord || !tpCoord || !slCoord) {
                    return; // Skip this trade if coordinates invalid
                }

                const chartWidth = chartInstanceRef.current.getWidth() - 60;

                // Get price grid bounds for clipping
                const priceGrid = chartInstanceRef.current.getModel().getComponent('grid', 0);
                const gridRect = priceGrid.coordinateSystem.getRect();

                // Add elements for this trade
                allElements.push(
                        // Entry point marker
                        {
                            type: 'circle',
                            position: entryCoord,
                            shape: { r: 5 },
                            style: {
                                fill: direction === 'long' ? '#22c55e' : '#ef4444',
                                stroke: '#fff',
                                lineWidth: 2
                            },
                            z: 100,
                            clipPath: {
                                type: 'rect',
                                shape: {
                                    x: gridRect.x,
                                    y: gridRect.y,
                                    width: gridRect.width,
                                    height: gridRect.height
                                }
                            }
                        },
                        // TP Box (green) - from entry to TP
                        {
                            type: 'rect',
                            shape: {
                                x: entryCoord[0],
                                y: Math.min(entryCoord[1], tpCoord[1]),
                                width: Math.max(0, currentCoord[0] - entryCoord[0]),
                                height: Math.abs(tpCoord[1] - entryCoord[1])
                            },
                            style: {
                                fill: 'rgba(34, 197, 94, 0.12)',
                                stroke: '#22c55e',
                                lineWidth: 1,
                                opacity: 0.5
                            },
                            z: 97,
                            clipPath: {
                                type: 'rect',
                                shape: {
                                    x: gridRect.x,
                                    y: gridRect.y,
                                    width: gridRect.width,
                                    height: gridRect.height
                                }
                            }
                        },
                        // SL Box (red) - from entry to SL
                        {
                            type: 'rect',
                            shape: {
                                x: entryCoord[0],
                                y: Math.min(entryCoord[1], slCoord[1]),
                                width: Math.max(0, currentCoord[0] - entryCoord[0]),
                                height: Math.abs(slCoord[1] - entryCoord[1])
                            },
                            style: {
                                fill: 'rgba(239, 68, 68, 0.12)',
                                stroke: '#ef4444',
                                lineWidth: 1,
                                opacity: 0.5
                            },
                            z: 97,
                            clipPath: {
                                type: 'rect',
                                shape: {
                                    x: gridRect.x,
                                    y: gridRect.y,
                                    width: gridRect.width,
                                    height: gridRect.height
                                }
                            }
                        }
                );
            });

            // Set all elements at once
            chartInstanceRef.current.setOption({
                graphic: {
                    elements: allElements
                }
            }, { replaceMerge: ['graphic'] });

        } catch (e) {
            console.error('[BacktestChart] Trade box rendering error:', e);
        }
    };

    // Update trade boxes when trades or data change
    useEffect(() => {
        renderTradeBoxes();
    }, [activeTrade, tradeHistory, data]);

    // Re-render trade boxes on zoom/pan (dataZoom event)
    useEffect(() => {
        if (!chartInstanceRef.current) return;

        const handleDataZoom = () => {
            renderTradeBoxes();
        };

        chartInstanceRef.current.on('dataZoom', handleDataZoom);

        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.off('dataZoom', handleDataZoom);
            }
        };
    }, [activeTrade, tradeHistory, data]);

    // ────────────────────────────────────────────────────────────
    // CURSOR STYLE
    // ────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!chartInstanceRef.current) return;
        const zr = chartInstanceRef.current.getZr();
        if (zr) {
            zr.setCursorStyle(tradeMode ? 'crosshair' : 'default');
        }
    }, [tradeMode]);

    // ────────────────────────────────────────────────────────────
    // LIFECYCLE
    // ────────────────────────────────────────────────────────────

    useEffect(() => {
        const cleanup = initializeChart();
        return () => {
            cleanup && cleanup();
            chartInstanceRef.current && chartInstanceRef.current.dispose();
        };
    }, []);

    useEffect(() => {
        if (data && chartInstanceRef.current) {
            updateChart(data);
        }
    }, [data]);

    // Memoize zone bands calculation to avoid recalculating on every render
    // Only recalculate when historicalZones change or when data index changes (new candle)
    const zoneBands = useMemo(() => {
        if (!data?.price_ohlc?.index || !historicalZones || historicalZones.length === 0) {
            return { v2: [], v3: [] };
        }

        // Get timestamps from current data
        const timestamps = data.price_ohlc.index;

        // Calculate markArea bands with temporal ranges
        const v2Bands = calculateHistoricalZoneBands(historicalZones, 'cumulative_v2', timestamps);
        const v3Bands = calculateHistoricalZoneBands(historicalZones, 'cumulative_v3', timestamps);

        return { v2: v2Bands, v3: v3Bands };
    }, [
        historicalZones,
        data?.price_ohlc?.index?.length,  // Only when number of candles changes
        data?.price_ohlc?.index?.[data?.price_ohlc?.index?.length - 1]  // Or when last timestamp changes
    ]);

    // Update zones when zoneBands change
    useEffect(() => {
        if (!chartInstanceRef.current) return;

        // Mobile: Only V3 zones (series index 4)
        // Desktop: V2 (index 4), V3 (index 5)
        if (isMobile) {
            chartInstanceRef.current.setOption({
                series: [
                    {}, // Price (index 0) - no changes
                    {}, // CVD (index 1) - no changes
                    {}, // Volume Buy (index 2) - no changes
                    {}, // Volume Sell (index 3) - no changes
                    { markArea: { data: zoneBands.v3, silent: true } } // V3 Momentum (index 4 on mobile)
                ]
            }, false);
        } else {
            chartInstanceRef.current.setOption({
                series: [
                    {}, // Price (index 0) - no changes
                    {}, // CVD (index 1) - no changes
                    {}, // Volume Buy (index 2) - no changes
                    {}, // Volume Sell (index 3) - no changes
                    { markArea: { data: zoneBands.v2, silent: true } }, // V2 Weighted (index 4)
                    { markArea: { data: zoneBands.v3, silent: true } }, // V3 Momentum (index 5)
                    {} // V1 Cumulative (index 6) - no changes
                ]
            }, false);
        }
    }, [zoneBands, isMobile]);

    // ────────────────────────────────────────────────────────────
    // RENDER
    // ────────────────────────────────────────────────────────────

    return (
        <div
            ref={chartRef}
            style={{ width: '100%', height: '100%' }}
        />
    );
};

export default BacktestChart;
