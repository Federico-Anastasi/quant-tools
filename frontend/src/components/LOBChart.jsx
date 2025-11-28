import React, { useEffect, useRef } from 'react';
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

    // DEBUG: Check timestamps format
    console.log('[LOBChart] Timestamps debug:', {
      total: timestamps.length,
      first: timestamps[0],
      last: timestamps[timestamps.length - 1],
      sample: timestamps.slice(0, 5)
    });

    // Extract LOB density data
    const {
      price_bins = [],
      V_diff_smooth = [],
      V_diff = [],
      V_up = [],
      V_down = []
    } = lobData;

    // CRITICAL: Use actual current price from latest candle close
    const p_current = candles.length > 0 ? candles[candles.length - 1][1] : 0;

    // Use RAW V_diff (not smoothed) to avoid gaussian artifact
    const vDiffData = V_diff.length > 0 ? V_diff : V_diff_smooth;

    if (candles.length === 0 || price_bins.length === 0 || vDiffData.length === 0) {
      console.warn('[LOBChart] Insufficient data');
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

    // Calculate max ONLY for visible bins (critical for correct normalization)
    const visibleVdiffValues = vDiffData.filter((_, idx) => {
      const price = price_bins[idx];
      return price >= visiblePriceMin && price <= visiblePriceMax;
    });
    const maxAbsVdiff = Math.max(...visibleVdiffValues.map(v => Math.abs(v)), 0.0001); // Avoid division by zero

    // Prepare heatmap data
    const resistanceBars = [];
    const supportBars = [];

    price_bins.forEach((price, idx) => {
      const vDiff = vDiffData[idx];
      const strength = Math.abs(vDiff) / maxAbsVdiff;

      const binHeight = idx < price_bins.length - 1
        ? price_bins[idx + 1] - price
        : (idx > 0 ? price_bins[idx] - price_bins[idx - 1] : 50);

      if (price >= p_current && vDiff < 0) {
        // Resistance zone (above current price with negative vDiff)
        let r, g, b;
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
        const color = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.2)`;

        resistanceBars.push({ price, height: binHeight, color, strength, vDiff: Math.abs(vDiff) });
      } else if (price < p_current && vDiff > 0) {
        // Support zone (below current price with positive vDiff)
        let r, g, b;
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
        const color = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.2)`;

        supportBars.push({ price, height: binHeight, color, strength, vDiff });
      }
    });

    // Use previously calculated price range
    const priceMin = visiblePriceMin;
    const priceMax = visiblePriceMax;

    console.log('[LOBChart] Heatmap analysis:', {
      p_current,
      total_bins: price_bins.length,
      resistance_bars: resistanceBars.length,
      support_bars: supportBars.length,
      max_magnitude: maxAbsVdiff.toFixed(6),
      shared_y_range: `[${priceMin.toFixed(0)}, ${priceMax.toFixed(0)}]`
    });

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
          left: 70,
          right: '28%',
          top: '5%',
          bottom: 60,  // Space for slider + axis labels
          containLabel: false
        },
        {
          left: '75%',
          right: 20,
          top: '5%',
          bottom: 60,  // Match left panel
          containLabel: false
        }
      ],
      title: [
        {
          text: 'Price Evolution with Resistance/Support Heatmap',
          left: 75,
          top: '2%',
          textStyle: { color: '#8b93a0', fontSize: 12, fontWeight: 'bold' }
        },
        {
          text: 'Directional Liquidity Density Profile',
          left: '76%',
          top: '2%',
          textStyle: { color: '#8b93a0', fontSize: 12, fontWeight: 'bold' }
        }
      ],
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          lineStyle: { color: '#64748b', width: 1, type: 'dashed' }
        },
        backgroundColor: 'rgba(11, 14, 17, 0.95)',
        borderColor: '#2a2e39',
        textStyle: { color: '#cbd5e1', fontSize: 11 },
        formatter: (params) => {
          if (!params || params.length === 0) return '';
          const candleData = params.find(p => p.seriesName === 'BTC Price');
          if (candleData && candleData.data) {
            const [o, c, l, h] = candleData.data;
            const time = new Date(timestamps[candleData.dataIndex]);
            const timeStr = `${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}`;
            return `
              <div style="padding: 6px;">
                <div style="font-weight: bold; margin-bottom: 4px; color: #00f0ff;">${timeStr}</div>
                <div>Open: <span style="color: #cbd5e1;">$${o.toLocaleString()}</span></div>
                <div>High: <span style="color: #10b981;">$${h.toLocaleString()}</span></div>
                <div>Low: <span style="color: #ef4444;">$${l.toLocaleString()}</span></div>
                <div>Close: <span style="color: #cbd5e1; font-weight: bold;">$${c.toLocaleString()}</span></div>
              </div>
            `;
          }
          return '';
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
          splitLine: { show: false }
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
            formatter: (val) => {
              return '$' + val.toLocaleString('en-US', { maximumFractionDigits: 0 });
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
      console.log('[LOBChart] First render, no previous dataZoom state');
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

    // CANVAS HEATMAP RENDERING FUNCTION
    const renderHeatmap = () => {
      const chartModel = chart.getModel();
      const gridModel = chartModel.getComponent('grid', 0);

      if (!gridModel) {
        console.warn('[LOBChart] Grid model not found');
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

      // CRITICAL: Save context and clip to grid area ONLY
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

      // Draw resistance bars (red gradient)
      resistanceBars.forEach(bar => {
        const yTop = priceToY(bar.price + bar.height);
        const yBottom = priceToY(bar.price);
        const rectHeight = yBottom - yTop;

        ctx.fillStyle = bar.color;
        ctx.fillRect(gridLeft, yTop, gridWidth, rectHeight);
      });

      // Draw support bars (green gradient)
      supportBars.forEach(bar => {
        const yTop = priceToY(bar.price + bar.height);
        const yBottom = priceToY(bar.price);
        const rectHeight = yBottom - yTop;

        ctx.fillStyle = bar.color;
        ctx.fillRect(gridLeft, yTop, gridWidth, rectHeight);
      });

      // Restore context (remove clipping)
      ctx.restore();

      console.log('[LOBChart] Canvas heatmap rendered:', {
        gridDimensions: { left: gridLeft, top: gridTop, width: gridWidth, height: gridHeight },
        resistance_bars: resistanceBars.length,
        support_bars: supportBars.length
      });
    };

    // Initial render after ECharts finishes
    setTimeout(renderHeatmap, 100);

    // Re-render heatmap on dataZoom (pan/zoom)
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
      const gridLeft = 70;
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
        const gridLeft = 70;
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

    zr.on('mousedown', handleMouseDown);
    zr.on('mousemove', handleMouseMove);
    zr.on('mouseup', handleMouseUp);
    zr.on('dblclick', handleDoubleClick);

    // Add wheel event listener to the chart DOM element
    const chartDom = chartRef.current;
    chartDom.addEventListener('wheel', handleWheel, { passive: false });

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
      chart.off('dataZoom', handleDataZoomEvent);
      zr.off('mousedown', handleMouseDown);
      zr.off('mousemove', handleMouseMove);
      zr.off('mouseup', handleMouseUp);
      zr.off('dblclick', handleDoubleClick);
      chartDom.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
    };
  }, [priceData, lobData]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Controls Bar - Responsive */}
      <div style={{
        padding: '6px 8px',
        backgroundColor: '#0b0e11',
        borderBottom: '1px solid #2a2e39',
        display: 'flex',
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
          style={{
            flex: '1 1 120px',
            minWidth: '120px',
            maxWidth: '200px',
            accentColor: '#00f0ff',
            cursor: 'pointer',
            height: '24px'  // Larger touch target
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
      </div>
    </div>
  );
};

export default LOBChart;
