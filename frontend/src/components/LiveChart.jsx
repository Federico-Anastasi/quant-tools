// ═══════════════════════════════════════════════════════════
// LIVE CHART - 4 Grid Layout (Price, Order Flow, V3 Momentum, Equity)
// Trade boxes overlay for live position visualization
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
        VOL_UP: '#00f0ff',
        VOL_DOWN: '#ffcc00',
        V3: '#ffcc00',
        EQUITY: '#00f0ff'
    },
    // 4 Grids: Price (55%), Order Flow (15%), V3 Momentum (12%), Equity (10%)
    GRIDS: [
        { id: 'price', top: 2, height: 55, axisIndex: [0] },     // Candlestick
        { id: 'vol', top: 58, height: 15, axisIndex: [1] },      // Order Flow
        { id: 'v3', top: 74, height: 12, axisIndex: [2] },       // V3 Momentum
        { id: 'equity', top: 87, height: 10, axisIndex: [3] }    // Equity Curve
    ],
    AXIS_WIDTH: 60
};

/**
 * LiveChart - 4-grid chart with trade box overlay
 * @param {Object} data - Chart data (price_ohlc, vol_buy, vol_sell, momentum_v3_segments)
 * @param {Object} zonesData - Zone data from API
 * @param {Object} position - Current open position
 * @param {Array} trades - Live trades history
 * @param {Object} equityCurve - Equity curve data {snapshots: [{timestamp, equity}]}
 */
