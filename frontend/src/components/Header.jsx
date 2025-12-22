import React from 'react';
import { BarChart3, Layers, Bot, History, Radio, Info } from 'lucide-react';

/**
 * Header - Professional quant trading platform header
 * Mobile-first design with clean progressive enhancement
 */
function Header({
  status = 'connected',
  btcPrice = '--',
  activeTab = 'cvd',
  onTabChange = () => {},
  onMenuToggle = () => {},
  sidebarOpen = false,
  onAboutClick = () => {}
}) {
  return (
    <header className="bg-void-900 border-b border-void-700">
      {/* MOBILE: Single row, compact */}
      <div className="lg:hidden h-14 px-3 flex items-center justify-between gap-2">

        {/* Left: Logo */}
        <img src="/logo.svg" alt="PsiQuant" className="w-8 h-8" />

        {/* Center: Price */}
        <div className="flex items-center gap-2 bg-void-800/60 border border-void-700 rounded-md px-3 py-1.5">
          <div className="w-1 h-1 rounded-full bg-neon-cyan animate-pulse" />
          <span className="text-[11px] font-bold text-gray-300">BTC</span>
          <span className="text-lg font-black text-white font-mono">{btcPrice}</span>
        </div>

        {/* Right: About */}
        <button
          onClick={onAboutClick}
          className="p-2 text-gray-400 hover:text-amber-400 transition-colors"
          title="About"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>

      {/* MOBILE: Second row for tabs */}
      <div className="lg:hidden border-t border-void-800">
        <div className="flex items-center justify-around px-2 py-2">
          <button
            onClick={() => onTabChange('cvd')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md transition-all ${
              activeTab === 'cvd'
                ? 'bg-neon-cyan/15 text-neon-cyan'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <BarChart3 className="w-4 h-4 flex-shrink-0" />
            <span className="text-[10px] font-bold">Flow</span>
          </button>

          <button
            onClick={() => onTabChange('lob')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md transition-all ${
              activeTab === 'lob'
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Layers className="w-4 h-4 flex-shrink-0" />
            <span className="text-[10px] font-bold">Liq</span>
          </button>

          <button
            onClick={() => onTabChange('bots')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md transition-all ${
              activeTab === 'bots'
                ? 'bg-purple-500/15 text-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Bot className="w-4 h-4 flex-shrink-0" />
            <span className="text-[10px] font-bold">Bots</span>
          </button>

          <button
            onClick={() => onTabChange('backtest')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md transition-all ${
              activeTab === 'backtest'
                ? 'bg-amber-500/15 text-amber-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <History className="w-4 h-4 flex-shrink-0" />
            <span className="text-[10px] font-bold">Test</span>
          </button>

          <button
            onClick={() => onTabChange('live')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md transition-all ${
              activeTab === 'live'
                ? 'bg-red-500/15 text-red-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Radio className="w-4 h-4 flex-shrink-0" />
            <span className="text-[10px] font-bold">Live</span>
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          </button>
        </div>
      </div>

      {/* DESKTOP: Single row, spacious */}
      <div className="hidden lg:flex h-14 px-6 items-center justify-between">

        {/* Left: Logo + Brand + Price + Tabs (all grouped together) */}
        <div className="flex items-center gap-4">
          {/* Logo + Brand */}
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="PsiQuant" className="w-9 h-9" />
            <div className="flex flex-col">
              <h1 className="text-sm font-bold text-white leading-none">PsiQuant</h1>
              <span className="text-[8px] font-medium text-gray-500 tracking-widest uppercase leading-none mt-0.5">Order Flow Analytics</span>
            </div>
          </div>

          {/* Price Badge */}
          <div className="flex items-center gap-2.5 bg-void-800/50 border border-void-700 rounded-md px-3 py-1.5">
            <div className="w-1 h-1 rounded-full bg-neon-cyan animate-pulse shadow-sm shadow-neon-cyan" />
            <span className="text-xs font-bold text-gray-200">BTC</span>
            <span className="text-xl font-black text-white font-mono">{btcPrice}</span>
            <span className="text-[9px] font-medium text-gray-500">PERP · Hyperliquid</span>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-0.5 bg-void-800/40 border border-void-700 rounded-md p-0.5">
          <button
            onClick={() => onTabChange('cvd')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-bold tracking-wide transition-all ${
              activeTab === 'cvd'
                ? 'bg-neon-cyan/20 text-neon-cyan shadow-md'
                : 'text-gray-400 hover:text-gray-300 hover:bg-void-700/50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Order Flow
          </button>

          <button
            onClick={() => onTabChange('lob')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-bold tracking-wide transition-all ${
              activeTab === 'lob'
                ? 'bg-emerald-500/20 text-emerald-400 shadow-md'
                : 'text-gray-400 hover:text-gray-300 hover:bg-void-700/50'
            }`}
          >
            <Layers className="w-4 h-4" />
            Liquidity
          </button>

          <button
            onClick={() => onTabChange('bots')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-bold tracking-wide transition-all ${
              activeTab === 'bots'
                ? 'bg-purple-500/20 text-purple-400 shadow-md'
                : 'text-gray-400 hover:text-gray-300 hover:bg-void-700/50'
            }`}
          >
            <Bot className="w-4 h-4" />
            Bots
          </button>

          <button
            onClick={() => onTabChange('backtest')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-bold tracking-wide transition-all ${
              activeTab === 'backtest'
                ? 'bg-amber-500/20 text-amber-400 shadow-md'
                : 'text-gray-400 hover:text-gray-300 hover:bg-void-700/50'
            }`}
          >
            <History className="w-4 h-4" />
            Backtest
          </button>

          <button
            onClick={() => onTabChange('live')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-bold tracking-wide transition-all ${
              activeTab === 'live'
                ? 'bg-red-500/20 text-red-400 shadow-md'
                : 'text-gray-400 hover:text-gray-300 hover:bg-void-700/50'
            }`}
          >
            <Radio className="w-4 h-4" />
            Live
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          </button>
        </div>
        </div>

        {/* Right: About */}
        <button
          onClick={onAboutClick}
          className="flex items-center gap-2 bg-void-800 hover:bg-void-700 border border-void-700 hover:border-amber-400/40 text-gray-300 hover:text-amber-400 px-4 py-2 rounded-lg text-xs font-bold transition-all"
        >
          <Info className="w-4 h-4" />
          About
        </button>
      </div>
    </header>
  );
}

export default Header;
