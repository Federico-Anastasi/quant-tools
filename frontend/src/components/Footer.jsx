import React from 'react';

/**
 * Footer - Professional trading terminal footer with uptime and social links
 * @param {Object} props - Component props
 * @param {string} props.uptime - Uptime display string (e.g., "42 days, 3 hours")
 */
function Footer({ uptime = '--' }) {
  return (
    <footer className="bg-void-900 border-t border-void-600 px-2 sm:px-6 py-2 sm:py-3">
      {/* Disclaimer */}
      <div className="text-[9px] text-gray-600 text-center mb-2 border-b border-void-600 pb-2">
        Research tool · Not financial advice · Past patterns ≠ future results
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">

        {/* Left Section - Data Source */}
        <div className="flex items-center gap-2 text-[10px] sm:text-xs text-gray-500">
          <span>Real-time data BTC PERP from Hyperliquid</span>
        </div>

        {/* Right Section - Branding & Links */}
        <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs">

          {/* PsiQuant Branding */}
          <div className="flex items-center gap-1.5 text-gray-400">
            <span className="font-bold text-gray-100">PsiQuant</span>
            <span className="text-gray-500">v1.0</span>
            <span className="text-gray-500">by</span>
          </div>

          {/* Twitter/X Link */}
          <a
            href="https://twitter.com/FedeAnastasi"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 sm:gap-1.5 text-gray-400 hover:text-neon-cyan transition-colors duration-200"
            title="Follow @FedeAnastasi on X (Twitter)"
          >
            <svg
              className="w-3 h-3 sm:w-3.5 sm:h-3.5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className="hidden sm:inline font-semibold">@FedeAnastasi</span>
          </a>

          {/* GitHub Link */}
          <a
            href="https://github.com/FedeAnastasi"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 sm:gap-1.5 text-gray-400 hover:text-neon-cyan transition-colors duration-200"
            title="Visit GitHub"
          >
            <svg
              className="w-3 h-3 sm:w-3.5 sm:h-3.5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.868-.013-1.703-2.782.603-3.369-1.343-3.369-1.343-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.547 2.914 1.186.092-.923.35-1.546.636-1.903-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            <span className="hidden sm:inline font-semibold">GitHub</span>
          </a>

        </div>
      </div>
    </footer>
  );
}

export default Footer;
