// =====================================================
// L1 Signal: Upside Target Probability
// N営業日以内に+X%到達の確率推定
// =====================================================

import type { OHLCV, L1Signal, TechnicalIndicators } from '../../types';
import { atrPercent, rsi, sma } from '../indicators';
import { clamp, pctChange } from '../../utils/helpers';

interface L1Params {
    horizonDays: number;      // 60 or 120
    atrMultiplier?: number;   // default: 2.0
}

export function calculateL1(
    prices: OHLCV[],
    indicators: TechnicalIndicators,
    params: L1Params
): L1Signal {
    const { horizonDays, atrMultiplier = 2.0 } = params;
    const currentPrice = prices[prices.length - 1]?.close || 0;

    if (prices.length < 60 || currentPrice === 0) {
        return {
            probability: 0.5,
            targetPct: 10,
            horizonDays,
            factors: { momentum: 0.5, trend: 0.5, breakout: 0.5, volume: 0.5 },
        };
    }

    // Calculate volatility-based target
    const volatility = atrPercent(prices, 20);
    const targetPct = Math.max(5, Math.min(30, volatility * atrMultiplier));

    // =========================================
    // Factor 1: Momentum (RSI-based)
    // RSI 30-50 = higher probability of upside
    // =========================================
    const currentRsi = indicators.rsi14;
    let momentumScore: number;
    if (currentRsi < 30) {
        momentumScore = 0.75; // Oversold = strong reversal potential
    } else if (currentRsi < 50) {
        momentumScore = 0.6; // Moderate upside potential
    } else if (currentRsi < 70) {
        momentumScore = 0.45; // Neutral
    } else {
        momentumScore = 0.3; // Overbought = low upside potential
    }

    // =========================================
    // Factor 2: Trend (MA position)
    // Price above SMA60 = bullish
    // =========================================
    const sma60 = indicators.sma60;
    const sma20 = indicators.sma20;
    let trendScore: number;

    if (currentPrice > sma60 && currentPrice > sma20) {
        // Strong uptrend
        trendScore = 0.7;
    } else if (currentPrice > sma60) {
        // Above long-term MA
        trendScore = 0.6;
    } else if (currentPrice > sma20) {
        // Short-term strength
        trendScore = 0.5;
    } else {
        // Below both MAs
        trendScore = 0.35;
    }

    // Bonus for golden cross (20MA > 60MA)
    if (sma20 > sma60) {
        trendScore = Math.min(0.8, trendScore + 0.1);
    }

    // =========================================
    // Factor 3: Breakout (distance to high)
    // Close to 52-week high = momentum
    // =========================================
    const recentPrices = prices.slice(-Math.min(252, prices.length));
    const high52w = Math.max(...recentPrices.map(p => p.high));
    const distanceToHigh = ((high52w - currentPrice) / currentPrice) * 100;

    let breakoutScore: number;
    if (distanceToHigh < 5) {
        breakoutScore = 0.7; // Near breakout
    } else if (distanceToHigh < 15) {
        breakoutScore = 0.55;
    } else if (distanceToHigh < 30) {
        breakoutScore = 0.45;
    } else {
        breakoutScore = 0.35; // Far from high
    }

    // =========================================
    // Factor 4: Volume confirmation
    // Higher volume = stronger conviction
    // =========================================
    const volRatio = indicators.volumeRatio;
    let volumeScore: number;
    if (volRatio > 1.5) {
        volumeScore = 0.7; // High volume confirmation
    } else if (volRatio > 1.0) {
        volumeScore = 0.55;
    } else {
        volumeScore = 0.4;
    }

    // =========================================
    // Historical base rate adjustment
    // What % of times did price reach +X% in N days?
    // =========================================
    const baseRate = calculateHistoricalUpside(prices, targetPct, horizonDays);

    // =========================================
    // Combine factors with weights
    // =========================================
    const weights = { momentum: 0.25, trend: 0.3, breakout: 0.2, volume: 0.25 };

    let probability =
        momentumScore * weights.momentum +
        trendScore * weights.trend +
        breakoutScore * weights.breakout +
        volumeScore * weights.volume;

    // Blend with historical base rate
    probability = probability * 0.6 + baseRate * 0.4;

    // Clamp to reasonable range
    probability = clamp(probability, 0.1, 0.9);

    return {
        probability,
        targetPct,
        horizonDays,
        factors: {
            momentum: momentumScore,
            trend: trendScore,
            breakout: breakoutScore,
            volume: volumeScore,
        },
    };
}

// =====================================================
// Historical Upside Rate
// =====================================================

function calculateHistoricalUpside(
    prices: OHLCV[],
    targetPct: number,
    horizonDays: number
): number {
    if (prices.length < horizonDays + 60) return 0.5;

    let successCount = 0;
    let totalCount = 0;

    // Look back at last 120 possible windows
    const lookback = Math.min(120, prices.length - horizonDays);

    for (let i = prices.length - lookback - horizonDays; i < prices.length - horizonDays; i++) {
        if (i < 0) continue;

        const startPrice = prices[i].close;
        let maxPrice = startPrice;

        for (let j = i + 1; j <= i + horizonDays && j < prices.length; j++) {
            maxPrice = Math.max(maxPrice, prices[j].high);
        }

        const maxReturn = pctChange(maxPrice, startPrice);
        if (maxReturn >= targetPct) {
            successCount++;
        }
        totalCount++;
    }

    return totalCount > 0 ? successCount / totalCount : 0.5;
}
