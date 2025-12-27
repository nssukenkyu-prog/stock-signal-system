// =====================================================
// Rules-based Signal Aggregator
// Combines L1-L4 signals into final BUY/SELL/HOLD/WATCH
// =====================================================

import type {
    OHLCV,
    TechnicalIndicators,
    SignalResult,
    SignalAction,
    L1Signal,
    L2Signal,
    L3Signal,
    L4Signal,
    ThresholdsConfig,
    MarketEvent
} from '../types';
import { calculateL1 } from './signals/L1-upside';
import { calculateL2 } from './signals/L2-downside';
import { calculateL3 } from './signals/L3-expected';
import { calculateL4, getTrendDescription } from './signals/L4-trend';
import { calculateIndicators, atrPercent } from './indicators';
import { round, formatPercent } from '../utils/helpers';

interface AggregateParams {
    symbolId: string;
    symbolName: string;
    prices: OHLCV[];
    thresholds: ThresholdsConfig;
    upcomingEvents?: MarketEvent[];
    isHolding?: boolean;
}

// =====================================================
// Main Aggregation Function
// =====================================================

export function aggregateSignals(params: AggregateParams): SignalResult {
    const { symbolId, symbolName, prices, thresholds, upcomingEvents = [], isHolding = false } = params;

    // Calculate indicators
    const indicators = calculateIndicators(prices);

    // Calculate L1-L4 for 60-day horizon
    const l1_60 = calculateL1(prices, indicators, { horizonDays: 60 });
    const l2_60 = calculateL2(prices, indicators, { horizonDays: 60 });
    const l3_60 = calculateL3(l1_60, l2_60, prices);
    const l4 = calculateL4(prices, indicators);

    // Also check 120-day horizon
    const l1_120 = calculateL1(prices, indicators, { horizonDays: 120 });
    const l2_120 = calculateL2(prices, indicators, { horizonDays: 120 });
    const l3_120 = calculateL3(l1_120, l2_120, prices);

    // Use the more favorable time horizon
    const l1 = l1_60.probability > l1_120.probability ? l1_60 : l1_120;
    const l2 = l2_60.probability > l2_120.probability ? l2_60 : l2_120;
    const l3 = l3_60.sharpeRatio > l3_120.sharpeRatio ? l3_60 : l3_120;
    const horizon = l1 === l1_60 ? '60営業日' : '120営業日';

    // Collect reasons and warnings
    const reasons: string[] = [];
    const warnings: string[] = [];

    // Add indicator-based reasons
    addIndicatorReasons(reasons, indicators, prices);

    // Add trend reason
    reasons.push(getTrendDescription(l4));

    // Add event warnings
    for (const event of upcomingEvents) {
        if (event.importance >= 2) {
            warnings.push(`${event.date}: ${event.description}`);
        }
    }

    // Add max drawdown warning based on L2
    const expectedMDD = round(l2.targetPct * l2.probability, 1);
    if (expectedMDD > 5) {
        warnings.push(`最大DD想定: -${expectedMDD}%`);
    }

    // =========================================
    // Decision Logic
    // =========================================
    let action: SignalAction;
    let confidence: number;

    const { l1MinProbability, l2MinProbability, l3MinSharpe } = thresholds;

    // BUY conditions
    const buyConditions = [
        l1.probability >= l1MinProbability,
        l3.isAdvantage || l3.sharpeRatio >= l3MinSharpe,
        l4.state === 'UPTREND' || l4.signal === 'REVERSAL_UP',
    ];
    const buyScore = buyConditions.filter(Boolean).length;

    // SELL conditions
    const sellConditions = [
        l2.probability >= l2MinProbability,
        l3.sharpeRatio < -0.3,
        l4.state === 'DOWNTREND' || l4.signal === 'REVERSAL_DOWN',
    ];
    const sellScore = sellConditions.filter(Boolean).length;

    // Determine action
    if (buyScore >= 2 && sellScore < 2) {
        action = 'BUY';
        confidence = (l1.probability + l4.confidence) / 2;
    } else if (sellScore >= 2 && buyScore < 2) {
        action = 'SELL';
        confidence = (l2.probability + l4.confidence) / 2;
    } else if (buyScore >= 1 || sellScore >= 1) {
        // Mixed signals or partial conditions
        action = 'WATCH';
        confidence = 0.5;
    } else {
        action = 'HOLD';
        confidence = 0.5;
    }

    // Override: conflicting BUY/SELL → WATCH
    if (buyScore >= 2 && sellScore >= 2) {
        action = 'WATCH';
        warnings.push('BUY/SELL競合のため保留');
    }

    // For holdings, adjust SELL threshold
    if (isHolding && action === 'SELL') {
        // Higher bar for selling existing holdings
        if (l2.probability < 0.7 || l3.sharpeRatio > -0.5) {
            action = 'WATCH';
            reasons.push('保有中のため慎重判断');
        }
    }

    return {
        symbolId,
        symbolName,
        action,
        confidence: round(confidence, 2),
        horizon,
        reasons: reasons.slice(0, 5), // Limit reasons
        warnings: warnings.slice(0, 3),
        l1,
        l2,
        l3,
        l4,
        timestamp: new Date().toISOString(),
    };
}

// =====================================================
// Add Indicator-based Reasons
// =====================================================

function addIndicatorReasons(
    reasons: string[],
    indicators: TechnicalIndicators,
    prices: OHLCV[]
): void {
    const currentPrice = prices[prices.length - 1]?.close || 0;

    // RSI
    if (indicators.rsi14 < 30) {
        reasons.push(`RSI: ${round(indicators.rsi14, 0)}（売られ過ぎ圏）`);
    } else if (indicators.rsi14 > 70) {
        reasons.push(`RSI: ${round(indicators.rsi14, 0)}（買われ過ぎ圏）`);
    }

    // MA position
    if (currentPrice > indicators.sma60 && currentPrice > indicators.sma20) {
        reasons.push('60日・20日MA上方');
    } else if (currentPrice < indicators.sma60 && currentPrice < indicators.sma20) {
        reasons.push('60日・20日MA下方');
    }

    // Volume
    if (indicators.volumeRatio > 1.5) {
        reasons.push(`出来高${round(indicators.volumeRatio, 1)}倍`);
    }

    // MACD
    if (indicators.macdHistogram > 0 && indicators.macd > indicators.macdSignal) {
        reasons.push('MACD上昇シグナル');
    } else if (indicators.macdHistogram < 0 && indicators.macd < indicators.macdSignal) {
        reasons.push('MACD下降シグナル');
    }

    // ADX
    if (indicators.adx14 > 25) {
        reasons.push(`ADX ${round(indicators.adx14, 0)}（強トレンド）`);
    }
}

// =====================================================
// Check if Signal Should Trigger Notification
// =====================================================

export function shouldNotify(
    current: SignalResult,
    previous: SignalResult | null,
    thresholds: ThresholdsConfig
): boolean {
    // Always notify BUY or SELL
    if (current.action === 'BUY' || current.action === 'SELL') {
        // Check hysteresis if previous was opposite
        if (previous) {
            const buffer = thresholds.hysteresisBuffer;
            if (current.action === 'BUY' && previous.action === 'SELL') {
                // Need stronger signal to flip
                return current.confidence > 0.5 + buffer;
            }
            if (current.action === 'SELL' && previous.action === 'BUY') {
                return current.confidence > 0.5 + buffer;
            }
        }
        return current.confidence >= 0.5;
    }

    // WATCH only if previous was different
    if (current.action === 'WATCH') {
        return previous?.action !== 'WATCH';
    }

    // HOLD doesn't trigger notification
    return false;
}
