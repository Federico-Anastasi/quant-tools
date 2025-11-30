import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, BarChart3, Target, Zap, Shield, Award } from 'lucide-react';

export default function Docs() {
  return (
    <div className="min-h-screen bg-void-950 text-void-50">
      {/* Navigation */}
      <div className="sticky top-0 z-50 border-b border-void-700 bg-void-900/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-neon-cyan hover:text-neon-cyan/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-pink bg-clip-text text-transparent">
            PsiQuant Documentation
          </h1>
          <p className="text-xl text-void-300 max-w-3xl mx-auto">
            Advanced algorithmic trading system using Cumulative Volume Delta (CVD) analysis
            and Limit Order Book (LOB) density patterns for cryptocurrency markets
          </p>
        </div>

        {/* What is PsiQuant? */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-6 text-neon-cyan flex items-center gap-3">
            <TrendingUp className="w-8 h-8" />
            What is PsiQuant?
          </h2>
          <div className="bg-void-900 border border-void-700 rounded-lg p-8 space-y-4">
            <p className="text-void-200 leading-relaxed">
              PsiQuant is an experimental quantitative trading platform that combines advanced market
              microstructure analysis with automated trading strategies. The system analyzes real-time
              order flow and market depth to identify high-probability trading opportunities.
            </p>
            <p className="text-void-200 leading-relaxed">
              Unlike traditional technical analysis that relies solely on price and volume bars, PsiQuant
              examines the underlying market dynamics through two primary lenses:
            </p>
            <ul className="list-disc list-inside space-y-2 text-void-200 ml-4">
              <li><strong className="text-neon-cyan">Cumulative Volume Delta (CVD)</strong> - Tracks institutional buying vs. selling pressure</li>
              <li><strong className="text-neon-purple">Limit Order Book (LOB) Density</strong> - Identifies key support and resistance zones</li>
            </ul>
            <p className="text-void-200 leading-relaxed">
              By combining these analytics with a systematic triple-barrier exit strategy, PsiQuant aims
              to capture directional moves while managing risk through predefined profit targets and stop losses.
            </p>
          </div>
        </section>

        {/* How It Works */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-6 text-neon-purple flex items-center gap-3">
            <BarChart3 className="w-8 h-8" />
            How It Works
          </h2>

          {/* CVD Analysis */}
          <div className="mb-8">
            <h3 className="text-2xl font-semibold mb-4 text-void-100">Cumulative Volume Delta (CVD)</h3>
            <div className="bg-void-900 border border-void-700 rounded-lg p-6 space-y-4">
              <p className="text-void-200 leading-relaxed">
                CVD measures the net difference between aggressive buying and selling pressure over time:
              </p>
              <div className="bg-void-800 border border-void-600 rounded p-4 font-mono text-sm text-neon-cyan">
                CVD = Σ(Buy Volume) - Σ(Sell Volume)
              </div>
              <ul className="space-y-3 text-void-200">
                <li className="flex items-start gap-2">
                  <span className="text-neon-cyan mt-1">•</span>
                  <span><strong>Rising CVD</strong> indicates accumulation (institutional buying)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-neon-pink mt-1">•</span>
                  <span><strong>Falling CVD</strong> indicates distribution (institutional selling)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-neon-purple mt-1">•</span>
                  <span><strong>CVD Divergences</strong> from price action reveal hidden strength or weakness</span>
                </li>
              </ul>
              <p className="text-void-300 text-sm italic">
                The system tracks CVD across multiple timeframes (1m, 5m, 15m, 1h) to identify both
                short-term momentum and longer-term trends.
              </p>
            </div>
          </div>

          {/* LOB Density */}
          <div className="mb-8">
            <h3 className="text-2xl font-semibold mb-4 text-void-100">Limit Order Book (LOB) Density</h3>
            <div className="bg-void-900 border border-void-700 rounded-lg p-6 space-y-4">
              <p className="text-void-200 leading-relaxed">
                LOB Density analysis examines the order book structure to find significant support and resistance zones:
              </p>
              <ul className="space-y-3 text-void-200">
                <li className="flex items-start gap-2">
                  <span className="text-neon-cyan mt-1">•</span>
                  <span><strong>Directional Runs</strong> - Consecutive buy or sell orders at similar price levels</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-neon-purple mt-1">•</span>
                  <span><strong>Zone Detection</strong> - Clusters of large orders that act as magnets or barriers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-neon-pink mt-1">•</span>
                  <span><strong>Liquidity Walls</strong> - Dense order concentrations indicating institutional positioning</span>
                </li>
              </ul>
              <p className="text-void-300 text-sm italic">
                The system continuously monitors the order book depth, identifying where large players
                have positioned significant capital, which often acts as turning points in price action.
              </p>
            </div>
          </div>

          {/* Triple Barrier Method */}
          <div className="mb-8">
            <h3 className="text-2xl font-semibold mb-4 text-void-100">Triple Barrier Exit Strategy</h3>
            <div className="bg-void-900 border border-void-700 rounded-lg p-6 space-y-4">
              <p className="text-void-200 leading-relaxed">
                Every trade is protected by a systematic risk management framework with three exit conditions:
              </p>
              <div className="grid md:grid-cols-3 gap-4 my-6">
                <div className="bg-void-800 border border-neon-cyan/30 rounded-lg p-4">
                  <div className="text-neon-cyan font-semibold mb-2 flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Take Profit
                  </div>
                  <p className="text-sm text-void-300">
                    Configurable profit target (e.g., +2% for aggressive bots)
                  </p>
                </div>
                <div className="bg-void-800 border border-neon-pink/30 rounded-lg p-4">
                  <div className="text-neon-pink font-semibold mb-2 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Stop Loss
                  </div>
                  <p className="text-sm text-void-300">
                    Fixed risk limit (e.g., -1% maximum loss)
                  </p>
                </div>
                <div className="bg-void-800 border border-void-500 rounded-lg p-4 opacity-50">
                  <div className="text-void-400 font-semibold mb-2">
                    Time Barrier
                  </div>
                  <p className="text-sm text-void-500">
                    Not used in live bots (optional in research)
                  </p>
                </div>
              </div>
              <p className="text-void-300 text-sm italic">
                Live trading bots use only Take Profit and Stop Loss barriers, allowing positions to
                run until a defined outcome is reached, ensuring disciplined risk-reward ratios.
              </p>
            </div>
          </div>
        </section>

        {/* Bot Strategies */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-6 text-neon-pink flex items-center gap-3">
            <Zap className="w-8 h-8" />
            Bot Trading Strategies
          </h2>
          <p className="text-void-300 mb-8">
            PsiQuant operates four distinct algorithmic strategies, each with unique signal generation logic:
          </p>

          <div className="space-y-6">
            {/* V2 Pure */}
            <div className="bg-void-900 border border-void-700 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-3 text-neon-cyan">V2 Pure (Weighted CVD)</h3>
              <p className="text-void-200 mb-4">
                A multi-timeframe CVD momentum strategy that weights recent movements more heavily than distant ones.
              </p>
              <div className="bg-void-800 border border-void-600 rounded p-4 space-y-2 text-sm">
                <p className="text-void-300"><strong className="text-void-100">Signal Logic:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-void-300 ml-2">
                  <li>Analyzes CVD across 1m, 5m, 15m, 1h timeframes</li>
                  <li>Applies exponential decay weighting (recent = higher weight)</li>
                  <li>LONG when weighted CVD {">"} +0.15 (strong buying pressure)</li>
                  <li>SHORT when weighted CVD {"<"} -0.15 (strong selling pressure)</li>
                </ul>
                <p className="text-void-400 italic mt-3">
                  Risk: TP +2.0% / SL -1.0% | Leverage: 10x | Best for trending markets
                </p>
              </div>
            </div>

            {/* V3 Momentum */}
            <div className="bg-void-900 border border-void-700 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-3 text-neon-purple">V3 Momentum</h3>
              <p className="text-void-200 mb-4">
                A pure momentum strategy that reacts to rapid CVD shifts on lower timeframes.
              </p>
              <div className="bg-void-800 border border-void-600 rounded p-4 space-y-2 text-sm">
                <p className="text-void-300"><strong className="text-void-100">Signal Logic:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-void-300 ml-2">
                  <li>Focuses on 1m and 5m CVD changes</li>
                  <li>LONG when 1m CVD {">"} +0.5 OR 5m CVD {">"} +0.3 (aggressive buy signal)</li>
                  <li>SHORT when 1m CVD {"<"} -0.5 OR 5m CVD {"<"} -0.3 (aggressive sell signal)</li>
                  <li>Fastest reaction time among all bots</li>
                </ul>
                <p className="text-void-400 italic mt-3">
                  Risk: TP +2.0% / SL -1.0% | Leverage: 10x | Best for volatile, choppy markets
                </p>
              </div>
            </div>

            {/* Consensus */}
            <div className="bg-void-900 border border-void-700 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-3 text-neon-cyan">Consensus (Multi-Timeframe Agreement)</h3>
              <p className="text-void-200 mb-4">
                A conservative strategy requiring alignment across all timeframes before entering positions.
              </p>
              <div className="bg-void-800 border border-void-600 rounded p-4 space-y-2 text-sm">
                <p className="text-void-300"><strong className="text-void-100">Signal Logic:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-void-300 ml-2">
                  <li>ALL timeframes (1m, 5m, 15m, 1h) must agree on direction</li>
                  <li>LONG when all CVDs {">"} +0.1 (universal buying pressure)</li>
                  <li>SHORT when all CVDs {"<"} -0.1 (universal selling pressure)</li>
                  <li>Lowest trade frequency, highest conviction</li>
                </ul>
                <p className="text-void-400 italic mt-3">
                  Risk: TP +2.0% / SL -1.0% | Leverage: 10x | Best for strong directional moves
                </p>
              </div>
            </div>

            {/* V2+V3 OR */}
            <div className="bg-void-900 border border-void-700 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-3 text-neon-pink">V2+V3 OR (Combined Strategy)</h3>
              <p className="text-void-200 mb-4">
                A hybrid approach that enters when EITHER V2 Pure OR V3 Momentum generates a signal.
              </p>
              <div className="bg-void-800 border border-void-600 rounded p-4 space-y-2 text-sm">
                <p className="text-void-300"><strong className="text-void-100">Signal Logic:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-void-300 ml-2">
                  <li>Combines both V2 and V3 signal conditions with OR logic</li>
                  <li>LONG if (V2 signal OR V3 signal) is bullish</li>
                  <li>SHORT if (V2 signal OR V3 signal) is bearish</li>
                  <li>Highest trade frequency, captures both trend and momentum</li>
                </ul>
                <p className="text-void-400 italic mt-3">
                  Risk: TP +2.0% / SL -1.0% | Leverage: 10x | Experimental hybrid approach
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Performance Metrics */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-6 text-neon-cyan flex items-center gap-3">
            <Award className="w-8 h-8" />
            Performance Metrics
          </h2>
          <div className="bg-void-900 border border-void-700 rounded-lg p-6">
            <p className="text-void-200 mb-6">
              Each bot's performance is tracked using industry-standard quantitative metrics:
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-neon-cyan mb-2">P&L (Profit & Loss)</h4>
                <p className="text-sm text-void-300">
                  Total realized profit or loss in dollars and percentage terms. Includes trading fees (0.04% per trade).
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-neon-purple mb-2">Win Rate</h4>
                <p className="text-sm text-void-300">
                  Percentage of trades that hit take profit vs. stop loss. Higher is better, but must be balanced with risk-reward ratio.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-neon-pink mb-2">Sharpe Ratio</h4>
                <p className="text-sm text-void-300">
                  Risk-adjusted return metric. Values {">"} 1.0 indicate good performance, {">"} 2.0 is excellent. Measures consistency.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-neon-cyan mb-2">Max Drawdown</h4>
                <p className="text-sm text-void-300">
                  Largest peak-to-trough decline in equity. Critical risk metric showing worst-case historical loss.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-neon-purple mb-2">Total Trades</h4>
                <p className="text-sm text-void-300">
                  Number of completed round-trip trades. More trades provide better statistical significance.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-neon-pink mb-2">Avg P&L per Trade</h4>
                <p className="text-sm text-void-300">
                  Mean profit/loss per trade. Positive values indicate edge, but variance matters too.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Paper Trading Disclaimer */}
        <section className="mb-16">
          <div className="bg-gradient-to-r from-neon-pink/10 to-neon-purple/10 border-2 border-neon-pink/50 rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-4 text-neon-pink flex items-center gap-3">
              <Shield className="w-7 h-7" />
              Important: Paper Trading Notice
            </h2>
            <div className="space-y-3 text-void-200">
              <p className="leading-relaxed">
                <strong className="text-void-50">All trading on PsiQuant is currently simulated (paper trading)</strong> using
                virtual funds with realistic market conditions, including:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Real-time market data from Hyperliquid exchange</li>
                <li>Simulated trading fees (0.04% per trade)</li>
                <li>Realistic slippage modeling</li>
                <li>10x leverage simulation</li>
              </ul>
              <p className="leading-relaxed font-semibold text-neon-pink">
                This is an experimental research project. Past performance does not guarantee future results.
                No real money is being traded.
              </p>
              <p className="text-sm text-void-400 italic">
                The system is in active development and testing phase. Strategies are continuously refined
                based on market conditions and performance analysis.
              </p>
            </div>
          </div>
        </section>

        {/* Credits */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-4 text-void-100">Credits</h2>
          <div className="bg-void-900 border border-void-700 rounded-lg p-6 text-void-300 text-sm space-y-2">
            <p>
              <strong className="text-void-100">Developed by:</strong> Federico Anastasi (MangoLabs)
            </p>
            <p>
              <strong className="text-void-100">Market Data:</strong> Hyperliquid API (real-time WebSocket feeds)
            </p>
            <p>
              <strong className="text-void-100">Technologies:</strong> React, FastAPI, PostgreSQL, TimescaleDB, ECharts
            </p>
            <p className="text-void-400 italic pt-2">
              Built as part of the MangoLabs quantitative research initiative exploring advanced
              market microstructure analytics and algorithmic trading systems.
            </p>
          </div>
        </section>

        {/* Footer CTA */}
        <div className="text-center pt-8 border-t border-void-700">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-neon-cyan to-neon-purple text-void-950 font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
