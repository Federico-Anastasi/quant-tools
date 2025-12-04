import React from 'react';

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
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>

      {/* MOBILE: Second row for tabs */}
      <div className="lg:hidden border-t border-void-800">
        <div className="flex items-center justify-around px-2 py-2">
          <button
            onClick={() => onTabChange('cvd')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md transition-all ${
              activeTab === 'cvd'
                ? 'bg-neon-cyan/15 text-neon-cyan'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
            <span className="text-xs font-bold">Order Flow</span>
          </button>

          <button
            onClick={() => onTabChange('lob')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md transition-all ${
              activeTab === 'lob'
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3z" />
            </svg>
            <span className="text-xs font-bold">Liquidity</span>
          </button>

          <button
            onClick={() => onTabChange('bots')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md transition-all ${
              activeTab === 'bots'
                ? 'bg-purple-500/15 text-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-bold">Bots</span>
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
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
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
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3z" />
            </svg>
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
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" clipRule="evenodd" />
            </svg>
            Bots
          </button>
        </div>
        </div>

        {/* Right: About */}
        <button
          onClick={onAboutClick}
          className="flex items-center gap-2 bg-void-800 hover:bg-void-700 border border-void-700 hover:border-amber-400/40 text-gray-300 hover:text-amber-400 px-4 py-2 rounded-lg text-xs font-bold transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          About
        </button>
      </div>
    </header>
  );
}

export default Header;
