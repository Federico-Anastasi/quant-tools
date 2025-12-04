import React from 'react';
import { Link } from 'react-router-dom';
import { Info, XCircle, BookOpen, X } from 'lucide-react';

/**
 * AboutModal - Educational modal explaining PsiQuant's purpose and positioning
 * Positions tool as data analytics/research platform, NOT trading signals
 */
function AboutModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-void-900 border border-void-600 rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-void-900 border-b border-void-600 px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold text-gray-100">About PsiQuant</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-6 text-sm">

          {/* What We Do */}
          <section>
            <h3 className="text-lg font-bold text-gray-100 mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-neon-cyan" />
              What is PsiQuant?
            </h3>
            <p className="text-gray-300 mb-3">
              A market microstructure analysis tool for researchers and developers.
            </p>
            <p className="text-gray-400 mb-2">We show you:</p>
            <ul className="space-y-2 text-gray-300 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-gray-300 mt-1">•</span>
                <span><strong className="text-gray-100">CVD (Cumulative Volume Delta)</strong>: Real-time order flow imbalance</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-300 mt-1">•</span>
                <span><strong className="text-gray-100">Liquidity Density</strong>: Price levels where significant volume was required to move price, indicating potential support and resistance</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-300 mt-1">•</span>
                <span><strong className="text-gray-100">Statistical Patterns</strong>: Recurring configurations in V2/V3 indicators</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-300 mt-1">•</span>
                <span><strong className="text-gray-100">Bot Leaderboard</strong>: Paper trading performance comparison across strategies</span>
              </li>
            </ul>
          </section>

          {/* What We Are NOT */}
          <section className="bg-red-500/5 border border-red-500/20 rounded-md p-4">
            <h3 className="text-lg font-bold text-red-400 mb-3 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              What We Are NOT
            </h3>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-1">✗</span>
                <span>A trading signal service</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-1">✗</span>
                <span>Investment advice</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-1">✗</span>
                <span>A predictive model</span>
              </li>
            </ul>
          </section>

          {/* Learn More Link */}
          <section className="text-center">
            <a
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-void-800 border border-void-600 text-gray-300 font-medium rounded-lg hover:bg-void-700 hover:border-void-500 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              Learn More: Full Documentation
            </a>
            <p className="text-gray-500 text-xs mt-2">Detailed explanations of CVD, LOB analysis, and bot strategies</p>
          </section>

          {/* Legal Disclaimer */}
          <section className="bg-void-800 border border-void-600 rounded-md p-4">
            <p className="text-gray-500 text-xs leading-relaxed">
              For educational and research purposes only. Not financial advice.
              Past performance does not indicate future results.
              Trading involves risk of loss.
            </p>
          </section>

          {/* Brand Voice */}
          <section className="text-center border-t border-void-600 pt-4">
            <p className="text-gray-500 text-xs italic">
              "Turning equations into code"
            </p>
            <p className="text-gray-600 text-[10px] mt-1">
              Built by developers for researchers
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}

export default AboutModal;
