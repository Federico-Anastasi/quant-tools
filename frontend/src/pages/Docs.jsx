import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap, Activity } from 'lucide-react';
import Footer from '../components/Footer';

/**
 * Docs Page - Technical documentation for PsiQuant system
 */
export default function Docs() {
  return (
    <div className="min-h-screen bg-void-950 text-void-100">
      {/* Header with back button */}
      <div className="border-b border-void-800 bg-void-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-void-400 hover:text-neon-cyan transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-pink bg-clip-text text-transparent">
          PsiQuant Documentation
        </h1>
        <p className="text-void-300 mb-4">
          Real-time order flow research project. Experimental analysis of cryptocurrency market microstructure.
        </p>
        <p className="text-void-400 text-sm mb-12">
          This is a personal research project made available for free. No guarantees, no commercial ambitions—just exploring what market data can reveal.
        </p>

        {/* Overview */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-6 text-neon-cyan flex items-center gap-3">
            <Activity className="w-8 h-8" />
            What This Does
          </h2>
          <p className="text-void-300 mb-4">
            PsiQuant analyzes real-time order flow and market microstructure using two complementary methods: cumulative volume delta analysis and liquidity density mapping. Currently focused on Bitcoin, but the methodology could extend to other assets.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-void-900 border border-void-700 rounded-lg p-5">
              <h3 className="text-lg font-semibold mb-2 text-neon-purple">Order Flow Analysis</h3>
              <p className="text-void-300 text-sm mb-3">
                Processes real-time market trades to calculate Cumulative Volume Delta (CVD), which tracks the balance between buying and selling pressure. The system then computes an efficiency ratio by comparing price movement to CVD movement, and classifies each 3-minute candle into discrete states based on this relationship.
              </p>
              <p className="text-void-300 text-sm">
                Three cumulative indicators are generated: V1 (simple sum), V2 (weighted with decay and efficiency), and V3 (momentum via V1 minus EMA).
              </p>
            </div>
            <div className="bg-void-900 border border-void-700 rounded-lg p-5">
              <h3 className="text-lg font-semibold mb-2 text-neon-purple">Liquidity Density Heatmap</h3>
              <p className="text-void-300 text-sm mb-3">
                Based on effective limit order book density theory from research paper. The system identifies directional price runs (sequences of consecutive price movements in the same direction) and calculates effective liquidity density for each run as total volume divided by price movement.
              </p>
              <p className="text-void-300 text-sm">
                High-density zones indicate price levels where significant volume was required to move price, interpreted as potential support (below current price) and resistance (above current price) levels.
              </p>
            </div>
          </div>
          <div className="bg-void-900/50 border border-void-700/50 rounded-lg p-6">
            <h3 className="text-void-100 font-semibold mb-3">Understanding the Visualizations</h3>
            <ul className="space-y-2 text-void-300 text-sm">
              <li><strong className="text-void-100">Order Flow Chart (CVD):</strong> Shows price candles overlaid with cumulative delta. The multi-panel view displays market order volume, V2 weighted directional flow, V3 momentum, and V1 simple cumulative.</li>
              <li><strong className="text-void-100">LOB Density Heatmap:</strong> Visualizes where price action experienced resistance to movement due to clusters of limit orders. Dark green areas show support (orders below price), dark red shows resistance (orders above). The side profile displays the net directional liquidity.</li>
              <li><strong className="text-void-100">Statistical Patterns (Experimental):</strong> Historical value ranges where cumulative indicators correlate with price movements, analyzed using triple-barrier testing with various take-profit, stop-loss, and maximum holding time parameters. For example, "when V2 weighted cumulative is between +8 and +10, price historically tends to rise." Used to identify statistically interesting entry points that drive the automated bot strategies.</li>
            </ul>
          </div>
        </section>

        {/* Data Flow - Standalone Section */}
        <section className="mb-16">
          <div className="bg-void-900 border border-void-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4 text-void-100">Data Flow</h2>
            <p className="text-void-300 text-sm mb-6">
              How market data becomes actionable patterns in real-time.
            </p>
            <div className="overflow-x-auto">
              <div className="flex items-center justify-center gap-2 min-w-max px-2 mx-auto">
                {/* Order Flow Data */}
                <div className="bg-void-800 border border-void-600 rounded px-3 py-2 text-center">
                  <div className="text-void-100 font-semibold text-xs whitespace-nowrap">Order Flow Data</div>
                  <div className="text-void-400 text-[10px] mt-1 whitespace-nowrap">Stream from Hyperliquid</div>
                </div>

                <span className="text-void-500 text-sm">→</span>

                {/* Data Calculation */}
                <div className="bg-void-800 border border-void-600 rounded px-3 py-2 text-center">
                  <div className="text-void-100 font-semibold text-xs whitespace-nowrap">Data Calculation</div>
                  <div className="text-void-400 text-[10px] mt-1 whitespace-nowrap">CVD, Efficiency, Classifications</div>
                </div>

                <span className="text-void-500 text-sm">→</span>

                {/* Data Storage */}
                <div className="bg-void-800 border border-void-600 rounded px-3 py-2 text-center">
                  <div className="text-void-100 font-semibold text-xs whitespace-nowrap">Data Storage</div>
                  <div className="text-void-400 text-[10px] mt-1 whitespace-nowrap">Database + History</div>
                </div>

                <span className="text-void-500 text-sm">→</span>

                {/* Statistical Calculation */}
                <div className="bg-void-800 border border-void-600 rounded px-3 py-2 text-center">
                  <div className="text-void-100 font-semibold text-xs whitespace-nowrap">Statistical Analysis</div>
                  <div className="text-void-400 text-[10px] mt-1 whitespace-nowrap">V1, V2, V3, Zones</div>
                </div>

                <span className="text-void-500 text-sm">→</span>

                {/* User Interface */}
                <div className="bg-void-800 border border-void-600 rounded px-3 py-2 text-center">
                  <div className="text-void-100 font-semibold text-xs whitespace-nowrap">User Interface</div>
                  <div className="text-void-400 text-[10px] mt-1 whitespace-nowrap">Real-time Charts</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Calculations */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-6 text-neon-cyan">Core Calculations</h2>
          <p className="text-void-300 text-sm mb-6">
            Mathematical foundations of the classification and cumulative indicator system.
          </p>

          <div className="space-y-6 mb-6">

              {/* CVD */}
              <div className="bg-void-800/50 border border-void-600 rounded-lg p-5">
                <h4 className="text-void-100 font-semibold mb-3">Cumulative Volume Delta (CVD)</h4>
                <p className="text-void-300 text-sm mb-3">
                  Tracks the net balance between buying and selling pressure by accumulating the difference between buy and sell volumes over time.
                </p>
                <div className="bg-void-900 rounded px-4 py-3 font-mono text-sm text-void-100 mb-3">
                  CVD = Σ (buy_volume - sell_volume)
                </div>
                <div className="text-void-400 text-xs space-y-1">
                  <p><strong>buy_volume:</strong> Volume of market buy orders (taker buys)</p>
                  <p><strong>sell_volume:</strong> Volume of market sell orders (taker sells)</p>
                  <p><strong>CVD Candle:</strong> For each 3-minute window, we construct an OHLC candle on the CVD values (open, high, low, close of CVD during that period)</p>
                </div>
              </div>

              {/* Efficiency Ratio */}
              <div className="bg-void-800/50 border border-void-600 rounded-lg p-5">
                <h4 className="text-void-100 font-semibold mb-3">Efficiency Ratio</h4>
                <p className="text-void-300 text-sm mb-3">
                  Measures how efficiently order flow translates into price movement. High efficiency means strong directional conviction, low efficiency indicates absorption or divergence.
                </p>
                <div className="bg-void-900 rounded px-4 py-3 font-mono text-sm text-void-100 mb-3">
                  efficiency = Δprice / ΔCVD
                </div>
                <div className="text-void-400 text-xs space-y-1">
                  <p><strong>Δprice:</strong> Price change during the candle period (signed)</p>
                  <p><strong>ΔCVD:</strong> CVD change during the candle period (signed)</p>
                  <p><strong>Note:</strong> Both deltas are normalized by their respective historical ranges before calculating the ratio. Negative efficiency indicates price and CVD moving in opposite directions (divergence).</p>
                </div>
              </div>

              {/* Candle Classification */}
              <div className="bg-void-800/50 border border-void-600 rounded-lg p-5">
                <h4 className="text-void-100 font-semibold mb-3">Candle Classification & Interpretation</h4>
                <p className="text-void-300 text-sm mb-4">
                  Each 3-minute candle is classified into discrete states based on efficiency ratio—a pure classification of the candle-CVD state space. Classification sign (+/-) indicates price direction (positive = up, negative = down).
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-void-600">
                        <th className="text-left py-2 px-3 text-void-100 font-semibold w-24">Classification</th>
                        <th className="text-left py-2 px-3 text-void-100 font-semibold w-48">Condition</th>
                        <th className="text-left py-2 px-3 text-void-100 font-semibold">Interpretation</th>
                      </tr>
                    </thead>
                    <tbody className="text-void-300 text-xs">
                      <tr className="border-b border-void-700">
                        <td className="py-2 px-3 text-void-100 font-mono font-semibold">±3</td>
                        <td className="py-2 px-3 font-mono">
                          efficiency &gt; 1.5
                        </td>
                        <td className="py-2 px-3"><strong className="text-void-100">Strong Coherence.</strong> Price and CVD move in same direction with high efficiency. Strong directional conviction with aligned order flow. Large price movement relative to CVD change.</td>
                      </tr>
                      <tr className="border-b border-void-700">
                        <td className="py-2 px-3 text-void-100 font-mono font-semibold">±2</td>
                        <td className="py-2 px-3 font-mono">
                          efficiency &lt; 0
                        </td>
                        <td className="py-2 px-3"><strong className="text-void-100">Divergence.</strong> Price and CVD move in opposite directions (negative efficiency). Low conviction movement with conflicting order flow. Price moves against dominant buying/selling pressure.</td>
                      </tr>
                      <tr className="border-b border-void-700">
                        <td className="py-2 px-3 text-void-100 font-mono font-semibold">±1</td>
                        <td className="py-2 px-3 font-mono">
                          0 ≤ efficiency &lt; 0.5
                        </td>
                        <td className="py-2 px-3"><strong className="text-void-100">Absorption.</strong> Large CVD change with small price movement (low efficiency). Market absorbs significant order flow with limited price impact. Strong liquidity absorption zone indicating potential support/resistance.</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-void-100 font-mono font-semibold">0</td>
                        <td className="py-2 px-3 font-mono">
                          |ΔCVD| &lt; threshold
                        </td>
                        <td className="py-2 px-3"><strong className="text-void-100">Neutral.</strong> Insufficient order flow or price movement. Market in equilibrium with no significant directional activity.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 bg-void-900 rounded px-4 py-3">
                  <p className="text-void-400 text-xs">
                    <strong className="text-void-100">Sign convention:</strong> Positive classifications (+3, +2, +1) occur when Δprice &gt; 0 (price increase). Negative classifications (-3, -2, -1) occur when Δprice &lt; 0 (price decrease). The magnitude (1, 2, 3) indicates the efficiency regime, independent of price direction.
                  </p>
                </div>
              </div>

              {/* Philosophy: From Noise to Pattern */}
              <div className="mb-6">
                <h4 className="text-void-100 font-semibold mb-4 text-lg">From Noise to Pattern: The Cumulative Approach</h4>
                <div className="bg-void-900/70 border-l-4 border-neon-cyan/50 rounded px-4 py-4 mb-6">
                  <p className="text-void-300 text-sm mb-3">
                    Individual per-candle classifications are inherently noisy and unreliable in isolation. It's difficult to predict what happens after a single +2 or +3 classification. We interpret these classifications as a <strong className="text-void-100">pure classification of the candle-CVD state space</strong>, mapping all possible states of the efficiency ratio degree of freedom.
                  </p>
                  <p className="text-void-300 text-sm mb-3">
                    The native efficiency ranges (e &lt; 0, 0 &lt; e &lt; 1, e &gt; 1) are translated into discrete regimes (e &lt; 0, 0 ≤ e &lt; 0.5, e &gt; 1.5) to emphasize extremes while avoiding trivial cases near e ≈ 1.
                  </p>
                  <p className="text-void-300 text-sm mb-3">
                    The hypothesis: <strong className="text-void-100">candles follow cycles through these states</strong>. Many +1 classifications or a few +3 classifications might precede an impulsive move. For example, a sequence like +3, +3, +3 describes strong price increases in a high-efficiency zone (low density of sell-side limit orders above price). What happens next? A reversal? Maybe—but with what probability?
                  </p>
                  <p className="text-void-300 text-sm mb-3">
                    To answer this, we <strong className="text-void-100">denoise through cumulation</strong>: V1 (simple sum), V2 (weighted with decay and efficiency amplification), V3 (momentum). After denoising, we perform true statistical analysis: <em>"After a positive sequence (+3, +3, +2, ...) that drives cumulative indicators upward, what typically happens?"</em>
                  </p>
                  <p className="text-void-300 text-sm">
                    Through multi-parameter triple-barrier testing, we analyze outcomes across V2/V3 zones. For example, from the V2 zone [+8, +10], how often do barriers (TP = 0.5%, SL = 0.5%, max time = 30 candles) get hit upward, downward, or expire? These continuously updated statistics—where the best-performing zones are selected—become the <strong className="text-void-100">"Statistical Patterns"</strong> that drive bot entries.
                  </p>
                </div>

                <h5 className="text-void-100 font-semibold mb-4 text-base">Cumulative Indicators: V1, V2, V3</h5>
                <p className="text-void-300 text-sm mb-4">
                  Three cumulative indicators aggregate per-candle classifications over time with different weighting schemes and interpretation methods.
                </p>

                <div className="space-y-5">
                  {/* V1 */}
                  <div className="bg-void-800/50 border border-void-600 rounded-lg p-5">
                    <h4 className="text-void-100 font-semibold mb-3">V1 — Simple Cumulative</h4>
                    <div className="bg-void-900 rounded px-4 py-3 font-mono text-sm text-void-100 mb-3">
                      V1 = Σ classification
                    </div>
                    <p className="text-void-300 text-sm mb-3">
                      Pure sum of all classifications since the beginning. Captures long-term directional bias without any filtering. Slow-moving baseline indicator.
                    </p>
                    <div className="text-void-400 text-xs">
                      <strong className="text-void-100">How to read:</strong> Rising line = positive accumulation over time, falling line = negative accumulation. Slope indicates trend strength and persistence.
                    </div>
                  </div>

                  {/* V2 */}
                  <div className="bg-void-800/50 border border-void-600 rounded-lg p-5">
                    <h4 className="text-void-100 font-semibold mb-3">V2 — Weighted with Decay</h4>
                    <div className="bg-void-900 rounded px-4 py-3 font-mono text-sm text-void-100 mb-3">
                      V2 = Σ (classification × decay × efficiency_weight)
                    </div>
                    <p className="text-void-300 text-sm mb-3">
                      Weighted cumulative that applies time decay and efficiency amplification. Recent classifications weighted more heavily, high-efficiency movements emphasized.
                    </p>
                    <div className="text-void-400 text-xs mb-2">
                      decay = e<sup>-λt</sup> where λ controls decay rate. efficiency_weight amplifies classifications with strong coherent movement.
                    </div>
                    <div className="text-void-400 text-xs">
                      <strong className="text-void-100">How to read:</strong> More responsive than V1. Sharp movements indicate high-conviction directional flow with strong efficiency. Used by most bots for entry conditions.
                    </div>
                  </div>

                  {/* V3 */}
                  <div className="bg-void-800/50 border border-void-600 rounded-lg p-5">
                    <h4 className="text-void-100 font-semibold mb-3">V3 — Momentum</h4>
                    <div className="bg-void-900 rounded px-4 py-3 font-mono text-sm text-void-100 mb-3">
                      V3 = V1 - EMA(V1, 14)
                    </div>
                    <p className="text-void-300 text-sm mb-3">
                      Momentum indicator calculated as V1 minus its 14-period exponential moving average. Captures acceleration/deceleration in order flow momentum.
                    </p>
                    <div className="text-void-400 text-xs">
                      <strong className="text-void-100">How to read:</strong> Positive values = accelerating upward momentum, negative = accelerating downward momentum. 
                    </div>
                  </div>
                </div>
              </div>

            </div>

        </section>

        {/* Bot Strategies */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-6 text-neon-cyan flex items-center gap-3">
            <Zap className="w-8 h-8 text-neon-cyan" />
            Bot Leaderboard
          </h2>
          <p className="text-void-300 mb-4">
            Multiple automated strategies are tested live, each using different combinations and configurations of V2 and V3 cumulative indicators. The goal is to explore how various value thresholds and filtering approaches perform in real market conditions.
          </p>
          <p className="text-void-400 text-sm mb-8">
            Each bot operates on statistical patterns identified through historical analysis—specific value ranges that historically correlated with favorable price movements. This is experimental research, not financial advice.
          </p>

          <div className="space-y-6">
            {/* V2 Weighted */}
            <div className="bg-void-900 border border-void-700 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-3">V2 Weighted</h3>
              <p className="text-void-200 mb-4">
                Trades exclusively on <strong>V2 weighted cumulative</strong> (decay and efficiency amplification).
              </p>
              <div className="bg-void-800 border border-void-600 rounded p-4 space-y-2 text-sm">
                <p className="text-void-300"><strong className="text-void-100">Entry Logic:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-void-300 ml-2">
                  <li>Enters when V2 weighted reaches the optimal zone identified through statistical analysis (e.g., when V2 is between +8 and +10)</li>
                  <li>Also enters the <strong>opposite direction</strong> when V2 is in the symmetric opposite zone (e.g., between -10 and -8, enters opposite direction)</li>
                  <li>Direction (LONG/SHORT) depends on which performed better historically in that zone</li>
                </ul>
                <p className="text-void-300 mt-3"><strong className="text-void-100">Exit Strategy:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-void-300 ml-2">
                  <li>Take-profit and stop-loss calculated from historical zone performance</li>
                  <li>Holds position indefinitely until TP or SL is hit</li>
                </ul>
              </div>
            </div>

            {/* V3 Momentum */}
            <div className="bg-void-900 border border-void-700 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-3">V3 Momentum</h3>
              <p className="text-void-200 mb-4">
                Trades exclusively on <strong>V3 momentum</strong> (calculated as V1 minus EMA 14).
              </p>
              <div className="bg-void-800 border border-void-600 rounded p-4 space-y-2 text-sm">
                <p className="text-void-300"><strong className="text-void-100">Entry Logic:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-void-300 ml-2">
                  <li>Enters when V3 momentum reaches the optimal zone identified through statistical analysis (e.g., when V3 is between +4 and +6)</li>
                  <li>Also enters the <strong>opposite direction</strong> when V3 is in the symmetric opposite zone (e.g., between -6 and -4, enters opposite direction)</li>
                  <li>Direction (LONG/SHORT) depends on which performed better historically in that zone</li>
                </ul>
                <p className="text-void-300 mt-3"><strong className="text-void-100">Exit Strategy:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-void-300 ml-2">
                  <li>Take-profit and stop-loss calculated from historical zone performance</li>
                  <li>Holds position indefinitely until TP or SL is hit</li>
                </ul>
              </div>
            </div>

            {/* V2 AND V3 Strict */}
            <div className="bg-void-900 border border-void-700 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-3">V2 AND V3 Strict</h3>
              <p className="text-void-200 mb-4">
                Strictest strategy requiring <strong>BOTH indicators V2 and V3 to align perfectly</strong>.
              </p>
              <div className="bg-void-800 border border-void-600 rounded p-4 space-y-2 text-sm">
                <p className="text-void-300"><strong className="text-void-100">Entry Logic:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-void-300 ml-2">
                  <li>Requires <strong>BOTH V2 and V3</strong> in their optimal zones (original OR opposite zones)</li>
                  <li>Both zones must agree on direction - either both LONG or both SHORT</li>
                  <li>If only one indicator is in zone, or zones predict opposite directions → <strong>NO ENTRY</strong></li>
                  <li>Also checks opposite zones with symmetric logic</li>
                </ul>
                <p className="text-void-300 mt-3"><strong className="text-void-100">Exit Strategy:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-void-300 ml-2">
                  <li>Take-profit/stop-loss averaged from both V2 and V3 zones</li>
                  <li>Holds position indefinitely until TP or SL is hit</li>
                </ul>
              </div>
            </div>

            {/* V2 OR V3 Conservative */}
            <div className="bg-void-900 border border-void-700 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-3">V2 OR V3 Conservative</h3>
              <p className="text-void-200 mb-4">
                Balanced strategy entering when <strong>at least one indicator is active</strong>, BUT requires both zones to agree on direction if both are present. Moderate frequency with quality filter.
              </p>
              <div className="bg-void-800 border border-void-600 rounded p-4 space-y-2 text-sm">
                <p className="text-void-300"><strong className="text-void-100">Entry Logic:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-void-300 ml-2">
                  <li><strong>AT LEAST ONE</strong> indicator (V2 OR V3) must be in its optimal zone (original OR opposite)</li>
                  <li>Both V2 and V3 zones must be configured for the same direction (both LONG or both SHORT)</li>
                  <li>Enters if only one indicator is in zone, OR if both are in zone (since they already agree by configuration)</li>
                  <li>No conflict possible because zones are pre-aligned by direction</li>
                </ul>
                <p className="text-void-300 mt-3"><strong className="text-void-100">Exit Strategy:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-void-300 ml-2">
                  <li>If both indicators active: averaged TP/SL from both zones</li>
                  <li>If single indicator active: uses that indicator's zone parameters</li>
                  <li>Holds position indefinitely until TP or SL is hit</li>
                </ul>
              </div>
            </div>

            {/* V2 OR V3 Aggressive */}
            <div className="bg-void-900 border border-void-700 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-3">V2 OR V3 Aggressive</h3>
              <p className="text-void-200 mb-4">
                Most aggressive strategy with <strong>NO agreement requirement</strong>. Enters whenever any indicator is active, only avoiding direct conflicts. Highest frequency.
              </p>
              <div className="bg-void-800 border border-void-600 rounded p-4 space-y-2 text-sm">
                <p className="text-void-300"><strong className="text-void-100">Entry Logic:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-void-300 ml-2">
                  <li><strong>AT LEAST ONE</strong> indicator (V2 OR V3) must be in its optimal zone (original OR opposite)</li>
                  <li><strong>NO agreement check</strong>: doesn't require zones to agree on direction</li>
                  <li><strong>ONLY AVOIDS</strong> direct conflicts: when both indicators are active AND suggest opposite directions (one LONG, one SHORT)</li>
                  <li>Enters freely when only one indicator is active, or when both agree</li>
                </ul>
                <p className="text-void-300 mt-3"><strong className="text-void-100">Exit Strategy:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-void-300 ml-2">
                  <li>Both indicators active and agree: averaged TP/SL parameters</li>
                  <li>Only V2 active: uses V2 zone parameters</li>
                  <li>Only V3 active: uses V3 zone parameters</li>
                  <li>Holds position indefinitely until TP or SL is hit</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Strategy Comparison Table */}
          <div className="mt-8 bg-void-900 border border-void-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 text-void-100">Strategy Logic Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-void-600 text-void-400">
                    <th className="text-left py-2 px-3">Strategy</th>
                    <th className="text-center py-2 px-3">Indicators Used</th>
                    <th className="text-center py-2 px-3">Entry Logic</th>
                    <th className="text-center py-2 px-3">Direction Agreement</th>
                  </tr>
                </thead>
                <tbody className="text-void-200">
                  <tr className="border-b border-void-700">
                    <td className="py-2 px-3">V2 Weighted</td>
                    <td className="text-center py-2 px-3">V2 only</td>
                    <td className="text-center py-2 px-3">Single cumulative</td>
                    <td className="text-center py-2 px-3 text-void-400">N/A</td>
                  </tr>
                  <tr className="border-b border-void-700">
                    <td className="py-2 px-3">V3 Momentum</td>
                    <td className="text-center py-2 px-3">V3 only</td>
                    <td className="text-center py-2 px-3">Single cumulative</td>
                    <td className="text-center py-2 px-3 text-void-400">N/A</td>
                  </tr>
                  <tr className="border-b border-void-700">
                    <td className="py-2 px-3">V2 AND V3 Strict</td>
                    <td className="text-center py-2 px-3">Both (V2 + V3)</td>
                    <td className="text-center py-2 px-3">AND (both required)</td>
                    <td className="text-center py-2 px-3">✓ Required</td>
                  </tr>
                  <tr className="border-b border-void-700">
                    <td className="py-2 px-3">V2 OR V3 Conservative</td>
                    <td className="text-center py-2 px-3">Both (V2 + V3)</td>
                    <td className="text-center py-2 px-3">OR (at least one)</td>
                    <td className="text-center py-2 px-3">✓ Required</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">V2 OR V3 Aggressive</td>
                    <td className="text-center py-2 px-3">Both (V2 + V3)</td>
                    <td className="text-center py-2 px-3">OR (at least one)</td>
                    <td className="text-center py-2 px-3">✗ Not required (conflict check only)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-void-400 text-xs mt-4">
              <strong>Note</strong>: All bots use $10,000 starting capital and 0.04% fee per side (0.08% round trip). Take-profit and stop-loss percentages are dynamically optimized per zone from historical performance.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-6 text-neon-cyan">Frequently Asked Questions</h2>
          <div className="space-y-4">

            {/* Q1 */}
            <div className="bg-void-900 border border-void-700 rounded-lg p-5">
              <h3 className="text-void-100 font-semibold mb-2">Why 3-minute candles?</h3>
              <p className="text-void-300 text-sm">
                The 3-minute timeframe balances classification quality with trade frequency. Shorter timeframes (1 min) generate too much noise, while longer ones (5+ min) miss microstructure dynamics. This window captures order flow patterns while filtering out tick-level randomness.
              </p>
            </div>

            {/* Q2 */}
            <div className="bg-void-900 border border-void-700 rounded-lg p-5">
              <h3 className="text-void-100 font-semibold mb-2">How are statistical patterns discovered?</h3>
              <p className="text-void-300 text-sm">
                Patterns are identified through historical backtesting using triple-barrier method: for each cumulative indicator value range (e.g., V2 between +8 and +10), the system tests various take-profit, stop-loss, and time-exit combinations. Zones with statistically significant win rates and favorable risk/reward ratios become entry triggers for bots.
              </p>
            </div>

            {/* Q3 */}
            <div className="bg-void-900 border border-void-700 rounded-lg p-5">
              <h3 className="text-void-100 font-semibold mb-2">Can I use this for other cryptocurrencies?</h3>
              <p className="text-void-300 text-sm">
                The architecture supports multi-asset analysis, but currently only BTC PERP (Hyperliquid) is active. The order flow methodology applies to any liquid futures market. Expanding to ETH, SOL, or other assets requires collecting sufficient historical data for zone calibration.
              </p>
            </div>

            {/* Q4 */}
            <div className="bg-void-900 border border-void-700 rounded-lg p-5">
              <h3 className="text-void-100 font-semibold mb-2">What's the advantage over traditional technical indicators?</h3>
              <p className="text-void-300 text-sm">
                Traditional indicators (RSI, MACD, Bollinger Bands) analyze price and volume aggregates. PsiQuant analyzes <strong>order flow microstructure</strong>—the balance between buying and selling pressure at the trade level. This captures market participant behavior before it fully reflects in price, potentially offering earlier pattern recognition.
              </p>
            </div>

            {/* Q5 */}
            <div className="bg-void-900 border border-void-700 rounded-lg p-5">
              <h3 className="text-void-100 font-semibold mb-2">Are the bot results live or backtested?</h3>
              <p className="text-void-300 text-sm">
                Bot performance shown in the leaderboard reflects <strong>live paper trading</strong>—real-time execution simulation with realistic fees (0.04% per side) and slippage assumptions. Positions are opened/closed based on actual market data as it arrives. This is not historical backtesting, but forward-testing in real market conditions without risking capital.
              </p>
            </div>

          </div>
        </section>

        {/* References */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-6 text-neon-cyan">References</h2>
          <div className="bg-void-900 border border-void-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-3 text-void-100">Research Paper</h3>
            <ul className="space-y-3">
              <li className="text-void-300 text-sm">
                <a
                  href="https://github.com/Federico-Anastasi/effective-lob-density/blob/main/docs/Effective_limit_order_book_density.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neon-cyan hover:text-neon-purple transition-colors underline"
                >
                  Effective Limit Order Book Density
                </a>
                <span className="text-void-400 ml-2">- Theoretical foundation for liquidity density analysis</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Footer */}
        <div className="border-t border-void-800 pt-8 mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-void-400 hover:text-neon-cyan transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Global Footer */}
      <Footer />
    </div>
  );
}
