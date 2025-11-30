import React from 'react';

/**
 * Header - Professional quant trading platform header
 * Premium UX/UI with perfect spacing, gradient accents, and fluid interactions
 * @param {Object} props - Component props
 * @param {string} props.status - Connection status: 'connected'|'error'|'connecting'
 * @param {function} props.onScreenshot - Callback for screenshot button
 * @param {string} props.activeTab - Current active tab: 'cvd'|'lob'
 * @param {function} props.onTabChange - Callback for tab change (tab) => void
 * @param {function} props.onMenuToggle - Callback for mobile menu toggle
 * @param {boolean} props.sidebarOpen - Sidebar open state
 * @param {function} props.onAboutClick - Callback for About modal
 */
function Header({
  status = 'connected',
  onScreenshot = () => {},
  activeTab = 'cvd',
  onTabChange = () => {},
  onMenuToggle = () => {},
  sidebarOpen = false,
  onAboutClick = () => {}
}) {
  // Status configuration with premium visuals
  const statusConfig = {
    connected: {
      dotColor: 'bg-neon-cyan',
      textColor: 'text-neon-cyan',
      bgColor: 'bg-neon-cyan/10',
      borderColor: 'border-neon-cyan/20',
      text: 'Live',
      animate: true
    },
    connecting: {
      dotColor: 'bg-yellow-400',
      textColor: 'text-yellow-400',
      bgColor: 'bg-yellow-400/10',
      borderColor: 'border-yellow-400/20',
      text: 'Connecting',
      animate: true
    },
    error: {
      dotColor: 'bg-red-500',
      textColor: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/20',
      text: 'Error',
      animate: false
    }
  };

  const config = statusConfig[status] || statusConfig.connected;

  return (
    <header className="bg-gradient-to-b from-void-800 to-void-900 border-b border-void-600/50 shadow-xl">
      <div className="h-12 px-2 sm:px-4 flex items-center justify-between gap-2">

        {/* Left Section - Hamburger + Brand + Market + Tabs */}
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">

          {/* Hamburger Menu (Mobile Only) */}
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 -ml-2 text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Logo Icon - Psi Symbol */}
            <div className="relative flex items-center justify-center">
              <img
                src="/logo.svg"
                alt="PsiQuant Logo"
                className="w-8 h-8 sm:w-9 sm:h-9"
              />
            </div>

            {/* Brand Text */}
            <div className="hidden sm:flex flex-col justify-center">
              <h1 className="text-sm font-bold tracking-tight text-gray-100 leading-none">
                PsiQuant
              </h1>
              <span className="text-[9px] font-medium text-gray-500 tracking-wider uppercase leading-none mt-0.5">
                Order Flow Analytics
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-6 bg-void-600" />

          {/* Market Badge */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-void-700/40 border border-void-600/50 rounded-md px-2 sm:px-2.5 py-1">
            <div className="w-1 h-1 rounded-full bg-neon-cyan animate-pulse shadow-sm shadow-neon-cyan" />
            <span className="text-[10px] sm:text-[11px] font-bold text-gray-200 tracking-wide">LIVE BTC-PERP</span>
            <span className="hidden sm:inline text-[9px] font-medium text-gray-500">Hyperliquid</span>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-6 bg-void-600" />

          {/* Tab Navigation */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-void-700/30 border border-void-600/40 rounded-md p-0.5">
            <button
              onClick={() => onTabChange('cvd')}
              className={`
                relative px-2 sm:px-3 py-1 rounded text-[11px] font-bold tracking-wide transition-all duration-200
                ${activeTab === 'cvd'
                  ? 'bg-gradient-to-br from-neon-cyan/20 to-neon-cyan/10 text-neon-cyan shadow-md shadow-neon-cyan/10 border border-neon-cyan/30'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-void-600/40'
                }
              `}
              title="Order Flow"
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
                <span className="hidden md:inline">Order Flow</span>
              </span>
            </button>

            <button
              onClick={() => onTabChange('lob')}
              className={`
                relative px-2 sm:px-3 py-1 rounded text-[11px] font-bold tracking-wide transition-all duration-200
                ${activeTab === 'lob'
                  ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 text-emerald-400 shadow-md shadow-emerald-500/10 border border-emerald-500/30'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-void-600/40'
                }
              `}
              title="Liquidity Density"
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
                </svg>
                <span className="hidden md:inline">Liquidity Density</span>
              </span>
            </button>

            <button
              onClick={() => onTabChange('bots')}
              className={`
                relative px-2 sm:px-3 py-1 rounded text-[11px] font-bold tracking-wide transition-all duration-200
                ${activeTab === 'bots'
                  ? 'bg-gradient-to-br from-purple-500/20 to-purple-500/10 text-purple-400 shadow-md shadow-purple-500/10 border border-purple-500/30'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-void-600/40'
                }
              `}
              title="Trading Bots"
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                </svg>
                <span className="hidden md:inline">Bots</span>
              </span>
            </button>
          </div>
        </div>

        {/* Right Section - Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-3">

          {/* About Button */}
          <button
            onClick={onAboutClick}
            className="
              group relative overflow-hidden
              bg-void-700 hover:bg-void-600
              border border-void-600/50 hover:border-amber-400/30
              text-gray-300 hover:text-amber-400
              px-2 sm:px-3 py-1 rounded-md
              text-[11px] font-bold tracking-wide
              transition-all duration-200
              shadow-md hover:shadow-lg hover:shadow-amber-400/5
              flex items-center gap-1.5
            "
            title="About PsiQuant"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-400/0 via-amber-400/5 to-amber-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
            <svg
              className="w-3.5 h-3.5 relative z-10"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="hidden md:inline relative z-10">About</span>
          </button>

          {/* Screenshot Button - Icon only on mobile */}
          <button
            onClick={onScreenshot}
            className="
              group relative overflow-hidden
              bg-void-700 hover:bg-void-600
              border border-void-600/50 hover:border-neon-cyan/30
              text-gray-300 hover:text-neon-cyan
              px-2 sm:px-3 py-1 rounded-md
              text-[11px] font-bold tracking-wide
              transition-all duration-200
              shadow-md hover:shadow-lg hover:shadow-neon-cyan/5
              flex items-center gap-1.5
            "
            title="Take screenshot"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan/0 via-neon-cyan/5 to-neon-cyan/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
            <svg
              className="w-3.5 h-3.5 relative z-10"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="hidden sm:inline relative z-10">Screenshot</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
