// =====================================================
// L4 Signal: Trend Detection
// トレンド継続/反転の判定
// =====================================================

import type { L4Signal, TrendState, TrendSignal, TechnicalIndicators, OHLCV } from '../../types';
import { sma } from '../indicators';

export function calculateL4(
    prices: OHLCV[],
    indicators: TechnicalIndicators
): L4Signal {
    const currentPrice = prices[prices.length - 1]?.close || 0;

    // =========================================
    // Determine Trend State using ADX
    // ADX < 20 = Range/No trend
    // ADX >= 20 = Trending
    // =========================================
    const adx = indicators.adx14;
    const diPlus = indicators.diPlus;
    const diMinus = indicators.diMinus;

    let state: TrendState;
    if (adx < 20) {
        state = 'RANGE';
    } else if (diPlus > diMinus) {
        state = 'UPTREND';
    } else {
        state = 'DOWNTREND';
    }

    // =========================================
    // Detect Trend Signal (Continue or Reversal)
    // =========================================
    let signal: TrendSignal;
    let confidence: number;

    const closes = prices.map(p => p.close);
    const sma20 = indicators.sma20;
    const sma60 = indicators.sma60;
    const rsi = indicators.rsi14;
    const macdHistogram = indicators.macdHistogram;

    // Get previous values for trend change detection
    const prevCloses = closes.slice(0, -1);
    const prevSma20 = prevCloses.length >= 20 ? sma(prevCloses, 20) : sma20;

    // Check for crossovers
    const goldenCross = sma20 > sma60 && prevSma20 <= sma60;
    const deathCross = sma20 < sma60 && prevSma20 >= sma60;

    // MACD histogram direction
    const macdTurningUp = macdHistogram > 0 && indicators.macd > indicators.macdSignal;
    const macdTurningDown = macdHistogram < 0 && indicators.macd < indicators.macdSignal;

    // Determine signal
    if (state === 'RANGE') {
        // In range, look for breakout signals
        if (rsi < 30 && macdTurningUp) {
            signal = 'REVERSAL_UP';
            confidence = 0.55;
        } else if (rsi > 70 && macdTurningDown) {
            signal = 'REVERSAL_DOWN';
            confidence = 0.55;
        } else {
            signal = 'CONTINUE'; // Stay in range
            confidence = 0.5;
        }
    } else if (state === 'UPTREND') {
        if (deathCross || (rsi > 70 && macdTurningDown)) {
            // Potential reversal
            signal = 'REVERSAL_DOWN';
            confidence = 0.6;
        } else if (adx > 25 && macdHistogram > 0) {
            // Strong continuation
            signal = 'CONTINUE';
            confidence = 0.7;
        } else {
            signal = 'CONTINUE';
            confidence = 0.55;
        }
    } else { // DOWNTREND
        if (goldenCross || (rsi < 30 && macdTurningUp)) {
            // Potential reversal
            signal = 'REVERSAL_UP';
            confidence = 0.6;
        } else if (adx > 25 && macdHistogram < 0) {
            // Strong continuation
            signal = 'CONTINUE';
            confidence = 0.7;
        } else {
            signal = 'CONTINUE';
            confidence = 0.55;
        }
    }

    // ADX strength affects confidence
    if (adx > 30) {
        confidence = Math.min(0.85, confidence + 0.1);
    } else if (adx < 15) {
        confidence = Math.max(0.3, confidence - 0.1);
    }

    return {
        state,
        signal,
        adx,
        confidence,
    };
}

// =====================================================
// Get Trend Description
// =====================================================

export function getTrendDescription(l4: L4Signal): string {
    const stateDesc = {
        'UPTREND': '上昇トレンド',
        'DOWNTREND': '下降トレンド',
        'RANGE': 'レンジ相場',
    };

    const signalDesc = {
        'CONTINUE': '継続',
        'REVERSAL_UP': '上昇反転',
        'REVERSAL_DOWN': '下降反転',
    };

    return `${stateDesc[l4.state]}(${signalDesc[l4.signal]})`;
}
