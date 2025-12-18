/**
 * Zone Renderer - Utilities for rendering historical zone bands in charts
 *
 * Used by:
 * - BacktestChart.jsx (backtest zone overlay)
 */

/**
 * Calculate historical zone bands for ECharts markArea
 *
 * Converts zone snapshots into temporal bands that show when each zone was active.
 * Each zone displays:
 * - Primary zone (best performing direction) with higher opacity
 * - Symmetric opposite zone with lower opacity
 *
 * @param {Array} zones - Array of zone snapshots with timestamps
 * @param {string} signalType - 'cumulative_v2' or 'cumulative_v3'
 * @param {Array} timestamps - Array of candle timestamps from data
 * @returns {Array} ECharts markArea data format
 */
export const calculateHistoricalZoneBands = (zones, signalType, timestamps) => {
  // Validation: Ensure inputs are valid
  if (!zones || zones.length === 0) {
    console.warn('[zoneRenderer] No zones provided');
    return [];
  }

  if (!timestamps || timestamps.length === 0) {
    console.warn('[zoneRenderer] No timestamps provided');
    return [];
  }

  if (!Array.isArray(zones) || !Array.isArray(timestamps)) {
    console.error('[zoneRenderer] Invalid input types - zones and timestamps must be arrays');
    return [];
  }

  const bands = [];

  for (let i = 0; i < zones.length; i++) {
    const zone = zones[i];

    if (!zone || !zone.timestamp) {
      console.warn('[zoneRenderer] Skipping invalid zone at index', i);
      continue;
    }

    const zoneData = zone[signalType];

    if (!zoneData) {
      continue;  // This zone doesn't have data for this signal type
    }

    const { is_long, zone_min, zone_max } = zoneData;

    // Validate zone data
    if (typeof is_long !== 'boolean' ||
        typeof zone_min !== 'number' ||
        typeof zone_max !== 'number') {
      console.warn('[zoneRenderer] Invalid zone data at index', i, zoneData);
      continue;
    }

    // Find the closest timestamp in the data for this zone
    const zoneTime = new Date(zone.timestamp).getTime();
    let startIdx = 0;
    let minDiff = Infinity;

    for (let j = 0; j < timestamps.length; j++) {
      const candleTime = new Date(timestamps[j]).getTime();
      const diff = Math.abs(candleTime - zoneTime);
      if (diff < minDiff) {
        minDiff = diff;
        startIdx = j;
      }
    }

    // End index is either next zone's index or last candle
    let endIdx = timestamps.length - 1;
    if (i < zones.length - 1) {
      const nextZone = zones[i + 1];
      if (nextZone && nextZone.timestamp) {
        const nextZoneTime = new Date(nextZone.timestamp).getTime();
        minDiff = Infinity;
        for (let j = startIdx; j < timestamps.length; j++) {
          const candleTime = new Date(timestamps[j]).getTime();
          const diff = Math.abs(candleTime - nextZoneTime);
          if (diff < minDiff) {
            minDiff = diff;
            endIdx = j;
          }
        }
      }
    }

    // Use actual timestamp values from the data (not zone timestamps)
    const startTime = timestamps[startIdx];
    let endTime = timestamps[endIdx];

    // CRITICAL FIX: If start and end are the same (single candle), extend endTime
    // to create a visible band. Add 5 minutes (300000ms) to make zone visible.
    if (startIdx === endIdx) {
      const startMs = new Date(startTime).getTime();
      endTime = new Date(startMs + 5 * 60 * 1000).toISOString();
    }

    // Primary zone (best performing direction)
    const primaryColor = is_long ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)';
    bands.push([
      { xAxis: startTime, yAxis: zone_min, itemStyle: { color: primaryColor } },
      { xAxis: endTime, yAxis: zone_max }
    ]);

    // Symmetric zone (opposite direction)
    const symColor = is_long ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)';
    bands.push([
      { xAxis: startTime, yAxis: -zone_max, itemStyle: { color: symColor } },
      { xAxis: endTime, yAxis: -zone_min }
    ]);
  }

  return bands;
};
