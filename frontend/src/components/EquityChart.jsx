import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

/**
 * EquityChart - Displays live account equity curve (last 24h)
 *
 * @param {Array} snapshots - Equity snapshots from /api/live/equity-curve
 * @param {Object} stats - Stats object with ROI, drawdown, etc.
 */
const EquityChart = ({ snapshots, stats }) => {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current || !snapshots || snapshots.length === 0) return;

    // Initialize chart
    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current, 'dark');
    }

    const timestamps = snapshots.map(s => s.timestamp);
    const equity = snapshots.map(s => s.equity);
    const balance = snapshots.map(s => s.balance);

    const option = {
      backgroundColor: '#0f1419',
      animation: false,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params) => {
          const time = new Date(params[0].axisValue).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          let result = `${time}<br/>`;
          params.forEach(p => {
            result += `${p.marker}${p.seriesName}: $${p.value.toFixed(2)}<br/>`;
          });
          return result;
        }
      },
      grid: { left: 60, right: 60, top: 30, bottom: 50, containLabel: false },
      xAxis: {
        type: 'category',
        data: timestamps,
        axisLabel: {
          color: '#8b93a0',
          fontSize: 10,
          formatter: (v) => {
            const d = new Date(v);
            return `${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
          }
        },
        axisLine: { lineStyle: { color: '#2a2e39' } },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        scale: true,  // Don't force zero baseline - scale to data
        axisLabel: {
          color: '#8b93a0',
          fontSize: 10,
          formatter: '${value}'
        },
        axisLine: { lineStyle: { color: '#2a2e39' } },
        splitLine: { lineStyle: { color: '#2a2e39', type: 'dashed' } }
      },
      series: [
        {
          name: 'Equity',
          type: 'line',
          data: equity,
          smooth: false,
          lineStyle: { width: 2, color: '#22c55e' },
          itemStyle: { color: '#22c55e' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(34, 197, 94, 0.2)' },
              { offset: 1, color: 'rgba(34, 197, 94, 0.0)' }
            ])
          }
        },
        {
          name: 'Balance',
          type: 'line',
          data: balance,
          smooth: false,
          lineStyle: { width: 1, color: '#06b6d4', type: 'dashed' },
          itemStyle: { color: '#06b6d4' }
        }
      ]
    };

    chartInstanceRef.current.setOption(option);

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, [snapshots]);

  if (!snapshots || snapshots.length === 0) {
    return (
      <div className="bg-void-800/50 border border-void-600/50 rounded-lg p-4 h-[200px] flex items-center justify-center">
        <div className="text-sm text-gray-500">No equity data available</div>
      </div>
    );
  }

  return (
    <div className="bg-void-800/50 border border-void-600/50 rounded-lg p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-gray-200 tracking-wide uppercase">Equity Curve (24h)</h3>
        {stats && (
          <div className="flex gap-4 text-xs">
            <span className={stats.roi_pct >= 0 ? 'text-green-400' : 'text-red-400'}>
              ROI: {stats.roi_pct >= 0 ? '+' : ''}{stats.roi_pct.toFixed(2)}%
            </span>
            <span className="text-red-400">
              Max DD: {stats.max_drawdown_pct.toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div ref={chartRef} className="w-full h-[200px]" />
    </div>
  );
};

export default EquityChart;
