// =====================================================
// L3 Signal: Risk-Adjusted Expected Return
// 期待リターン（シャープレシオベース）
// =====================================================

import type { L1Signal, L2Signal, L3Signal, OHLCV } from '../../types';
import { stdDev, average, pctChange } from '../../utils/helpers';

const RISK_FREE_RATE = 0.005; // 0.5% (JPY risk-free rate)

export function calculateL3(
    l1: L1Signal,
    l2: L2Signal,
    prices: OHLCV[]
): L3Signal {
    // Expected return calculation
    // E[R] = P(up) × X% - P(down) × Y%
    const expectedUpside = l1.probability * l1.targetPct;
    const expectedDownside = l2.probability * l2.targetPct;
    const expectedReturn = expectedUpside - expectedDownside;

    // Calculate historical volatility for Sharpe ratio
    const volatility = calculateAnnualizedVolatility(prices);

    // Sharpe-like ratio (simplified)
    // Using expected return over horizon, annualized volatility
    const horizonFactor = Math.sqrt(l1.horizonDays / 252); // Annualization adjustment
    const adjustedVolatility = volatility * horizonFactor;

    const sharpeRatio = adjustedVolatility > 0
        ? (expectedReturn - RISK_FREE_RATE) / adjustedVolatility
        : 0;

    // Threshold for advantage
    const isAdvantage = sharpeRatio > 0.5;

    return {
        expectedReturn,
        sharpeRatio,
        isAdvantage,
    };
}

// =====================================================
// Calculate Annualized Volatility
// =====================================================

function calculateAnnualizedVolatility(prices: OHLCV[]): number {
    if (prices.length < 20) return 0.2; // Default 20%

    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
        const ret = pctChange(prices[i].close, prices[i - 1].close);
        returns.push(ret);
    }

    const dailyStd = stdDev(returns);

    // Annualize (252 trading days)
    return dailyStd * Math.sqrt(252);
}
