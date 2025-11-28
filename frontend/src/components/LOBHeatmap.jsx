import React, { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || ''

/**
 * LOBHeatmap Component
 *
 * Visualizes Limit Order Book density heatmap with support/resistance levels
 *
 * Layout:
 * - Left panel (75%): Price evolution with V_diff overlay heatmap
 *   - Above current price: RED gradient (resistance, V_diff < 0)
 *   - Below current price: GREEN gradient (support, V_diff > 0)
 * - Right panel (25%): V_diff profile (horizontal bar chart)
 *
 * Data source: GET /api/lob-density
 * Update: Every 5 seconds via parent App component
 */
const LOBHeatmap = ({ data }) => {
  const chartRef = useRef(null)
  const chartInstanceRef = useRef(null)

  useEffect(() => {
    if (!chartRef.current) return

    // Initialize chart instance
    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current, null, {
        renderer: 'canvas',
        useDirtyRect: false
      })
    }

    const chart = chartInstanceRef.current

    // Cleanup on unmount
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose()
        chartInstanceRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!data || !chartInstanceRef.current) return

    const chart = chartInstanceRef.current
    const {
      price_bins,
      V_up,
      V_down,
      V_diff,
      V_diff_smooth,
      p_current
    } = data

    // Find current price index in bins
    let currentPriceIndex = 0
    for (let i = 0; i < price_bins.length; i++) {
      if (price_bins[i] >= p_current) {
        currentPriceIndex = i
        break
      }
    }

    // Prepare heatmap data: [price_index, time_index, V_diff_value]
    // Since we have single snapshot, time_index is always 0
    const heatmapData = price_bins.map((price, idx) => {
      return [0, idx, V_diff_smooth[idx]]
    })

    // Find min/max V_diff for color scaling
    const maxAbsVdiff = Math.max(...V_diff_smooth.map(v => Math.abs(v)))

    // Prepare profile data for right panel (V_diff vs price)
    const profileData = price_bins.map((price, idx) => ({
      price: price,
      vdiff: V_diff_smooth[idx],
      isSupport: V_diff_smooth[idx] > 0,
      isResistance: V_diff_smooth[idx] < 0
    }))

    const option = {
      backgroundColor: '#0a0e14',
      grid: [
        {
          // Left grid: Heatmap
          left: '5%',
          right: '30%',
          top: '8%',
          bottom: '10%',
          containLabel: true
        },
        {
          // Right grid: V_diff profile
          left: '72%',
          right: '5%',
          top: '8%',
          bottom: '10%',
          containLabel: false
        }
      ],
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(10, 14, 20, 0.95)',
        borderColor: '#1e2936',
        textStyle: { color: '#cbd5e1', fontSize: 11 },
        formatter: (params) => {
          if (params.componentType === 'series') {
            if (params.seriesName === 'LOB Density') {
              const priceIdx = params.data[1]
              const price = price_bins[priceIdx]
              const vdiff = V_diff_smooth[priceIdx]
              const vup = V_up[priceIdx]
              const vdown = V_down[priceIdx]

              return `
                <div style="padding: 4px;">
                  <div style="font-weight: bold; margin-bottom: 4px;">Price: $${price.toLocaleString()}</div>
                  <div style="color: ${vdiff > 0 ? '#10b981' : '#ef4444'};">
                    V_diff: ${vdiff.toFixed(2)} ${vdiff > 0 ? '(Support)' : '(Resistance)'}
                  </div>
                  <div style="color: #22d3ee; font-size: 10px;">V_up: ${vup.toFixed(2)}</div>
                  <div style="color: #f97316; font-size: 10px;">V_down: ${vdown.toFixed(2)}</div>
                </div>
              `
            } else if (params.seriesName === 'V_diff Profile') {
              const price = params.value[1]
              const vdiff = params.value[0]
              return `
                <div style="padding: 4px;">
                  <div style="font-weight: bold;">$${price.toLocaleString()}</div>
                  <div style="color: ${vdiff > 0 ? '#10b981' : '#ef4444'};">
                    ${vdiff.toFixed(2)} ${vdiff > 0 ? '(Support)' : '(Resistance)'}
                  </div>
                </div>
              `
            }
          }
          return ''
        }
      },
      visualMap: {
        type: 'piecewise',
        min: -maxAbsVdiff,
        max: maxAbsVdiff,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: '2%',
        pieces: [
          { min: 0, max: maxAbsVdiff, label: 'Support', color: '#10b981' },
          { min: -maxAbsVdiff, max: 0, label: 'Resistance', color: '#ef4444' }
        ],
        textStyle: {
          color: '#94a3b8',
          fontSize: 11
        },
        inRange: {
          color: ['#ef4444', '#f87171', '#1e2936', '#34d399', '#10b981']
        }
      },
      xAxis: [
        {
          // Left grid X axis (time - single snapshot)
          type: 'category',
          data: ['Current'],
          gridIndex: 0,
          axisLine: { lineStyle: { color: '#1e2936' } },
          axisLabel: {
            color: '#64748b',
            fontSize: 10
          },
          splitLine: { show: false }
        },
        {
          // Right grid X axis (V_diff values)
          type: 'value',
          gridIndex: 1,
          axisLine: { show: false },
          axisLabel: { show: false },
          splitLine: { show: false },
          min: -maxAbsVdiff * 1.1,
          max: maxAbsVdiff * 1.1
        }
      ],
      yAxis: [
        {
          // Left grid Y axis (price levels)
          type: 'category',
          data: price_bins.map(p => Math.round(p)),
          gridIndex: 0,
          axisLine: { lineStyle: { color: '#1e2936' } },
          axisLabel: {
            color: '#64748b',
            fontSize: 10,
            formatter: (value) => {
              // Highlight current price
              if (Math.abs(value - p_current) < 50) {
                return `{current|${value}}`
              }
              return value
            },
            rich: {
              current: {
                color: '#22d3ee',
                fontWeight: 'bold',
                backgroundColor: '#1e293b',
                padding: [2, 4],
                borderRadius: 2
              }
            }
          },
          splitLine: {
            show: true,
            lineStyle: { color: '#1e2936', opacity: 0.3 }
          }
        },
        {
          // Right grid Y axis (price levels for profile)
          type: 'category',
          data: price_bins.map(p => Math.round(p)),
          gridIndex: 1,
          axisLine: { show: false },
          axisLabel: { show: false },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: 'LOB Density',
          type: 'heatmap',
          data: heatmapData,
          xAxisIndex: 0,
          yAxisIndex: 0,
          label: { show: false },
          emphasis: {
            itemStyle: {
              borderColor: '#22d3ee',
              borderWidth: 2
            }
          },
          itemStyle: {
            borderColor: '#0a0e14',
            borderWidth: 1
          }
        },
        {
          name: 'Current Price',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: [[0, currentPriceIndex]],
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: {
            color: '#22d3ee',
            borderColor: '#0a0e14',
            borderWidth: 2
          },
          lineStyle: {
            color: '#22d3ee',
            width: 2,
            type: 'dashed'
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              color: '#22d3ee',
              width: 2,
              type: 'dashed'
            },
            data: [
              {
                yAxis: currentPriceIndex,
                label: {
                  formatter: `Current: $${Math.round(p_current).toLocaleString()}`,
                  position: 'insideEndTop',
                  color: '#22d3ee',
                  fontSize: 11,
                  fontWeight: 'bold',
                  backgroundColor: '#0a0e14',
                  padding: [4, 8],
                  borderRadius: 4
                }
              }
            ]
          }
        },
        {
          name: 'V_diff Profile',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: profileData.map((d, idx) => ({
            value: [d.vdiff, d.price],
            itemStyle: {
              color: d.vdiff > 0 ? '#10b981' : '#ef4444',
              opacity: 0.8
            }
          })),
          barWidth: '80%',
          label: { show: false },
          emphasis: {
            itemStyle: {
              opacity: 1,
              borderColor: '#22d3ee',
              borderWidth: 1
            }
          }
        }
      ]
    }

    chart.setOption(option, true)

    // Handle window resize
    const handleResize = () => {
      chart.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [data])

  return (
    <div className="w-full h-full flex flex-col bg-void-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-void-700">
        <h2 className="text-sm font-semibold text-gray-200">
          LOB Density Heatmap
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Support/Resistance levels based on effective liquidity (V_eff) from directional runs
        </p>
      </div>

      {/* Chart Container */}
      <div className="flex-1 p-4">
        {data ? (
          <div ref={chartRef} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-void-600 border-t-neon-cyan rounded-full animate-spin mx-auto mb-3" />
              <div className="text-sm text-gray-400">Loading LOB density data...</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LOBHeatmap
