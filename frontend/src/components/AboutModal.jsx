import React from 'react';
import { Link } from 'react-router-dom';

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
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-6 text-sm">

          {/* What We Do */}
          <section>
            <h3 className="text-lg font-bold text-gray-100 mb-3 flex items-center gap-2">
              <span className="text-neon-cyan">📊</span>
              What is PsiQuant?
            </h3>
            <p className="text-gray-300 mb-3">
              A market microstructure analysis tool for researchers and developers.
            </p>
            <p className="text-gray-400 mb-2">We show you:</p>
            <ul className="space-y-2 text-gray-300 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-neon-cyan mt-1">•</span>
                <span><strong className="text-gray-100">CVD (Cumulative Volume Delta)</strong>: Real-time order flow imbalance</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">•</span>
                <span><strong className="text-gray-100">Order Book Density</strong>: Liquidity distribution across price levels</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-1">•</span>
                <span><strong className="text-gray-100">Statistical Patterns</strong>: Recurring configurations in V2/V3 indicators</span>
              </li>
            </ul>
          </section>

          {/* What We Are NOT */}
          <section className="bg-red-500/5 border border-red-500/20 rounded-md p-4">
            <h3 className="text-lg font-bold text-red-400 mb-3 flex items-center gap-2">
              <span>❌</span>
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

          {/* Data Explanation */}
          <section>
            <h3 className="text-lg font-bold text-gray-100 mb-3 flex items-center gap-2">
              <span className="text-neon-cyan">🔬</span>
              Data Transparency
            </h3>
            <div className="space-y-3">
              <div>
                <h4 className="font-bold text-gray-100 mb-1">CVD</h4>
                <p className="text-gray-400 text-xs">
                  Industry-standard metric. Shows net buying/selling pressure.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-purple-400 mb-1">V2 (Weighted)</h4>
                <p className="text-gray-400 text-xs">
                  Experimental. Tracks order flow coherence with price using exponential decay (5%).
                </p>
              </div>
              <div>
                <h4 className="font-bold text-cyan-400 mb-1">V3 (Momentum)</h4>
                <p className="text-gray-400 text-xs">
                  Experimental. Detects divergence between cumulative flow and baseline.
                </p>
              </div>
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded p-3">
                <h4 className="font-bold text-yellow-400 mb-1">Statistical Patterns</h4>
                <p className="text-gray-400 text-xs mb-2">
                  Shows where V2/V3 correlated with price moves in last <strong>48 hours</strong>.
                </p>
                <p className="text-yellow-400 text-xs font-semibold">
                  ⚠️ Sample sizes are small (typically 14-25 trades). NOT predictive.
                </p>
              </div>
            </div>
          </section>

          {/* How to Use */}
          <section>
            <h3 className="text-lg font-bold text-gray-100 mb-3 flex items-center gap-2">
              <span className="text-neon-cyan">💡</span>
              How to Use This Tool
            </h3>
            <p className="text-gray-300 mb-3">
              Use Statistical Patterns as <strong className="text-neon-cyan">context</strong>, not <strong className="text-red-400">triggers</strong>:
            </p>
            <ul className="space-y-2 text-gray-400 text-xs ml-4">
              <li className="flex items-start gap-2">
                <span className="text-gray-500 mt-0.5">→</span>
                <span>Low sample (n&lt;30)? → High uncertainty, pattern may not persist</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500 mt-0.5">→</span>
                <span>CI 95% wide? → Results are noisy</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500 mt-0.5">→</span>
                <span>Mean return small? → Edge (if any) is minimal</span>
              </li>
            </ul>
            <p className="text-gray-100 font-semibold mt-4 text-center bg-void-800 border border-void-600 rounded py-2">
              This is a research tool. You decide what (if anything) to do with this data.
            </p>
          </section>

          {/* Learn More Link */}
          <section className="text-center">
            <Link
              to="/docs"
              onClick={onClose}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-neon-cyan to-neon-purple text-void-950 font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              <span>📚</span>
              Learn More: Full Documentation
            </Link>
            <p className="text-gray-500 text-xs mt-2">Detailed explanations of CVD, LOB analysis, and bot strategies</p>
          </section>

          {/* Legal Disclaimer */}
          <section className="bg-void-800 border border-void-600 rounded-md p-4">
            <h3 className="text-sm font-bold text-gray-400 mb-2">Legal Disclaimer</h3>
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