const LiveChart = ({ data, zonesData, position, trades = [], equityCurve = null }) => {
    const chartRef = useRef(null);
    const chartInstanceRef = useRef(null);
    const isFirstLoadRef = useRef(true);
    const yAxisStateRef = useRef({
        0: { min: null, max: null },
        1: { min: null, max: null },
        2: { min: null, max: null },
        3: { min: null, max: null }
    });

    // ────────────────────────────────────────────────────────────
    // ZONE BANDS CALCULATION (V3 Only)
    // ────────────────────────────────────────────────────────────

    const calculateV3ZoneBands = (zoneInfo) => {
        if (!zoneInfo) return [];

        const { is_long, zone_min, zone_max } = zoneInfo;
        const bands = [];

        // Primary zone
        const primaryColor = is_long ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)';
        bands.push([
            { yAxis: zone_min, itemStyle: { color: primaryColor } },
            { yAxis: zone_max }
        ]);

        // Symmetric zone
        const symColor = is_long ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)';
        bands.push([
            { yAxis: -zone_max, itemStyle: { color: symColor } },
            { yAxis: -zone_min }
        ]);

        return bands;
    };

    // ────────────────────────────────────────────────────────────
    // DATA PROCESSING
    // ────────────────────────────────────────────────────────────

    const processData = (rawData, equityData) => {
        if (!rawData.price_ohlc || !rawData.price_ohlc.index) return null;

        const timestamps = [...rawData.price_ohlc.index];
        const count = timestamps.length;

        // DEBUG: Log equity data
        if (equityData) {
            console.log('[LiveChart] Equity data received:', {
                snapshotCount: equityData.snapshots?.length,
                firstSnapshot: equityData.snapshots?.[0],
                timestampCount: count,
                firstTimestamp: timestamps[0]
            });
        }

        const processed = {
            timestamps: timestamps,
            candles: [],
            volumeBuy: [],
            volumeSell: [],
            cumulative_v3: [],
            equity: []
        };

        for (let i = 0; i < count; i++) {
            // Price candles
            if (rawData.price_ohlc.data?.open) {
                processed.candles.push([
                    rawData.price_ohlc.data.open[i],
                    rawData.price_ohlc.data.close[i],
                    rawData.price_ohlc.data.low[i],
                    rawData.price_ohlc.data.high[i]
                ]);
            }

            // Volume
            const volBuy = rawData.vol_buy?.values?.[i] || 0;
            const volSell = rawData.vol_sell?.values?.[i] || 0;
            processed.volumeBuy.push(volBuy);
            processed.volumeSell.push(-volSell);
        }

        // V3 Momentum
        if (rawData.momentum_v3_segments && Array.isArray(rawData.momentum_v3_segments)) {
            const v3Map = new Map();
            rawData.momentum_v3_segments.forEach(seg => {
                if (!seg.index || !seg.values) return;
                for (let j = 0; j < seg.index.length; j++) {
                    v3Map.set(seg.index[j], seg.values[j]);
                }
            });
            timestamps.forEach(ts => processed.cumulative_v3.push(v3Map.get(ts) || 0));
        }

        // Equity Curve (Forward-Fill Algorithm)
        if (equityData && equityData.snapshots && Array.isArray(equityData.snapshots)) {
            // Sort snapshots by timestamp ascending
            const sortedSnapshots = [...equityData.snapshots]
                .filter(s => s.timestamp && s.equity !== undefined)
                .map(s => ({
                    timestamp: new Date(s.timestamp).getTime(),
                    equity: s.equity
                }))
                .sort((a, b) => a.timestamp - b.timestamp);

            console.log('[LiveChart] Equity snapshots:', {
                count: sortedSnapshots.length,
                firstTs: new Date(sortedSnapshots[0]?.timestamp).toISOString(),
                lastTs: new Date(sortedSnapshots[sortedSnapshots.length - 1]?.timestamp).toISOString()
            });

            // Forward-fill: For each candle timestamp, find the last equity snapshot <= that time
            let snapshotIdx = 0;
            let lastEquity = null;

            timestamps.forEach(ts => {
                const candleTime = new Date(ts).getTime();

                // Advance snapshot index while snapshot is before or at candle time
                while (snapshotIdx < sortedSnapshots.length &&
                       sortedSnapshots[snapshotIdx].timestamp <= candleTime) {
                    lastEquity = sortedSnapshots[snapshotIdx].equity;
                    snapshotIdx++;
                }

                // Use last known equity value (forward-fill)
                processed.equity.push(lastEquity);
            });

            // DEBUG: Log matching results
            const nonNullCount = processed.equity.filter(v => v !== null).length;
            console.log('[LiveChart] Equity forward-fill:', {
                totalPoints: processed.equity.length,
                nonNullPoints: nonNullCount,
                matchRate: `${((nonNullCount / processed.equity.length) * 100).toFixed(1)}%`,
                firstCandle: timestamps[0],
                lastCandle: timestamps[timestamps.length - 1],
                sampleValues: processed.equity.slice(0, 10)
            });
        } else {
            // Fill with nulls if no equity data
            timestamps.forEach(() => processed.equity.push(null));
        }

        return processed;
    };

    // ────────────────────────────────────────────────────────────
    // TRADE BOXES RENDERING
    // ────────────────────────────────────────────────────────────

    /**
     * Render trade boxes (TP/SL zones) on price chart
     * For open position: draw from entry to current price
     * For closed trades: draw from entry to exit
     */
    const renderTradeBoxes = (chart, processedData, currentPosition, tradeHistory) => {
        if (!chart || !processedData) return;

        const allElements = [];
        const timestamps = processedData.timestamps;

        // Helper: Find closest index for a timestamp
        const findClosestIndex = (targetTime) => {
            const target = new Date(targetTime).getTime();
            let closestIdx = 0;
            let minDiff = Infinity;

            for (let i = 0; i < timestamps.length; i++) {
                const candleTime = new Date(timestamps[i]).getTime();
                const diff = Math.abs(candleTime - target);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestIdx = i;
                }
            }
            return closestIdx;
        };

        // Get current price (last candle close)
        const currentPrice = processedData.candles[processedData.candles.length - 1]?.[1] || 0;
        const currentIndex = timestamps.length - 1;

        // 1. Render open position (if exists)
        if (currentPosition && currentPosition.has_position === true) {
            const entryIndex = findClosestIndex(currentPosition.entry_time || timestamps[currentIndex]);
            const entryPrice = currentPosition.entry_price ?? 0;
            const tpPrice = currentPosition.tp_price ?? null;
            const slPrice = currentPosition.sl_price ?? null;

            const entryCoord = chart.convertToPixel({ seriesIndex: 0 }, [entryIndex, entryPrice]);
            const currentCoord = chart.convertToPixel({ seriesIndex: 0 }, [currentIndex, currentPrice]);

            // TP box (green)
            if (tpPrice && tpPrice > 0) {
                const tpCoord = chart.convertToPixel({ seriesIndex: 0 }, [currentIndex, tpPrice]);
                allElements.push({
                    type: 'rect',
                    shape: {
                        x: entryCoord[0],
                        y: Math.min(entryCoord[1], tpCoord[1]),
                        width: currentCoord[0] - entryCoord[0],
                        height: Math.abs(tpCoord[1] - entryCoord[1])
                    },
                    style: {
                        fill: 'rgba(34, 197, 94, 0.12)',
                        stroke: '#22c55e',
                        lineWidth: 1
                    },
                    z: 1
                });
            }

            // SL box (red)
            if (slPrice && slPrice > 0) {
                const slCoord = chart.convertToPixel({ seriesIndex: 0 }, [currentIndex, slPrice]);
                allElements.push({
                    type: 'rect',
                    shape: {
                        x: entryCoord[0],
                        y: Math.min(entryCoord[1], slCoord[1]),
                        width: currentCoord[0] - entryCoord[0],
                        height: Math.abs(slCoord[1] - entryCoord[1])
                    },
                    style: {
                        fill: 'rgba(239, 68, 68, 0.12)',
                        stroke: '#ef4444',
                        lineWidth: 1
                    },
                    z: 1
                });
            }

            // Entry line (white dashed)
            allElements.push({
                type: 'line',
                shape: {
                    x1: entryCoord[0],
                    y1: entryCoord[1],
                    x2: currentCoord[0],
                    y2: entryCoord[1]
                },
                style: {
                    stroke: '#ffffff',
                    lineWidth: 1,
                    lineDash: [5, 5]
                },
                z: 2
            });
        }

        // 2. Render closed trades history (last 10 trades)
        const recentTrades = tradeHistory
            .filter(t => t.status === 'closed' && t.exit_time && t.entry_price && t.exit_price)
            .slice(0, 10);

        recentTrades.forEach(trade => {
            if (!trade.entry_time || !trade.exit_time) return;

            const entryIndex = findClosestIndex(trade.entry_time);
            const exitIndex = findClosestIndex(trade.exit_time);
            const entryPrice = trade.entry_price ?? 0;
            const exitPrice = trade.exit_price ?? 0;

            const entryCoord = chart.convertToPixel({ seriesIndex: 0 }, [entryIndex, entryPrice]);
            const exitCoord = chart.convertToPixel({ seriesIndex: 0 }, [exitIndex, exitPrice]);

            // Trade box (green if profit, red if loss)
            const isProfit = (trade.side === 'LONG' && exitPrice > entryPrice) ||
                           (trade.side === 'SHORT' && exitPrice < entryPrice);

            const boxColor = isProfit ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)';
            const borderColor = isProfit ? '#22c55e' : '#ef4444';

            allElements.push({
                type: 'rect',
                shape: {
                    x: entryCoord[0],
                    y: Math.min(entryCoord[1], exitCoord[1]),
                    width: exitCoord[0] - entryCoord[0],
                    height: Math.abs(exitCoord[1] - entryCoord[1])
                },
                style: {
                    fill: boxColor,
                    stroke: borderColor,
                    lineWidth: 1,
                    opacity: 0.6
                },
                z: 0
            });
        });

        // Apply graphic elements (replace all to avoid type conflicts)
        chart.setOption({
            graphic: allElements.map(el => ({
                ...el,
                $action: 'replace'
            }))
        });
    };

    // ────────────────────────────────────────────────────────────
    // CHART INITIALIZATION (ONCE)
    // ────────────────────────────────────────────────────────────

    const initializeChart = () => {
        if (!chartRef.current) return;

        chartInstanceRef.current = echarts.init(chartRef.current, 'dark');

        const option = {
            backgroundColor: CONFIG.COLORS.BG,
            animation: false,
            dataZoom: [
                // X-axis: zoom with wheel + pan with drag
                {
                    type: 'inside',
                    xAxisIndex: [0, 1, 2, 3],
                    start: 0,
                    end: 100,
                    zoomOnMouseWheel: true,
                    moveOnMouseMove: true,
                    preventDefaultMouseMove: true
                }
            ],
            grid: CONFIG.GRIDS.map(g => ({
                left: CONFIG.AXIS_WIDTH,
                right: CONFIG.AXIS_WIDTH,
                top: `${g.top}%`,
                height: `${g.height}%`,
                containLabel: false
            })),
            xAxis: CONFIG.GRIDS.map((g, i) => ({
                type: 'category',
                data: [],  // Will be populated in updateChart
                gridIndex: i,
                axisLabel: {
                    show: i === CONFIG.GRIDS.length - 1,
                    color: CONFIG.COLORS.TEXT,
                    fontSize: 10,
                    formatter: (value) => {
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
                    }
                },
                axisLine: { lineStyle: { color: CONFIG.COLORS.GRID } },
                axisTick: { show: false },
                splitLine: { show: false }
            })),
            yAxis: [
                // 0: Price
                {
                    type: 'value',
                    gridIndex: 0,
                    position: 'right',
                    scale: true,
                    min: yAxisStateRef.current[0].min,
                    max: yAxisStateRef.current[0].max,
                    axisLabel: {
                        color: CONFIG.COLORS.TEXT,
                        fontSize: 10,
                        formatter: (val) => `$${val.toLocaleString()}`
                    },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    splitLine: { lineStyle: { color: CONFIG.COLORS.GRID, width: 1 } }
                },
                // 1: Order Flow (Volume)
                {
                    type: 'value',
                    gridIndex: 1,
                    position: 'right',
                    min: yAxisStateRef.current[1].min,
                    max: yAxisStateRef.current[1].max,
                    axisLabel: {
                        color: CONFIG.COLORS.TEXT,
                        fontSize: 10
                    },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    splitLine: { lineStyle: { color: CONFIG.COLORS.GRID, width: 1 } }
                },
                // 2: V3 Momentum
                {
                    type: 'value',
                    gridIndex: 2,
                    position: 'right',
                    min: yAxisStateRef.current[2].min,
                    max: yAxisStateRef.current[2].max,
                    axisLabel: {
                        color: CONFIG.COLORS.TEXT,
                        fontSize: 10
                    },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    splitLine: { lineStyle: { color: CONFIG.COLORS.GRID, width: 1 } }
                },
                // 3: Equity Curve
                {
                    type: 'value',
                    gridIndex: 3,
                    position: 'right',
                    scale: true,  // Auto-scaling intelligente
                    min: yAxisStateRef.current[3].min,
                    max: yAxisStateRef.current[3].max,
                    axisLabel: {
                        color: CONFIG.COLORS.TEXT,
                        fontSize: 10,
                        formatter: (val) => `$${val.toFixed(2)}`
                    },
                    axisLine: { show: false },
                    axisTick: { show: false },
                    splitLine: { lineStyle: { color: CONFIG.COLORS.GRID, width: 1 } }
                }
            ],
            series: [
                // Grid 0: Price Candlestick
                {
                    type: 'candlestick',
                    name: 'Price',
                    data: [],
                    xAxisIndex: 0,
                    yAxisIndex: 0,
                    itemStyle: {
                        color: CONFIG.COLORS.PRICE_UP,
                        color0: CONFIG.COLORS.PRICE_DOWN,
                        borderColor: CONFIG.COLORS.PRICE_UP,
                        borderColor0: CONFIG.COLORS.PRICE_DOWN
                    },
                    barWidth: '60%',
                    barMinWidth: 2
                },
                // Grid 1: Order Flow (Buy Volume)
                {
                    type: 'bar',
                    name: 'Buy Volume',
                    data: [],
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    itemStyle: { color: CONFIG.COLORS.VOL_UP },
                    barMaxWidth: 10
                },
                // Grid 1: Order Flow (Sell Volume)
                {
                    type: 'bar',
                    name: 'Sell Volume',
                    data: [],
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    itemStyle: { color: CONFIG.COLORS.VOL_DOWN },
                    barMaxWidth: 10
                },
                // Grid 2: V3 Momentum Line
                {
                    type: 'line',
                    name: 'V3 Momentum',
                    data: [],
                    xAxisIndex: 2,
                    yAxisIndex: 2,
                    lineStyle: { color: CONFIG.COLORS.V3, width: 2 },
                    itemStyle: { color: CONFIG.COLORS.V3 },
                    symbol: 'none'
                },
                // Grid 3: Equity Curve
                {
                    type: 'line',
                    name: 'Equity',
                    data: [],
                    xAxisIndex: 3,
                    yAxisIndex: 3,
                    lineStyle: { color: CONFIG.COLORS.EQUITY, width: 2 },
                    itemStyle: { color: CONFIG.COLORS.EQUITY },
                    symbol: 'none',
                    smooth: false,
                    connectNulls: true
                }
            ],
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' },
                backgroundColor: 'rgba(11, 14, 17, 0.95)',
                borderColor: CONFIG.COLORS.GRID,
                textStyle: { color: CONFIG.COLORS.TEXT }
            }
        };

        chartInstanceRef.current.setOption(option);

        // Setup Y-axis interactions (zoom on Y-axis wheel, pan with drag)
        const zr = chartInstanceRef.current.getZr();
        let dragState = { active: false, axisIndex: null, startY: 0, startMin: 0, startMax: 0 };

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

        // Wheel event for Y-axis zoom (when on Y-axis area)
        const handleWheel = (e) => {
            const rect = chartRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const width = chartInstanceRef.current.getWidth();

            // Check if mouse is on Y-axis area (right side, last 60px)
            if (x > width - CONFIG.AXIS_WIDTH) {
                e.preventDefault();
                e.stopPropagation();

                const gridIdx = getGridIndex(y);
                if (gridIdx === -1) return;

                const axisIndex = CONFIG.GRIDS[gridIdx].axisIndex[0];
                const model = chartInstanceRef.current.getModel().getComponent('yAxis', axisIndex);
                const extent = model.axis.scale.getExtent();
                const range = extent[1] - extent[0];
                const middle = (extent[0] + extent[1]) / 2;

                // Zoom 10% per scroll
                const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
                const newRange = range * zoomFactor;

                yAxisStateRef.current[axisIndex].min = middle - newRange / 2;
                yAxisStateRef.current[axisIndex].max = middle + newRange / 2;

                chartInstanceRef.current.setOption({
                    yAxis: [
                        { min: yAxisStateRef.current[0].min, max: yAxisStateRef.current[0].max },
                        { min: yAxisStateRef.current[1].min, max: yAxisStateRef.current[1].max },
                        { min: yAxisStateRef.current[2].min, max: yAxisStateRef.current[2].max },
                        { min: yAxisStateRef.current[3].min, max: yAxisStateRef.current[3].max }
                    ]
                });
            }
        };

        // Mouse down for drag pan
        zr.on('mousedown', (e) => {
            const x = e.offsetX;
            const y = e.offsetY;
            const width = zr.getWidth();

            // Check if on Y-axis area
            if (x > width - CONFIG.AXIS_WIDTH) {
                const gridIdx = getGridIndex(y);
                if (gridIdx === -1) return;

                const axisIndex = CONFIG.GRIDS[gridIdx].axisIndex[0];
                const model = chartInstanceRef.current.getModel().getComponent('yAxis', axisIndex);
                const extent = model.axis.scale.getExtent();

                dragState = {
                    active: true,
                    axisIndex: axisIndex,
                    startY: y,
                    startMin: extent[0],
                    startMax: extent[1]
                };

                zr.setCursorStyle('ns-resize');
                e.stop();
            }
        });

        // Mouse move for drag pan
        zr.on('mousemove', (e) => {
            const x = e.offsetX;
            const y = e.offsetY;
            const width = zr.getWidth();

            if (!dragState.active) {
                // Cursor feedback
                if (x > width - CONFIG.AXIS_WIDTH && getGridIndex(y) !== -1) {
                    zr.setCursorStyle('ns-resize');
                } else {
                    zr.setCursorStyle('default');
                }
                return;
            }

            // Execute drag pan
            const deltaY = e.offsetY - dragState.startY;
            const gridIdx = CONFIG.GRIDS.findIndex(g => g.axisIndex[0] === dragState.axisIndex);
            const gridHeight = (CONFIG.GRIDS[gridIdx].height / 100) * chartInstanceRef.current.getHeight();
            const range = dragState.startMax - dragState.startMin;
            const shift = (range / gridHeight) * deltaY;

            yAxisStateRef.current[dragState.axisIndex].min = dragState.startMin + shift;
            yAxisStateRef.current[dragState.axisIndex].max = dragState.startMax + shift;

            chartInstanceRef.current.setOption({
                yAxis: [
                    { min: yAxisStateRef.current[0].min, max: yAxisStateRef.current[0].max },
                    { min: yAxisStateRef.current[1].min, max: yAxisStateRef.current[1].max },
                    { min: yAxisStateRef.current[2].min, max: yAxisStateRef.current[2].max },
                    { min: yAxisStateRef.current[3].min, max: yAxisStateRef.current[3].max }
                ]
            });
        });

        // Mouse up to end drag
        zr.on('mouseup', () => {
            dragState.active = false;
            zr.setCursorStyle('default');
        });

        // Double click to reset zoom and pan
        zr.on('dblclick', () => {
            // Reset X-axis zoom (dataZoom)
            chartInstanceRef.current.setOption({
                dataZoom: [{ start: 0, end: 100 }]
            });

            // Reset Y-axis zoom/pan (manual min/max back to auto)
            yAxisStateRef.current[0].min = null;
            yAxisStateRef.current[0].max = null;
            yAxisStateRef.current[1].min = null;
            yAxisStateRef.current[1].max = null;
            yAxisStateRef.current[2].min = null;
            yAxisStateRef.current[2].max = null;
            yAxisStateRef.current[3].min = null;
            yAxisStateRef.current[3].max = null;

            chartInstanceRef.current.setOption({
                yAxis: [
                    { min: null, max: null },
                    { min: null, max: null },
                    { min: null, max: null },
                    { min: null, max: null }
                ]
            });
        });

        chartRef.current.addEventListener('wheel', handleWheel, { passive: false, capture: true });

        // Window resize
        const handleResize = () => {
            chartInstanceRef.current && chartInstanceRef.current.resize();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            chartRef.current && chartRef.current.removeEventListener('wheel', handleWheel);
            window.removeEventListener('resize', handleResize);
        };
    };

    // ────────────────────────────────────────────────────────────
    // CHART UPDATE
    // ────────────────────────────────────────────────────────────

    const updateChart = (rawData) => {
        if (!chartInstanceRef.current) return;

        const processedData = processData(rawData, equityCurve);
        if (!processedData) return;

        const v3Zones = zonesData?.cumulative_v3 || null;

        // Save zoom X BEFORE updating
        let currentXZoom = null;
        if (!isFirstLoadRef.current) {
            currentXZoom = chartInstanceRef.current.getOption().dataZoom?.[0];
        }

        const option = {
            xAxis: [
                { data: processedData.timestamps },
                { data: processedData.timestamps },
                { data: processedData.timestamps },
                { data: processedData.timestamps }
            ],
            yAxis: [
                { min: yAxisStateRef.current[0].min, max: yAxisStateRef.current[0].max },
                { min: yAxisStateRef.current[1].min, max: yAxisStateRef.current[1].max },
                { min: yAxisStateRef.current[2].min, max: yAxisStateRef.current[2].max },
                { min: yAxisStateRef.current[3].min, max: yAxisStateRef.current[3].max }
            ],
            series: [
                { data: processedData.candles },
                { data: processedData.volumeBuy },
                { data: processedData.volumeSell },
                {
                    data: processedData.cumulative_v3,
                    markArea: v3Zones ? {
                        silent: true,
                        data: calculateV3ZoneBands(v3Zones)
                    } : undefined
                },
                { data: processedData.equity }
            ]
        };

        chartInstanceRef.current.setOption(option, false);

        // Restore zoom X AFTER updating
        if (currentXZoom) {
            chartInstanceRef.current.setOption({
                dataZoom: [{ start: currentXZoom.start, end: currentXZoom.end }]
            });
        } else if (isFirstLoadRef.current) {
            isFirstLoadRef.current = false;
        }

        // Render trade boxes
        renderTradeBoxes(chartInstanceRef.current, processedData, position, trades);
    };

    // ────────────────────────────────────────────────────────────
    // LIFECYCLE
    // ────────────────────────────────────────────────────────────

    useEffect(() => {
        const cleanup = initializeChart();
        return () => {
            cleanup && cleanup();
        };
    }, []);

    useEffect(() => {
        if (data && chartInstanceRef.current) {
            updateChart(data);
        }
    }, [data, zonesData, position, trades, equityCurve]);

    // ────────────────────────────────────────────────────────────
    // CLEANUP
    // ────────────────────────────────────────────────────────────

    useEffect(() => {
        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.dispose();
                chartInstanceRef.current = null;
            }
        };
    }, []);

    return <div ref={chartRef} className="w-full h-full" />;
};

export default LiveChart;
