import React from 'react';

/**
 * PlayerControls - Backtest playback controls
 * Play/Pause, Step Forward/Back, Speed selector, Position indicator
 */
function PlayerControls({
  isPlaying = false,
  currentIndex = 0,
  totalCandles = 0,
  playSpeed = 500,
  onPlayPause = () => {},
  onStepBack = () => {},
  onStepForward = () => {},
  onSpeedChange = () => {},
  onReset = () => {},
  onSliderChange = () => {}
}) {
  return (
    <div className="bg-void-800 border-b border-void-600 p-3">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Playback Controls */}
        <div className="flex items-center gap-2">
          {/* Reset Button */}
          <button
            onClick={onReset}
            className="p-2.5 bg-void-700 hover:bg-void-600 border border-void-500 rounded-md text-gray-300 hover:text-white transition-all"
            title="Reset to start"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Step Back */}
          <button
            onClick={onStepBack}
            disabled={currentIndex <= 0}
            className="p-2.5 bg-void-700 hover:bg-void-600 border border-void-500 rounded-md text-gray-300 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title="Step back (1 candle)"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            onClick={onPlayPause}
            disabled={currentIndex >= totalCandles - 1}
            className={`px-5 py-2.5 rounded-md font-bold text-sm transition-all ${
              isPlaying
                ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-400 hover:bg-amber-500/30'
                : 'bg-neon-cyan/20 border-2 border-neon-cyan text-neon-cyan hover:bg-neon-cyan/30'
            } disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            {isPlaying ? (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Pause
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                Play
              </div>
            )}
          </button>

          {/* Step Forward */}
          <button
            onClick={onStepForward}
            disabled={currentIndex >= totalCandles - 1}
            className="p-2.5 bg-void-700 hover:bg-void-600 border border-void-500 rounded-md text-gray-300 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title="Step forward (1 candle)"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798l-5.445-3.63z" />
            </svg>
          </button>
        </div>

        {/* Center: Position Indicator */}
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-400">
            Candle <span className="text-neon-cyan font-bold font-mono">{currentIndex + 1}</span> / {totalCandles}
          </div>
          <div className="w-px h-6 bg-void-600" />
          <div className="text-xs text-gray-400">
            Progress: <span className="text-amber-400 font-bold">{Math.round((currentIndex / Math.max(1, totalCandles - 1)) * 100)}%</span>
          </div>
        </div>

        {/* Right: Speed Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400 font-medium">Speed:</label>
          <select
            value={playSpeed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            className="bg-void-700 border border-void-500 text-gray-300 text-xs font-mono rounded-md px-3 py-2 focus:outline-none focus:border-neon-cyan transition-all"
          >
            <option value={100}>Fast (0.1s)</option>
            <option value={250}>Normal (0.25s)</option>
            <option value={500}>Slow (0.5s)</option>
            <option value={1000}>Very Slow (1s)</option>
            <option value={2000}>Ultra Slow (2s)</option>
          </select>
        </div>
      </div>

      {/* Interactive Slider */}
      <div className="mt-3 relative">
        {/* Slider Track Background */}
        <div className="w-full h-1 bg-void-700 rounded-full absolute top-1/2 -translate-y-1/2 pointer-events-none">
          <div
            className="h-full bg-gradient-to-r from-neon-cyan to-amber-400 transition-all duration-200 rounded-full"
            style={{ width: `${(currentIndex / Math.max(1, totalCandles - 1)) * 100}%` }}
          />
        </div>

        {/* Slider Input */}
        <input
          type="range"
          min="0"
          max={Math.max(0, totalCandles - 1)}
          value={currentIndex}
          onChange={(e) => onSliderChange(Number(e.target.value))}
          className="w-full h-2 appearance-none bg-transparent cursor-pointer relative z-10"
          style={{
            WebkitAppearance: 'none',
          }}
        />

        <style dangerouslySetInnerHTML={{__html: `
          input[type='range']::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: linear-gradient(135deg, #00d9ff, #0ea5e9);
            border: 2px solid #0c1117;
            cursor: pointer;
            transition: all 0.2s;
          }

          input[type='range']::-webkit-slider-thumb:hover {
            width: 20px;
            height: 20px;
            box-shadow: 0 0 12px rgba(0, 217, 255, 0.6);
          }

          input[type='range']::-moz-range-thumb {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: linear-gradient(135deg, #00d9ff, #0ea5e9);
            border: 2px solid #0c1117;
            cursor: pointer;
            transition: all 0.2s;
          }

          input[type='range']::-moz-range-thumb:hover {
            width: 20px;
            height: 20px;
            box-shadow: 0 0 12px rgba(0, 217, 255, 0.6);
          }
        `}} />
      </div>
    </div>
  );
}

export default PlayerControls;
