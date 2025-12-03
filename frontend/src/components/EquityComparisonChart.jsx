import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';

/**
 * EquityComparisonChart - Multi-bot equity curve comparison
 * Professional ECharts visualization with toggle visibility per bot
 * @param {Object} props - Component props
 * @param {Array} props.bots - Array of bot objects with id, name, strategy_type
 * @param {Object} props.equityCurves - Object mapping bot_id to equity_curve array
 */
function EquityComparisonChart({ bots = [], equityCurves = {} }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const dataZoomState = useRef({ start: 80, end: 100 }); // Preserve zoom state

  // Track which bots are visible (all visible by default)
  const [visibleBots, setVisibleBots] = useState({});

  // Initialize visibility state when bots change
  useEffect(() => {
    const initialVisibility = {};
    bots.forEach(bot => {
      initialVisibility[bot.id] = true; // All visible by default
    });
    setVisibleBots(initialVisibility);
  }, [bots]);

  // Bot colors matching the card badges
  const botColors = {
    'v2_pure': '#3b82f6',            // Blue
    'v3_momentum': '#a855f7',        // Purple
    'consensus': '#10b981',          // Green
    'v2v3_or': '#f59e0b',            // Yellow/Gold
    'v2v3_or_aggressive': '#ec4899'  // Pink
  };

  // Initialize and update chart
  useEffect(() => {
    if (!chartRef.current || bots.length === 0) return;

    // Initialize chart instance
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'dark');
    }

    const chart = chartInstance.current;

    // Prepare series data for each bot
    const series = bots
      .filter(bot => visibleBots[bot.id] && equityCurves[bot.id]) // Only visible bots with data
      .map(bot => {
        const equityCurve = equityCurves[bot.id] || [];

        // Convert to [timestamp, equity] pairs
        // Parse UTC timestamp and convert to milliseconds (will display in local timezone)
        const data = equityCurve.map(point => {
          const date = new Date(point.timestamp); // Parse "2025-11-30T10:15:00Z" as UTC
          return [
            date.getTime(), // Milliseconds - ECharts will display in local time
            parseFloat(point.equity)
          ];
        });

        return {
          name: bot.name,
          type: 'line',
          smooth: true,
          symbol: 'none',
          lineStyle: {
            width: 2,
            color: botColors[bot.strategy_type] || '#6366f1'
          },
          itemStyle: {
            color: botColors[bot.strategy_type] || '#6366f1'
          },
          emphasis: {
            lineStyle: {
              width: 3
            }
          },
          data: data
        };
      });

    // Chart configuration
    const option = {
      backgroundColor: 'transparent',
      animation: false,  // Disable all animations - static chart
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        borderWidth: 1,
        textStyle: {
          color: '#e2e8f0',
          fontSize: 12
        },
        axisPointer: {
          type: 'cross',
          crossStyle: {
            color: '#64748b',
            type: 'dashed'
          },
          label: {
            backgroundColor: '#1e293b',
            borderColor: '#475569',
            borderWidth: 1,
            color: '#e2e8f0'
          }
        },
        formatter: function(params) {
          if (!params || params.length === 0) return '';

          // Format timestamp
          const timestamp = new Date(params[0].value[0]);
          const month = timestamp.toLocaleString('en-US', { month: 'short' });
          const day = timestamp.getDate();
          const hours = String(timestamp.getHours()).padStart(2, '0');
          const minutes = String(timestamp.getMinutes()).padStart(2, '0');
          const dateStr = `${month} ${day}, ${hours}:${minutes}`;

          let tooltip = `<div style="padding: 4px;">`;
          tooltip += `<div style="margin-bottom: 8px; font-weight: bold; color: #94a3b8;">${dateStr}</div>`;

          // Add each bot's equity
          params.forEach(param => {
            if (param.seriesName === 'Starting Capital') return; // Skip reference line

            const equity = param.value[1];
            const color = param.color;

            tooltip += `
              <div style="display: flex; align-items: center; margin-bottom: 4px;">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${color}; margin-right: 6px;"></span>
                <span style="color: #cbd5e1; min-width: 120px;">${param.seriesName}</span>
                <span style="color: #e2e8f0; font-weight: bold; margin-left: auto;">$${equity.toFixed(2)}</span>
              </div>
            `;
          });

          tooltip += `</div>`;
          return tooltip;
        }
      },
      legend: {
        show: false // We use custom toggles instead
      },
      grid: {
        left: '2%',
        right: '2%',
        bottom: '8%',
        top: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'time',
        boundaryGap: false,
        axisLine: {
          lineStyle: {
            color: '#475569'
          }
        },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 11,
          formatter: function(value) {
            const date = new Date(value);
            const month = date.toLocaleString('en-US', { month: 'short' });
            const day = date.getDate();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${month} ${day}, ${hours}:${minutes}`;
          }
        },
        axisPointer: {
          label: {
            formatter: function(params) {
              const date = new Date(params.value);
              const month = date.toLocaleString('en-US', { month: 'short' });
              const day = date.getDate();
              const hours = String(date.getHours()).padStart(2, '0');
              const minutes = String(date.getMinutes()).padStart(2, '0');
              return `${month} ${day}, ${hours}:${minutes}`;
            }
          }
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: '#1e293b',
            type: 'dashed'
          }
        }
      },
      yAxis: {
        type: 'value',
        name: 'Equity ($)',
        nameTextStyle: {
          color: '#94a3b8',
          fontSize: 12
        },
        scale: true,  // Enable auto-scaling based on data
        axisLine: {
          lineStyle: {
            color: '#475569'
          }
        },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 11,
          formatter: function(value) {
            return '$' + value.toFixed(0);
          }
        },
        splitLine: {
          lineStyle: {
            color: '#1e293b',
            type: 'dashed'
          }
        },
        // Add reference line at starting capital
        axisPointer: {
          label: {
            formatter: function(params) {
              return '$' + params.value.toFixed(2);
            }
          }
        }
      },
      dataZoom: [
        {
          type: 'inside',
          start: dataZoomState.current.start,
          end: dataZoomState.current.end,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true
        },
        {
          type: 'slider',
          start: dataZoomState.current.start,
          end: dataZoomState.current.end,
          height: 25,
          bottom: 10,
          borderColor: '#475569',
          fillerColor: 'rgba(59, 130, 246, 0.2)',
          handleStyle: {
            color: '#3b82f6'
          },
          textStyle: {
            color: '#94a3b8'
          }
        }
      ],
      series: [
        // Reference line at starting capital ($10,000)
        {
          name: 'Starting Capital',
          type: 'line',
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              color: '#64748b',
              type: 'dashed',
              width: 1.5
            },
            label: {
              show: false
            },
            data: [
              {
                yAxis: 10000
              }
            ]
          }
        },
        ...series
      ]
    };

    chart.setOption(option);

    // Save dataZoom state when user changes zoom
    const handleDataZoom = (params) => {
      if (params.batch && params.batch[0]) {
        dataZoomState.current = {
          start: params.batch[0].start,
          end: params.batch[0].end
        };
      }
    };
    chart.on('dataZoom', handleDataZoom);

    // Handle window resize
    const handleResize = () => {
      chart.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      chart.off('dataZoom', handleDataZoom);
      window.removeEventListener('resize', handleResize);
    };
  }, [bots, equityCurves, visibleBots]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  // Toggle bot visibility
  const toggleBot = (botId) => {
    setVisibleBots(prev => ({
      ...prev,
      [botId]: !prev[botId]
    }));
  };

  // Check if we have any data
  const hasData = bots.some(bot => equityCurves[bot.id] && equityCurves[bot.id].length > 0);

  if (bots.length === 0) {
    return (
      <div className="bg-void-900 border border-void-600 rounded-lg p-8 text-center">
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-gray-500">No bots to display</p>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="bg-void-900 border border-void-600 rounded-lg p-8 text-center">
        <div className="animate-pulse">
          <div className="h-8 bg-void-700 rounded w-48 mx-auto mb-4"></div>
          <div className="h-64 bg-void-700 rounded"></div>
        </div>
        <p className="text-gray-500 mt-4">Loading equity curves...</p>
      </div>
    );
  }

  // Calculate P&L percentages for legend
  const botStats = bots.map(bot => {
    const curve = equityCurves[bot.id] || [];
    if (curve.length === 0) return { ...bot, pnlPct: 0 };

    const lastPoint = curve[curve.length - 1];
    const firstPoint = curve[0];
    const currentEquity = parseFloat(lastPoint.equity);
    const startingEquity = parseFloat(firstPoint.equity);
    const totalPnL = currentEquity - startingEquity;
    const totalPnLPct = ((totalPnL / startingEquity) * 100);

    return { ...bot, pnlPct: totalPnLPct };
  });

  return (
    <div className="relative">
      {/* Chart Container - Full Width, No Padding */}
      <div
        ref={chartRef}
        className="w-full"
        style={{ height: '500px' }}
      />
    </div>
  );
}

export default EquityComparisonChart;
