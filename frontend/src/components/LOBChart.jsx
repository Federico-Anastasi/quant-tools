import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';

/**
 * LOBChart - Live Limit Order Book Density Visualization
 *
 * Professional LOB heatmap visualization matching academic standards:
 * - Left panel (72%): Price candlesticks with V_diff heatmap overlay (Canvas 2D)
 *   - Above current price: RED gradient (resistance, negative V_diff)
 *   - Below current price: GREEN gradient (support, positive V_diff)
 * - Right panel (28%): Liquidity density profile (absolute magnitude)
 *
 * Based on "Effective Liquidity Density in Limit Order Books" methodology
 * V_diff = V_down - V_up (positive = support, negative = resistance)
 *
 * Heatmap Implementation: Canvas 2D Context for smooth gradients
 * Live updates every 5 seconds with current price marker
 */
const LOBChart = ({ priceData, lobData, priceBin = 50, onPriceBinChange = () => {} }) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const dataZoomStateRef = useRef(null);  // Preserve zoom state across updates

  // Heatmap mode: '1D' (latest snapshot only) or '2D' (temporal evolution)
  const [heatmapMode, setHeatmapMode] = useState('2D');

  // Axis drag state for manual control (both X and Y)
  const axisStateRef = useRef({
    // Y-axis state
    yMin: null,
    yMax: null,
    yAuto: true,
    // X-axis state
    xStart: 0,
    xEnd: 100,
    // Drag state
    dragging: false,
    dragMode: null,  // 'zoom' or 'pan'
    startX: 0,
    startY: 0,
    startYMin: 0,
    startYMax: 0,
    startXStart: 0,
    startXEnd: 0
  });

  // Touch state for mobile gestures
  const touchStateRef = useRef({
    touches: [],
    initialDistance: 0,
    initialYMin: null,
    initialYMax: null,
    initialXStart: null,
    initialXEnd: null,
    mode: null  // 'pan', 'pinch', or 'zoom-y'
  });

  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize ECharts
    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current, null, {
        renderer: 'canvas'
      });
    }

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!priceData || !lobData || !chartInstanceRef.current || !canvasRef.current) return;

    const chart = chartInstanceRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Extract price data - FIXED: timestamps are in price_ohlc.index, not priceData.timestamps
    const timestamps = priceData.price_ohlc?.index || [];
    const candles = [];
    if (priceData.price_ohlc?.data?.open) {
      const { open, close, low, high } = priceData.price_ohlc.data;
      for (let i = 0; i < open.length; i++) {
        candles.push([open[i], close[i], low[i], high[i]]);
      }
    }

    // Extract LOB density data from latest snapshot
    // Response format: { snapshots: [...], count: N }
    const latestSnapshot = lobData?.snapshots?.[lobData.snapshots.length - 1] || {};
    const {
      price_bins = [],
      V_diff = [],
      p_current: lobP_current
    } = latestSnapshot;

    // CRITICAL: Use actual current price from latest candle close (fallback to LOB p_current)
    const p_current = candles.length > 0 ? candles[candles.length - 1][1] : (lobP_current || 0);

    // Use V_diff directly (already raw from backend)
    const vDiffData = V_diff;

    if (candles.length === 0 || price_bins.length === 0 || vDiffData.length === 0) {
      return;
    }

    // Calculate price range from BOTH candles AND LOB price_bins
    const allCandlePrices = candles.flatMap(c => [c[0], c[1], c[2], c[3]]);
    const candleMin = Math.min(...allCandlePrices);
    const candleMax = Math.max(...allCandlePrices);

    // Include LOB price_bins range ONLY where we have actual V_diff data (non-zero)
    const activeLobPrices = price_bins.filter((price, idx) => {
      const v = vDiffData[idx];
      return v !== null && v !== undefined && v !== 0;
    });

    // Use the wider range between candles and active LOB bins
    let dataMin = candleMin;
    let dataMax = candleMax;

    if (activeLobPrices.length > 0) {
      const lobMin = Math.min(...activeLobPrices);
      const lobMax = Math.max(...activeLobPrices);
      dataMin = Math.min(candleMin, lobMin);
      dataMax = Math.max(candleMax, lobMax);
    }

    const priceRange = dataMax - dataMin;
    const padding = priceRange * 0.02;
    const visiblePriceMin = dataMin - padding;
    const visiblePriceMax = dataMax + padding;

    // Note: Heatmap data is now processed directly in renderHeatmap() from all snapshots
    // This supports 2D temporal visualization (time × price)

    // Calculate max abs V_diff for latest snapshot (for profile panels on right side)
    const visibleVdiffValues = vDiffData.filter((_, idx) => {
      const price = price_bins[idx];
      return price >= visiblePriceMin && price <= visiblePriceMax;
    });
    const maxAbsVdiff = Math.max(...visibleVdiffValues.map(v => Math.abs(v)), 0.0001);

    // Use previously calculated price range
    const priceMin = visiblePriceMin;
    const priceMax = visiblePriceMax;

    // Configure ECharts option
    const option = {
      backgroundColor: 'transparent', // CRITICAL: transparent to show canvas heatmap below

      // Interactive controls - DISABLED: all pan/zoom via custom handlers
      // Both X and Y axis controlled by custom handlers (TradingView style)
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0],
          start: axisStateRef.current.xStart,
          end: axisStateRef.current.xEnd,
          minValueSpan: 10,
          zoomOnMouseWheel: false,   // DISABLED - custom handler
          moveOnMouseWheel: false,
          moveOnMouseMove: false,    // DISABLED - custom handler
          filterMode: 'none',
          disabled: true  // Completely disable ECharts control
        },
        {
          type: 'slider',
          xAxisIndex: [0],
          bottom: 10,
          height: 20,
          borderColor: '#454d5f',
          fillerColor: 'rgba(0, 240, 255, 0.1)',
          handleStyle: { color: '#00f0ff', borderColor: '#00f0ff' },
          textStyle: { color: '#8b93a0', fontSize: 9 },
          labelFormatter: (value, valueStr) => {
            try {
              const date = new Date(valueStr);
              const day = date.getDate();
              const month = date.toLocaleString('en', { month: 'short' });
              return `${day} ${month}`;
            } catch {
              return '';
            }
          }
        }
      ],

      grid: [
        {
          left: 45,  // Reduced from 70 for mobile (closer price labels to left edge)
          right: '28%',
          top: 10,  // Reduced from 5% (~40px) to 10px - recovered ~30px vertical space
          bottom: 60,  // Space for slider + axis labels
          containLabel: false
        },
        {
          left: '75%',
          right: 20,
          top: 10,  // Match left panel
          bottom: 60,  // Match left panel
          containLabel: false
        }
      ],
      // Titles removed - tab header already identifies content ("Liquidity")
      // More space for chart, cleaner professional design
      tooltip: {
        show: false
      },
      axisPointer: {
        show: true,
        type: 'line',
        link: [{ xAxisIndex: 'all' }],
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.4)',
          width: 1,
          type: 'dashed'
        }
      },
      xAxis: [
        {
          type: 'category',
          data: timestamps,
          gridIndex: 0,
          position: 'bottom',
          axisLine: {
            show: true,
            lineStyle: { color: '#2a2e39', width: 1 }
          },
          axisLabel: {
            show: true,
            color: '#8b93a0',
            fontSize: 9,
            interval: 'auto',
            formatter: (value) => {
              const date = new Date(value);
              const day = date.getDate();
              const month = date.toLocaleString('en', { month: 'short' });
              const hours = String(date.getHours()).padStart(2, '0');
              const minutes = String(date.getMinutes()).padStart(2, '0');
              return `${day} ${month} ${hours}:${minutes}`;
            }
          },
          axisTick: {
            show: true,
            lineStyle: { color: '#2a2e39', width: 1 }
          },
          splitLine: { show: false },
          axisPointer: {
            show: true,
            lineStyle: {
              color: 'rgba(255, 255, 255, 0.4)',
              width: 1,
              type: 'dashed'
            },
            label: {
              show: true,
              backgroundColor: '#1e232b',
              color: '#fff',
              fontSize: 10,
              formatter: (params) => {
                try {
                  const date = new Date(params.value);
                  const day = date.getDate();
                  const month = date.toLocaleString('en', { month: 'short' });
                  const hours = String(date.getHours()).padStart(2, '0');
                  const minutes = String(date.getMinutes()).padStart(2, '0');
                  return `${day} ${month} ${hours}:${minutes}`;
                } catch {
                  return params.value;
                }
              }
            }
          }
        },
        {
          type: 'value',
          gridIndex: 1,
          position: 'bottom',
          inverse: true,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: '#8b93a0',
            fontSize: 9,
            formatter: (val) => {
              if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
              if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
              return val.toFixed(1);
            }
          },
          splitLine: { lineStyle: { color: '#1e232b', width: 1 } },
          splitNumber: 4,
          max: maxAbsVdiff * 1.1
        }
      ],
      yAxis: [
        {
          type: 'value',
          gridIndex: 0,
          min: axisStateRef.current.yAuto ? priceMin : axisStateRef.current.yMin,
          max: axisStateRef.current.yAuto ? priceMax : axisStateRef.current.yMax,
          animation: false,  // Disable animation for instant response
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: '#8b93a0',
            fontSize: 10,
            formatter: (val) => '$' + Math.round(val).toLocaleString()
          },
          axisPointer: {
            show: true,
            label: {
              show: true,
              backgroundColor: '#1e232b',
              color: '#fff',
              fontSize: 10,
              formatter: (params) => '$' + Math.round(params.value).toLocaleString()
            }
          },
          splitLine: { lineStyle: { color: '#1e232b', width: 1 } },
          splitNumber: 6
        },
        {
          type: 'value',
          gridIndex: 1,
          min: axisStateRef.current.yAuto ? priceMin : axisStateRef.current.yMin,
          max: axisStateRef.current.yAuto ? priceMax : axisStateRef.current.yMax,
          animation: false,  // Disable animation for instant response
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { show: false },  // Hide Y-axis labels for profile chart
          splitLine: { lineStyle: { color: '#1e232b', width: 1 } }
        }
      ],
      series: [
        {
          name: 'BTC Price',
          type: 'candlestick',
          data: candles,
          xAxisIndex: 0,
          yAxisIndex: 0,
          animation: false,  // Disable animation for instant Y-axis response
          itemStyle: {
            color: '#10b981',
            color0: '#ef4444',
            borderColor: '#10b981',
            borderColor0: '#ef4444',
            borderWidth: 1.5
          },
          emphasis: {
            itemStyle: {
              borderWidth: 2,
              shadowBlur: 5,
              shadowColor: 'rgba(0, 240, 255, 0.3)'
            }
          },
          z: 10
        },
        {
          name: 'Resistance Profile',
          type: 'line',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: price_bins
            .filter((price) => price >= p_current)
            .map((price, idx) => {
              const originalIdx = price_bins.indexOf(price);
              const vDiff = vDiffData[originalIdx];
              const value = (vDiff < 0) ? Math.abs(vDiff) : 0;
              return [value, price];
            }),
          lineStyle: {
            color: '#ef4444',
            width: 3,
            type: 'solid',
            shadowColor: 'rgba(239, 68, 68, 0.4)',
            shadowBlur: 8,
            shadowOffsetX: 0,
            shadowOffsetY: 0
          },
          itemStyle: { color: '#ef4444' },
          symbol: 'none',
          smooth: 0.3,
          z: 5,
          emphasis: {
            lineStyle: {
              width: 4,
              shadowBlur: 12
            }
          }
        },
        {
          name: 'Support Profile',
          type: 'line',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: price_bins
            .filter((price) => price < p_current)
            .map((price, idx) => {
              const originalIdx = price_bins.indexOf(price);
              const vDiff = vDiffData[originalIdx];
              const value = (vDiff > 0) ? Math.abs(vDiff) : 0;
              return [value, price];
            }),
          lineStyle: {
            color: '#10b981',
            width: 3,
            type: 'solid',
            shadowColor: 'rgba(16, 185, 129, 0.4)',
            shadowBlur: 8,
            shadowOffsetX: 0,
            shadowOffsetY: 0
          },
          itemStyle: { color: '#10b981' },
          symbol: 'none',
          smooth: 0.3,
          z: 5,
          emphasis: {
            lineStyle: {
              width: 4,
              shadowBlur: 12
            }
          }
        },
        {
          name: 'Current Price (Profile)',
          type: 'line',
          xAxisIndex: 1,
          yAxisIndex: 1,
          markLine: {
            silent: true,
            symbol: 'none',
            animation: false,
            lineStyle: { color: '#00f0ff', width: 2, type: 'dashed' },
            label: { show: false },
            data: [{ yAxis: Math.round(p_current) }]
          }
        }
      ]
    };

    // Save current dataZoom state before updating
    try {
      const currentOption = chart.getOption();
      if (currentOption && currentOption.dataZoom) {
        const currentDataZoom = currentOption.dataZoom[0];
        if (currentDataZoom && (currentDataZoom.start !== undefined || currentDataZoom.end !== undefined)) {
          dataZoomStateRef.current = {
            start: currentDataZoom.start,
            end: currentDataZoom.end
          };
        }
      }
    } catch (e) {
      // First render, no previous option
    }

    // Update chart with merge (not replace) to preserve interactions
    chart.setOption(option, false);  // false = merge, not replace

    // Restore dataZoom state if it exists
    if (dataZoomStateRef.current) {
      chart.setOption({
        dataZoom: [{
          start: dataZoomStateRef.current.start,
          end: dataZoomStateRef.current.end
        }]
      }, false);
    }

    // CANVAS HEATMAP RENDERING FUNCTION - 2D TEMPORAL VISUALIZATION
    // (Defined before usage so we can call it immediately after setOption)
    const renderHeatmap = () => {
      // Check if chart is still valid (not disposed)
      if (!chart || chart.isDisposed()) {
        return;
      }

      const chartModel = chart.getModel();
      const gridModel = chartModel.getComponent('grid', 0);

      if (!gridModel) {
        return;
      }

      const rect = gridModel.coordinateSystem.getRect();
      const { x: gridLeft, y: gridTop, width: gridWidth, height: gridHeight } = rect;

      // Set canvas dimensions to match container
      const container = containerRef.current;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;

      // Clear ENTIRE canvas first
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Save context and clip to grid area ONLY
      // This prevents heatmap from covering axis labels
      ctx.save();
      ctx.beginPath();
      ctx.rect(gridLeft, gridTop, gridWidth, gridHeight);
      ctx.clip();

      // Helper: Convert price to canvas Y coordinate
      // Use current Y-axis range (either auto or manual from drag)
      const currentMin = axisStateRef.current.yAuto ? priceMin : axisStateRef.current.yMin;
      const currentMax = axisStateRef.current.yAuto ? priceMax : axisStateRef.current.yMax;

      const priceToY = (price) => {
        const normalizedPrice = (price - currentMin) / (currentMax - currentMin);
        return gridTop + gridHeight * (1 - normalizedPrice); // Inverted: higher price = lower Y
      };

      // HEATMAP MODE SWITCH: 1D (latest snapshot) or 2D (temporal evolution)
      const snapshots = lobData?.snapshots || [];

      if (snapshots.length === 0 || timestamps.length === 0) {
        // No data, restore and return
        ctx.restore();
        return;
      }

      if (heatmapMode === '1D') {
        // ===== 1D MODE: Latest snapshot only (stretched across entire visible width) =====
        const latestSnapshot = snapshots[snapshots.length - 1];
        const {
          price_bins: snapshotPriceBins = [],
          V_diff: snapshotVdiff = [],
          p_current: snapshotPCurrent
        } = latestSnapshot;

        // ============================================================
        // GLOBAL NORMALIZATION: 95th percentile across ALL snapshots
        // (Same as 2D mode for consistent color scale)
        // ============================================================
        const allVdiffValues = [];
        snapshots.forEach(snapshot => {
          const { price_bins: bins = [], V_diff: vdiff = [] } = snapshot;
          vdiff.forEach((v, idx) => {
            const price = bins[idx];
            if (price >= currentMin && price <= currentMax && v !== null && v !== undefined && v !== 0) {
              allVdiffValues.push(Math.abs(v));
            }
          });
        });

        let globalMaxVdiff = 0.0001;
        if (allVdiffValues.length > 0) {
          allVdiffValues.sort((a, b) => a - b);
          const p95Index = Math.floor(allVdiffValues.length * 0.95);
          globalMaxVdiff = allVdiffValues[p95Index] || 0.0001;
        }

        // Draw heatmap across entire grid width
        snapshotPriceBins.forEach((price, priceIdx) => {
          const vDiff = snapshotVdiff[priceIdx];

          if (vDiff === null || vDiff === undefined || vDiff === 0) {
            return; // Skip empty bins
          }

          const strength = Math.abs(vDiff) / globalMaxVdiff;

          // Calculate bin height
          const binHeight = priceIdx < snapshotPriceBins.length - 1
            ? snapshotPriceBins[priceIdx + 1] - price
            : (priceIdx > 0 ? snapshotPriceBins[priceIdx] - snapshotPriceBins[priceIdx - 1] : 50);

          // Calculate Y coordinates
          const yTop = priceToY(price + binHeight);
          const yBottom = priceToY(price);
          const rectHeight = yBottom - yTop;

          // Use snapshot's historical price (correct for temporal independence)
          const isAboveCurrentPrice = price >= snapshotPCurrent;
          const isResistance = isAboveCurrentPrice && vDiff < 0;
          const isSupport = !isAboveCurrentPrice && vDiff > 0;

          // CRITICAL: Skip bins where V_diff sign doesn't match expected position
          // - Above price with V_diff > 0 (green above price) → SKIP
          // - Below price with V_diff < 0 (red below price) → SKIP
          if (!isResistance && !isSupport) {
            return; // Skip invalid combinations
          }

          let r, g, b;

          if (isResistance) {
            // Resistance zone (red gradient)
            if (strength <= 0) {
              r = 255; g = 255; b = 255;
            } else if (strength >= 1) {
              r = 139; g = 0; b = 0;
            } else {
              if (strength < 0.33) {
                const t = strength / 0.33;
                r = 255;
                g = 255 - (90 * t);
                b = 255 * (1 - t);
              } else if (strength < 0.66) {
                const t = (strength - 0.33) / 0.33;
                r = 255 - (16 * t);
                g = 165 - (97 * t);
                b = 0 + (68 * t);
              } else {
                const t = (strength - 0.66) / 0.34;
                r = 239 - (100 * t);
                g = 68 * (1 - t);
                b = 68 * (1 - t);
              }
            }
            const color = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.5)`;
            ctx.fillStyle = color;
            ctx.fillRect(gridLeft, yTop, gridWidth, rectHeight);  // Full width
          } else if (isSupport) {
            // Support zone (green gradient)
            if (strength <= 0) {
              r = 255; g = 255; b = 255;
            } else if (strength >= 1) {
              r = 0; g = 100; b = 0;
            } else {
              if (strength < 0.33) {
                const t = strength / 0.33;
                r = 255 - (111 * t);
                g = 255 - (17 * t);
                b = 255 - (111 * t);
              } else if (strength < 0.66) {
                const t = (strength - 0.33) / 0.33;
                r = 144 - (128 * t);
                g = 238 - (53 * t);
                b = 144 - (15 * t);
              } else {
                const t = (strength - 0.66) / 0.34;
                r = 16 * (1 - t);
                g = 185 - (85 * t);
                b = 129 * (1 - t);
              }
            }
            const color = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.5)`;
            ctx.fillStyle = color;
            ctx.fillRect(gridLeft, yTop, gridWidth, rectHeight);  // Full width
          }
        });

      } else {
        // ===== 2D MODE: Temporal evolution (map snapshots to visible candles) =====
        // Get current dataZoom state to know which candles are visible
        const currentOption = chart.getOption();
        const dataZoom = currentOption.dataZoom?.[0] || {};
        const startPercent = dataZoom.start || 0;
        const endPercent = dataZoom.end || 100;

        // Calculate visible candle range
        const totalCandles = timestamps.length;
        const startIdx = Math.floor(totalCandles * startPercent / 100);
        const endIdx = Math.ceil(totalCandles * endPercent / 100);
        const visibleCandles = endIdx - startIdx;

        // Map each visible candle to nearest snapshot by timestamp
        const candleToSnapshot = new Map();

        for (let candleIdx = startIdx; candleIdx < endIdx; candleIdx++) {
          const candleTime = new Date(timestamps[candleIdx]).getTime();

          // Find nearest snapshot by timestamp
          let nearestSnapshot = null;
          let minTimeDiff = Infinity;

          snapshots.forEach(snapshot => {
            const snapshotTime = new Date(snapshot.timestamp).getTime();
            const timeDiff = Math.abs(candleTime - snapshotTime);

            if (timeDiff < minTimeDiff) {
              minTimeDiff = timeDiff;
              nearestSnapshot = snapshot;
            }
          });

          if (nearestSnapshot) {
            candleToSnapshot.set(candleIdx, nearestSnapshot);
          }
        }

        // ============================================================
        // GLOBAL NORMALIZATION: 95th percentile across ALL snapshots
        // ============================================================
        // Collect all V_diff values from all snapshots (within visible price range)
        const allVdiffValues = [];
        snapshots.forEach(snapshot => {
          const { price_bins: bins = [], V_diff: vdiff = [] } = snapshot;
          vdiff.forEach((v, idx) => {
            const price = bins[idx];
            // Only include values within visible price range
            if (price >= currentMin && price <= currentMax && v !== null && v !== undefined && v !== 0) {
              allVdiffValues.push(Math.abs(v));
            }
          });
        });

        // Calculate 95th percentile for uniform color scale
        let globalMaxVdiff = 0.0001; // Fallback minimum
        if (allVdiffValues.length > 0) {
          allVdiffValues.sort((a, b) => a - b);
          const p95Index = Math.floor(allVdiffValues.length * 0.95);
          globalMaxVdiff = allVdiffValues[p95Index] || 0.0001;
        }

        // Calculate column width (one column per visible candle)
        const columnWidth = gridWidth / visibleCandles;

        // Iterate through visible candles and draw their corresponding snapshots
        for (let candleIdx = startIdx; candleIdx < endIdx; candleIdx++) {
          const snapshot = candleToSnapshot.get(candleIdx);
          if (!snapshot) continue;

          const {
            price_bins: snapshotPriceBins = [],
            V_diff: snapshotVdiff = [],
            p_current: snapshotPCurrent
          } = snapshot;

        // Calculate X position for this candle/column
        const relativeIdx = candleIdx - startIdx;
        const columnX = gridLeft + (relativeIdx * columnWidth);

        // Use GLOBAL normalization (95th percentile) instead of per-snapshot max
        // This ensures uniform color scale across all snapshots in the day

        // Process each price bin (price dimension)
        snapshotPriceBins.forEach((price, priceIdx) => {
          const vDiff = snapshotVdiff[priceIdx];

          if (vDiff === null || vDiff === undefined || vDiff === 0) {
            return; // Skip empty bins
          }

          const strength = Math.abs(vDiff) / globalMaxVdiff;

          // Calculate bin height
          const binHeight = priceIdx < snapshotPriceBins.length - 1
            ? snapshotPriceBins[priceIdx + 1] - price
            : (priceIdx > 0 ? snapshotPriceBins[priceIdx] - snapshotPriceBins[priceIdx - 1] : 50);

          // Calculate Y coordinates
          const yTop = priceToY(price + binHeight);
          const yBottom = priceToY(price);
          const rectHeight = yBottom - yTop;

          // Use snapshot's historical price (temporal independence)
          // Above price at time T: show only RED (resistance, V_diff < 0)
          // Below price at time T: show only GREEN (support, V_diff > 0)
          const isAboveCurrentPrice = price >= snapshotPCurrent;
          const isResistance = isAboveCurrentPrice && vDiff < 0;
          const isSupport = !isAboveCurrentPrice && vDiff > 0;

          // CRITICAL: Skip bins where V_diff sign doesn't match expected position
          // - Above price with V_diff > 0 (green above price) → SKIP
          // - Below price with V_diff < 0 (red below price) → SKIP
          if (!isResistance && !isSupport) {
            return; // Skip invalid combinations
          }

          let r, g, b;

          if (isResistance) {
            // Resistance zone (red gradient)
            if (strength <= 0) {
              r = 255; g = 255; b = 255;
            } else if (strength >= 1) {
              r = 139; g = 0; b = 0;
            } else {
              if (strength < 0.33) {
                const t = strength / 0.33;
                r = 255;
                g = 255 - (90 * t);
                b = 255 * (1 - t);
              } else if (strength < 0.66) {
                const t = (strength - 0.33) / 0.33;
                r = 255 - (16 * t);
                g = 165 - (97 * t);
                b = 0 + (68 * t);
              } else {
                const t = (strength - 0.66) / 0.34;
                r = 239 - (100 * t);
                g = 68 * (1 - t);
                b = 68 * (1 - t);
              }
            }
            const color = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.5)`;
            ctx.fillStyle = color;
            ctx.fillRect(columnX, yTop, columnWidth, rectHeight);
          } else if (isSupport) {
            // Support zone (green gradient)
            if (strength <= 0) {
              r = 255; g = 255; b = 255;
            } else if (strength >= 1) {
              r = 0; g = 100; b = 0;
            } else {
              if (strength < 0.33) {
                const t = strength / 0.33;
                r = 255 - (111 * t);
                g = 255 - (17 * t);
                b = 255 - (111 * t);
              } else if (strength < 0.66) {
                const t = (strength - 0.33) / 0.33;
                r = 144 - (128 * t);
                g = 238 - (53 * t);
                b = 144 - (15 * t);
              } else {
                const t = (strength - 0.66) / 0.34;
                r = 16 * (1 - t);
                g = 185 - (85 * t);
                b = 129 * (1 - t);
              }
            }
            const color = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.5)`;
            ctx.fillStyle = color;
            ctx.fillRect(columnX, yTop, columnWidth, rectHeight);
          }
        });
        }  // End 2D mode for loop
      }  // End heatmapMode switch

      // Restore context (remove clipping)
      ctx.restore();
    };

    // Render heatmap immediately after setOption completes
    // Use double requestAnimationFrame to ensure ECharts has fully completed rendering
    // First rAF: layout calculation complete
    // Second rAF: paint complete and DOM stable
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        renderHeatmap();
      });
    });

    // Re-render heatmap on dataZoom (pan/zoom)
    chart.off('dataZoom', renderHeatmap);  // Remove existing listener to avoid duplicates
    chart.on('dataZoom', renderHeatmap);

    // CUSTOM AXIS HANDLERS (TradingView style - 1:1 movement)
    // - Drag on chart area → pan X + Y
    // - Drag on Y-axis → zoom Y
    // - Wheel on Y-axis → zoom Y with cursor fixed
    const zr = chart.getZr();

    const handleMouseDown = (e) => {
      const chartDom = chartRef.current;
      if (!chartDom) return;

      const rect = chartDom.getBoundingClientRect();
      const x = e.offsetX;
      const y = e.offsetY;

      const gridTop = rect.height * 0.05;
      const gridBottom = rect.height - 60;
      const isInYRange = y > gridTop && y < gridBottom;

      if (x < 70 && isInYRange) {
        // Drag on Y-axis → ZOOM Y mode
        axisStateRef.current.dragging = true;
        axisStateRef.current.dragMode = 'zoom';
        axisStateRef.current.startX = x;
        axisStateRef.current.startY = y;
        axisStateRef.current.startYMin = axisStateRef.current.yAuto ? priceMin : axisStateRef.current.yMin;
        axisStateRef.current.startYMax = axisStateRef.current.yAuto ? priceMax : axisStateRef.current.yMax;
        axisStateRef.current.yAuto = false;
      } else if (x >= 70 && x < rect.width * 0.72 && isInYRange) {
        // Drag on chart area → PAN X + Y mode
        axisStateRef.current.dragging = true;
        axisStateRef.current.dragMode = 'pan';
        axisStateRef.current.startX = x;
        axisStateRef.current.startY = y;
        axisStateRef.current.startYMin = axisStateRef.current.yAuto ? priceMin : axisStateRef.current.yMin;
        axisStateRef.current.startYMax = axisStateRef.current.yAuto ? priceMax : axisStateRef.current.yMax;
        axisStateRef.current.startXStart = axisStateRef.current.xStart;
        axisStateRef.current.startXEnd = axisStateRef.current.xEnd;
        axisStateRef.current.yAuto = false;
      }
    };

    const handleMouseMove = (e) => {
      if (!axisStateRef.current.dragging) return;

      const chartDom = chartRef.current;
      if (!chartDom) return;

      const rect = chartDom.getBoundingClientRect();
      const gridLeft = 45;  // Match grid.left value
      const gridWidth = rect.width * 0.72 - gridLeft;
      const gridHeight = rect.height - (rect.height * 0.05) - 60;

      const deltaX = e.offsetX - axisStateRef.current.startX;
      const deltaY = e.offsetY - axisStateRef.current.startY;
      const priceRange = axisStateRef.current.startYMax - axisStateRef.current.startYMin;

      // Calculate full data range for limits (TradingView style - tighter bounds)
      const fullDataRange = priceMax - priceMin;
      const minAllowedRange = fullDataRange * 0.08;  // Min zoom: 8% of data
      const maxAllowedRange = fullDataRange * 2;     // Max zoom: 2x data range

      let newYMin, newYMax, newXStart, newXEnd;

      if (axisStateRef.current.dragMode === 'zoom') {
        // ZOOM Y mode: drag on Y-axis
        const zoomSensitivity = 0.002;
        const zoomFactor = 1 + (deltaY * zoomSensitivity);

        if (zoomFactor <= 0.1) return;

        const centerPrice = (axisStateRef.current.startYMin + axisStateRef.current.startYMax) / 2;
        const newRange = priceRange * zoomFactor;
        const clampedRange = Math.max(minAllowedRange, Math.min(maxAllowedRange, newRange));

        newYMin = centerPrice - clampedRange / 2;
        newYMax = centerPrice + clampedRange / 2;

        // No X change in zoom mode
        newXStart = axisStateRef.current.xStart;
        newXEnd = axisStateRef.current.xEnd;
      } else if (axisStateRef.current.dragMode === 'pan') {
        // PAN X + Y mode: drag on chart area (1:1 movement)

        // Y-axis pan (1:1 with mouse)
        const priceShift = (deltaY / gridHeight) * priceRange;
        newYMin = axisStateRef.current.startYMin + priceShift;
        newYMax = axisStateRef.current.startYMax + priceShift;

        // Clamp Y
        const currentRange = newYMax - newYMin;
        if (newYMin < priceMin - fullDataRange) {
          newYMin = priceMin - fullDataRange;
          newYMax = newYMin + currentRange;
        }
        if (newYMax > priceMax + fullDataRange) {
          newYMax = priceMax + fullDataRange;
          newYMin = newYMax - currentRange;
        }

        // X-axis pan (1:1 with mouse) - percentage-based
        const xRange = axisStateRef.current.startXEnd - axisStateRef.current.startXStart;
        const xShift = -(deltaX / gridWidth) * xRange;  // Negative for natural direction

        newXStart = axisStateRef.current.startXStart + xShift;
        newXEnd = axisStateRef.current.startXEnd + xShift;

        // Clamp X to 0-100 range
        if (newXStart < 0) {
          newXEnd = newXEnd - newXStart;
          newXStart = 0;
        }
        if (newXEnd > 100) {
          newXStart = newXStart - (newXEnd - 100);
          newXEnd = 100;
        }
      }

      // Final validation
      if (newYMin >= newYMax) return;

      axisStateRef.current.yMin = newYMin;
      axisStateRef.current.yMax = newYMax;
      axisStateRef.current.xStart = newXStart;
      axisStateRef.current.xEnd = newXEnd;

      chart.setOption({
        yAxis: [
          { min: newYMin, max: newYMax },
          { min: newYMin, max: newYMax }
        ],
        dataZoom: [{
          start: newXStart,
          end: newXEnd
        }]
      }, {
        notMerge: false,
        lazyUpdate: false,
        silent: false
      });

      renderHeatmap();
    };

    const handleMouseUp = () => {
      axisStateRef.current.dragging = false;
    };

    // Double-click to reset Y-axis to auto
    const handleDoubleClick = (e) => {
      const x = e.offsetX;
      const chartDom = chartRef.current;
      if (!chartDom) return;
      const rect = chartDom.getBoundingClientRect();

      if (x < 70) {
        axisStateRef.current.yAuto = true;
        axisStateRef.current.yMin = null;
        axisStateRef.current.yMax = null;

        chart.setOption({
          yAxis: [
            { min: priceMin, max: priceMax },
            { min: priceMin, max: priceMax }
          ]
        }, false);

        renderHeatmap();
      }
    };

    // Mouse wheel handler for zoom (Y on axis, X on chart)
    const handleWheel = (e) => {
      const chartDom = chartRef.current;
      if (!chartDom) return;

      const rect = chartDom.getBoundingClientRect();
      const x = e.offsetX;
      const y = e.offsetY;

      const gridTop = rect.height * 0.05;
      const gridBottom = rect.height - 60;
      const isInYRange = y > gridTop && y < gridBottom;

      // Zoom Y if over Y-axis area (left side, x < 70px)
      if (x < 70 && isInYRange) {
        e.preventDefault();

        // Get current price range
        const currentMin = axisStateRef.current.yAuto ? priceMin : axisStateRef.current.yMin;
        const currentMax = axisStateRef.current.yAuto ? priceMax : axisStateRef.current.yMax;
        const currentRange = currentMax - currentMin;

        // Calculate zoom factor (REDUCED sensitivity - 8% instead of 10%)
        const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;

        // Calculate full data range for limits (tighter bounds)
        const fullDataRange = priceMax - priceMin;
        const minAllowedRange = fullDataRange * 0.08;  // Min zoom: 8% of data
        const maxAllowedRange = fullDataRange * 2;     // Max zoom: 2x data range

        const newRange = currentRange * zoomFactor;

        // Apply range limits
        const clampedRange = Math.max(minAllowedRange, Math.min(maxAllowedRange, newRange));

        // Calculate the price at cursor position
        const gridHeight = rect.height - gridTop - 60;
        const relativeY = y - gridTop;
        const normalizedY = 1 - (relativeY / gridHeight);  // Inverted
        const priceAtCursor = currentMin + normalizedY * currentRange;

        // Calculate new min/max to keep cursor price fixed (using clamped range)
        const rangeRatio = clampedRange / currentRange;
        const rangeBelow = (priceAtCursor - currentMin) * rangeRatio;
        const rangeAbove = (currentMax - priceAtCursor) * rangeRatio;

        const newMin = priceAtCursor - rangeBelow;
        const newMax = priceAtCursor + rangeAbove;

        // Final validation
        if (newMin >= newMax) return;

        axisStateRef.current.yAuto = false;
        axisStateRef.current.yMin = newMin;
        axisStateRef.current.yMax = newMax;

        chart.setOption({
          yAxis: [
            { min: newMin, max: newMax },
            { min: newMin, max: newMax }
          ]
        }, {
          notMerge: false,
          lazyUpdate: false,
          silent: false
        });

        renderHeatmap();
      }
      // Zoom X if over chart area (x >= 70px)
      else if (x >= 70 && x < rect.width * 0.72 && isInYRange) {
        e.preventDefault();

        const currentXStart = axisStateRef.current.xStart;
        const currentXEnd = axisStateRef.current.xEnd;
        const currentXRange = currentXEnd - currentXStart;

        // Calculate zoom factor (8% per tick)
        const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
        const newXRange = currentXRange * zoomFactor;

        // Limit zoom range (min 10%, max 100%)
        const clampedXRange = Math.max(10, Math.min(100, newXRange));

        // Calculate X position at cursor (percentage of chart width)
        const gridLeft = 45;  // Match grid.left value
        const gridWidth = rect.width * 0.72 - gridLeft;
        const relativeX = (x - gridLeft) / gridWidth;
        const xAtCursor = currentXStart + relativeX * currentXRange;

        // Calculate new start/end to keep cursor position fixed
        const rangeRatio = clampedXRange / currentXRange;
        const rangeLeft = (xAtCursor - currentXStart) * rangeRatio;
        const rangeRight = (currentXEnd - xAtCursor) * rangeRatio;

        let newXStart = xAtCursor - rangeLeft;
        let newXEnd = xAtCursor + rangeRight;

        // Clamp to 0-100
        if (newXStart < 0) {
          newXEnd = newXEnd - newXStart;
          newXStart = 0;
        }
        if (newXEnd > 100) {
          newXStart = newXStart - (newXEnd - 100);
          newXEnd = 100;
        }

        axisStateRef.current.xStart = newXStart;
        axisStateRef.current.xEnd = newXEnd;

        chart.setOption({
          dataZoom: [{
            start: newXStart,
            end: newXEnd
          }]
        }, {
          notMerge: false,
          lazyUpdate: false,
          silent: false
        });

        renderHeatmap();
      }
    };

    // ============================================================
    // TOUCH HANDLERS FOR MOBILE (parallel to mouse handlers)
    // ============================================================

    const getTouchPos = (touch) => {
      const chartDom = chartRef.current;
      if (!chartDom) return { x: 0, y: 0 };

      const rect = chartDom.getBoundingClientRect();
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    };

    const getDistance = (touch1, touch2) => {
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e) => {
      const chartDom = chartRef.current;
      if (!chartDom) return;

      const rect = chartDom.getBoundingClientRect();
      const touches = Array.from(e.touches);

      if (touches.length === 1) {
        // Single touch - prepare for pan
        const pos = getTouchPos(touches[0]);
        const gridTop = rect.height * 0.05;
        const gridBottom = rect.height - 60;
        const isInYRange = pos.y > gridTop && pos.y < gridBottom;

        if (pos.x < 45 && isInYRange) {
          // Touch on Y-axis → ZOOM Y mode (will be handled by pinch)
          touchStateRef.current.mode = 'zoom-y';
          touchStateRef.current.touches = touches;
          touchStateRef.current.initialYMin = axisStateRef.current.yAuto ? priceMin : axisStateRef.current.yMin;
          touchStateRef.current.initialYMax = axisStateRef.current.yAuto ? priceMax : axisStateRef.current.yMax;
          axisStateRef.current.yAuto = false;
          e.preventDefault();
        } else if (pos.x >= 45 && pos.x < rect.width * 0.72 && isInYRange) {
          // Touch on chart → PAN mode
          touchStateRef.current.mode = 'pan';
          touchStateRef.current.touches = touches;
          touchStateRef.current.initialYMin = axisStateRef.current.yAuto ? priceMin : axisStateRef.current.yMin;
          touchStateRef.current.initialYMax = axisStateRef.current.yAuto ? priceMax : axisStateRef.current.yMax;
          touchStateRef.current.initialXStart = axisStateRef.current.xStart;
          touchStateRef.current.initialXEnd = axisStateRef.current.xEnd;
          axisStateRef.current.yAuto = false;
          e.preventDefault();
        }
      } else if (touches.length === 2) {
        // Two fingers - prepare for pinch zoom
        touchStateRef.current.mode = 'pinch';
        touchStateRef.current.touches = touches;
        touchStateRef.current.initialDistance = getDistance(touches[0], touches[1]);
        touchStateRef.current.initialYMin = axisStateRef.current.yAuto ? priceMin : axisStateRef.current.yMin;
        touchStateRef.current.initialYMax = axisStateRef.current.yAuto ? priceMax : axisStateRef.current.yMax;
        touchStateRef.current.initialXStart = axisStateRef.current.xStart;
        touchStateRef.current.initialXEnd = axisStateRef.current.xEnd;
        axisStateRef.current.yAuto = false;
        e.preventDefault();
      }
    };

    const handleTouchMove = (e) => {
      if (!touchStateRef.current.mode) return;

      const chartDom = chartRef.current;
      if (!chartDom) return;

      const rect = chartDom.getBoundingClientRect();
      const touches = Array.from(e.touches);

      if (touchStateRef.current.mode === 'pan' && touches.length === 1) {
        // Single finger pan
        const initialPos = getTouchPos(touchStateRef.current.touches[0]);
        const currentPos = getTouchPos(touches[0]);

        const deltaX = currentPos.x - initialPos.x;
        const deltaY = currentPos.y - initialPos.y;

        const gridLeft = 45;  // Match grid.left value
        const gridWidth = rect.width * 0.72 - gridLeft;
        const gridHeight = rect.height - (rect.height * 0.05) - 60;

        const priceRange = touchStateRef.current.initialYMax - touchStateRef.current.initialYMin;
        const fullDataRange = priceMax - priceMin;

        // Y-axis pan
        const priceShift = (deltaY / gridHeight) * priceRange;
        let newYMin = touchStateRef.current.initialYMin + priceShift;
        let newYMax = touchStateRef.current.initialYMax + priceShift;

        // Clamp Y
        const currentRange = newYMax - newYMin;
        if (newYMin < priceMin - fullDataRange) {
          newYMin = priceMin - fullDataRange;
          newYMax = newYMin + currentRange;
        }
        if (newYMax > priceMax + fullDataRange) {
          newYMax = priceMax + fullDataRange;
          newYMin = newYMax - currentRange;
        }

        // X-axis pan
        const xRange = touchStateRef.current.initialXEnd - touchStateRef.current.initialXStart;
        const xShift = -(deltaX / gridWidth) * xRange;

        let newXStart = touchStateRef.current.initialXStart + xShift;
        let newXEnd = touchStateRef.current.initialXEnd + xShift;

        // Clamp X
        if (newXStart < 0) {
          newXEnd = newXEnd - newXStart;
          newXStart = 0;
        }
        if (newXEnd > 100) {
          newXStart = newXStart - (newXEnd - 100);
          newXEnd = 100;
        }

        if (newYMin >= newYMax) return;

        axisStateRef.current.yMin = newYMin;
        axisStateRef.current.yMax = newYMax;
        axisStateRef.current.xStart = newXStart;
        axisStateRef.current.xEnd = newXEnd;

        chart.setOption({
          yAxis: [
            { min: newYMin, max: newYMax },
            { min: newYMin, max: newYMax }
          ],
          dataZoom: [{
            start: newXStart,
            end: newXEnd
          }]
        }, {
          notMerge: false,
          lazyUpdate: false,
          silent: false
        });

        renderHeatmap();
        e.preventDefault();

      } else if (touchStateRef.current.mode === 'pinch' && touches.length === 2) {
        // Two finger pinch zoom
        const currentDistance = getDistance(touches[0], touches[1]);
        const initialDistance = touchStateRef.current.initialDistance;

        if (initialDistance === 0) return;

        // Calculate zoom factor
        const zoomFactor = initialDistance / currentDistance;

        const fullDataRange = priceMax - priceMin;
        const minAllowedRange = fullDataRange * 0.08;
        const maxAllowedRange = fullDataRange * 2;

        // Y-axis zoom (vertical pinch)
        const initialYRange = touchStateRef.current.initialYMax - touchStateRef.current.initialYMin;
        const newYRange = initialYRange * zoomFactor;
        const clampedYRange = Math.max(minAllowedRange, Math.min(maxAllowedRange, newYRange));

        const centerPrice = (touchStateRef.current.initialYMin + touchStateRef.current.initialYMax) / 2;
        const newYMin = centerPrice - clampedYRange / 2;
        const newYMax = centerPrice + clampedYRange / 2;

        // X-axis zoom (horizontal pinch)
        const initialXRange = touchStateRef.current.initialXEnd - touchStateRef.current.initialXStart;
        const newXRange = initialXRange * zoomFactor;
        const clampedXRange = Math.max(10, Math.min(100, newXRange));

        const centerX = (touchStateRef.current.initialXStart + touchStateRef.current.initialXEnd) / 2;
        let newXStart = centerX - clampedXRange / 2;
        let newXEnd = centerX + clampedXRange / 2;

        // Clamp X
        if (newXStart < 0) {
          newXEnd = newXEnd - newXStart;
          newXStart = 0;
        }
        if (newXEnd > 100) {
          newXStart = newXStart - (newXEnd - 100);
          newXEnd = 100;
        }

        if (newYMin >= newYMax) return;

        axisStateRef.current.yMin = newYMin;
        axisStateRef.current.yMax = newYMax;
        axisStateRef.current.xStart = newXStart;
        axisStateRef.current.xEnd = newXEnd;

        chart.setOption({
          yAxis: [
            { min: newYMin, max: newYMax },
            { min: newYMin, max: newYMax }
          ],
          dataZoom: [{
            start: newXStart,
            end: newXEnd
          }]
        }, {
          notMerge: false,
          lazyUpdate: false,
          silent: false
        });

        renderHeatmap();
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e) => {
      const touches = Array.from(e.touches);

      if (touches.length === 0) {
        // All fingers lifted - reset
        touchStateRef.current.mode = null;
        touchStateRef.current.touches = [];
      } else if (touches.length === 1 && touchStateRef.current.mode === 'pinch') {
        // Transition from pinch to pan
        touchStateRef.current.mode = 'pan';
        touchStateRef.current.touches = touches;
        touchStateRef.current.initialYMin = axisStateRef.current.yMin;
        touchStateRef.current.initialYMax = axisStateRef.current.yMax;
        touchStateRef.current.initialXStart = axisStateRef.current.xStart;
        touchStateRef.current.initialXEnd = axisStateRef.current.xEnd;
      }
    };

    // Register MOUSE handlers
    zr.on('mousedown', handleMouseDown);
    zr.on('mousemove', handleMouseMove);
    zr.on('mouseup', handleMouseUp);
    zr.on('dblclick', handleDoubleClick);

    // Add wheel event listener to the chart DOM element
    const chartDom = chartRef.current;
    chartDom.addEventListener('wheel', handleWheel, { passive: false });

    // Register TOUCH handlers (parallel to mouse)
    chartDom.addEventListener('touchstart', handleTouchStart, { passive: false });
    chartDom.addEventListener('touchmove', handleTouchMove, { passive: false });
    chartDom.addEventListener('touchend', handleTouchEnd, { passive: false });
    chartDom.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    // Listen to dataZoom changes (from slider) to sync state
    const handleDataZoomEvent = (params) => {
      if (params.batch && params.batch[0]) {
        const zoom = params.batch[0];
        if (zoom.start !== undefined && zoom.end !== undefined) {
          axisStateRef.current.xStart = zoom.start;
          axisStateRef.current.xEnd = zoom.end;
        }
      }
    };
    chart.on('dataZoom', handleDataZoomEvent);

    // Re-render on resize
    const handleResize = () => {
      chart.resize();
      renderHeatmap();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      // Clean up event listeners
      chart.off('dataZoom', renderHeatmap);
      chart.off('dataZoom', handleDataZoomEvent);
      zr.off('mousedown', handleMouseDown);
      zr.off('mousemove', handleMouseMove);
      zr.off('mouseup', handleMouseUp);
      zr.off('dblclick', handleDoubleClick);
      chartDom.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
    };
  }, [priceData, lobData, heatmapMode]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Controls Bar - HIDDEN: Price bin fixed at $50 for cache optimization */}
      <div style={{
        padding: '6px 8px',
        backgroundColor: '#0b0e11',
        borderBottom: '1px solid #2a2e39',
        display: 'none',  // HIDDEN but code preserved
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        <label style={{ fontSize: '11px', color: '#8b93a0', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          Price Bin:
        </label>
        <input
          type="range"
          min="20"
          max="200"
          step="10"
          value={priceBin}
          onChange={(e) => onPriceBinChange(parseInt(e.target.value))}
          disabled={true}
          style={{
            flex: '1 1 120px',
            minWidth: '120px',
            maxWidth: '200px',
            accentColor: '#00f0ff',
            cursor: 'not-allowed',
            height: '24px',
            opacity: 0.4
          }}
        />
        <span style={{ fontSize: '11px', color: '#00f0ff', fontFamily: 'monospace', fontWeight: 'bold' }}>
          ${priceBin}
        </span>
        <span style={{ fontSize: '10px', color: '#64748b' }}>
          ({lobData?.price_bins?.length || 0} bins)
        </span>
      </div>

      {/* Chart Container */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          position: 'relative',
          backgroundColor: '#0b0e11'
        }}
      >
        {/* Canvas layer for heatmap (background) */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 0
          }}
        />
        {/* ECharts layer (foreground) */}
        <div
          ref={chartRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1
          }}
        />

        {/* Heatmap Mode Toggle - Minimal floating style */}
        <div style={{
          position: 'absolute',
          top: '8px',
          left: '80px',
          zIndex: 10,
          display: 'flex',
          gap: '2px',
          backgroundColor: 'rgba(11, 14, 17, 0.85)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(42, 46, 57, 0.6)',
          borderRadius: '3px',
          padding: '2px'
        }}>
          <button
            onClick={() => setHeatmapMode('1D')}
            title="1D: Latest snapshot"
            style={{
              padding: '3px 8px',
              fontSize: '9px',
              fontWeight: '500',
              backgroundColor: heatmapMode === '1D' ? 'rgba(14, 165, 233, 0.15)' : 'transparent',
              color: heatmapMode === '1D' ? '#0EA5E9' : '#64748b',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              transition: 'all 0.12s',
              fontFamily: 'monospace',
              letterSpacing: '0.5px'
            }}
            onMouseEnter={(e) => {
              if (heatmapMode !== '1D') {
                e.target.style.color = '#94a3b8';
                e.target.style.backgroundColor = 'rgba(100, 116, 139, 0.08)';
              }
            }}
            onMouseLeave={(e) => {
              if (heatmapMode !== '1D') {
                e.target.style.color = '#64748b';
                e.target.style.backgroundColor = 'transparent';
              }
            }}
          >
            1D
          </button>
          <button
            onClick={() => setHeatmapMode('2D')}
            title="2D: Temporal evolution"
            style={{
              padding: '3px 8px',
              fontSize: '9px',
              fontWeight: '500',
              backgroundColor: heatmapMode === '2D' ? 'rgba(14, 165, 233, 0.15)' : 'transparent',
              color: heatmapMode === '2D' ? '#0EA5E9' : '#64748b',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              transition: 'all 0.12s',
              fontFamily: 'monospace',
              letterSpacing: '0.5px'
            }}
            onMouseEnter={(e) => {
              if (heatmapMode !== '2D') {
                e.target.style.color = '#94a3b8';
                e.target.style.backgroundColor = 'rgba(100, 116, 139, 0.08)';
              }
            }}
            onMouseLeave={(e) => {
              if (heatmapMode !== '2D') {
                e.target.style.color = '#64748b';
                e.target.style.backgroundColor = 'transparent';
              }
            }}
          >
            2D
          </button>
        </div>
      </div>
    </div>
  );
};

export default LOBChart;
