// =====================================================
// L2 Signal: Downside Target Probability
// N営業日以内に-Y%到達の確率推定
// =====================================================

import type { OHLCV, L2Signal, TechnicalIndicators } from '../../types';
import { atrPercent } from '../indicators';
import { clamp, pctChange } from '../../utils/helpers';

interface L2Params {
    horizonDays: number;      // 60 or 120
    atrMultiplier?: number;   // default: 2.0
}

export function calculateL2(
    prices: OHLCV[],
    indicators: TechnicalIndicators,
    params: L2Params
): L2Signal {
    const { horizonDays, atrMultiplier = 2.0 } = params;
    const currentPrice = prices[prices.length - 1]?.close || 0;

    if (prices.length < 60 || currentPrice === 0) {
        return {
            probability: 0.5,
            targetPct: 10,
            horizonDays,
            factors: { momentum: 0.5, trend: 0.5, breakdown: 0.5, volume: 0.5 },
        };
    }

    // Calculate volatility-based target
    const volatility = atrPercent(prices, 20);
    const targetPct = Math.max(5, Math.min(30, volatility * atrMultiplier));

    // =========================================
    // Factor 1: Momentum (RSI-based) - inverse of L1
    // RSI 70+ = higher probability of downside
    // =========================================
    const currentRsi = indicators.rsi14;
    let momentumScore: number;
    if (currentRsi > 70) {
        momentumScore = 0.75; // Overbought = strong reversal potential
    } else if (currentRsi > 50) {
        momentumScore = 0.55; // Some downside risk
    } else if (currentRsi > 30) {
        momentumScore = 0.4; // Lower downside probability
    } else {
        momentumScore = 0.3; // Oversold = low downside potential
    }

    // =========================================
    // Factor 2: Trend (MA position) - inverse
    // Price below SMA60 = bearish
    // =========================================
    const sma60 = indicators.sma60;
    const sma20 = indicators.sma20;
    let trendScore: number;

    if (currentPrice < sma60 && currentPrice < sma20) {
        // Strong downtrend
        trendScore = 0.7;
    } else if (currentPrice < sma60) {
        // Below long-term MA
        trendScore = 0.6;
    } else if (currentPrice < sma20) {
        // Short-term weakness
        trendScore = 0.5;
    } else {
        // Above both MAs
        trendScore = 0.3;
    }

    // Death cross (20MA < 60MA)
    if (sma20 < sma60) {
        trendScore = Math.min(0.8, trendScore + 0.1);
    }

    // =========================================
    // Factor 3: Breakdown (distance from low)
    // Close to 52-week low = weakness
    // =========================================
    const recentPrices = prices.slice(-Math.min(252, prices.length));
    const low52w = Math.min(...recentPrices.map(p => p.low));
    const distanceFromLow = ((currentPrice - low52w) / currentPrice) * 100;

    let breakdownScore: number;
    if (distanceFromLow < 5) {
        breakdownScore = 0.7; // Near breakdown
    } else if (distanceFromLow < 15) {
        breakdownScore = 0.55;
    } else if (distanceFromLow < 30) {
        breakdownScore = 0.45;
    } else {
        breakdownScore = 0.3; // Far from low
    }

    // =========================================
    // Factor 4: Volume on down days
    // High volume on down days = bearish
    // =========================================
    const volRatio = indicators.volumeRatio;
    const lastChange = prices.length > 1
        ? prices[prices.length - 1].close - prices[prices.length - 2].close
        : 0;

    let volumeScore: number;
    if (volRatio > 1.5 && lastChange < 0) {
        volumeScore = 0.7; // High volume selling
    } else if (volRatio > 1.0 && lastChange < 0) {
        volumeScore = 0.55;
    } else {
        volumeScore = 0.4;
    }

    // =========================================
    // Historical base rate adjustment
    // =========================================
    const baseRate = calculateHistoricalDownside(prices, targetPct, horizonDays);

    // =========================================
    // Combine factors
    // =========================================
    const weights = { momentum: 0.25, trend: 0.3, breakdown: 0.2, volume: 0.25 };

    let probability =
        momentumScore * weights.momentum +
        trendScore * weights.trend +
        breakdownScore * weights.breakdown +
        volumeScore * weights.volume;

    // Blend with historical base rate
    probability = probability * 0.6 + baseRate * 0.4;

    // Clamp
    probability = clamp(probability, 0.1, 0.9);

    return {
        probability,
        targetPct,
        horizonDays,
        factors: {
            momentum: momentumScore,
            trend: trendScore,
            breakdown: breakdownScore,
            volume: volumeScore,
        },
    };
}

// =====================================================
// Historical Downside Rate
// =====================================================

function calculateHistoricalDownside(
    prices: OHLCV[],
    targetPct: number,
    horizonDays: number
): number {
    if (prices.length < horizonDays + 60) return 0.5;

    let successCount = 0;
    let totalCount = 0;

    const lookback = Math.min(120, prices.length - horizonDays);

    for (let i = prices.length - lookback - horizonDays; i < prices.length - horizonDays; i++) {
        if (i < 0) continue;

        const startPrice = prices[i].close;
        let minPrice = startPrice;

        for (let j = i + 1; j <= i + horizonDays && j < prices.length; j++) {
            minPrice = Math.min(minPrice, prices[j].low);
        }

        const maxDrop = pctChange(minPrice, startPrice);
        if (maxDrop <= -targetPct) {
            successCount++;
        }
        totalCount++;
    }

    return totalCount > 0 ? successCount / totalCount : 0.5;
}
