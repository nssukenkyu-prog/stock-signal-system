// =====================================================
// Technical Indicators Calculator
// =====================================================

import type { OHLCV, TechnicalIndicators } from '../types';
import { average, stdDev } from '../utils/helpers';

// =====================================================
// Simple Moving Average (SMA)
// =====================================================

export function sma(closes: number[], period: number): number {
    if (closes.length < period) return closes[closes.length - 1] || 0;
    const slice = closes.slice(-period);
    return average(slice);
}

// =====================================================
// Exponential Moving Average (EMA)
// =====================================================

export function ema(closes: number[], period: number): number {
    if (closes.length === 0) return 0;
    if (closes.length < period) return average(closes);

    const k = 2 / (period + 1);
    let emaValue = average(closes.slice(0, period));

    for (let i = period; i < closes.length; i++) {
        emaValue = closes[i] * k + emaValue * (1 - k);
    }

    return emaValue;
}

// =====================================================
// Relative Strength Index (RSI)
// =====================================================

export function rsi(closes: number[], period: number = 14): number {
    if (closes.length < period + 1) return 50;

    const changes = [];
    for (let i = 1; i < closes.length; i++) {
        changes.push(closes[i] - closes[i - 1]);
    }

    const recentChanges = changes.slice(-period);

    let avgGain = 0;
    let avgLoss = 0;

    for (const change of recentChanges) {
        if (change > 0) avgGain += change;
        else avgLoss += Math.abs(change);
    }

    avgGain /= period;
    avgLoss /= period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

// =====================================================
// MACD (Moving Average Convergence Divergence)
// =====================================================

export function macd(closes: number[]): { macd: number; signal: number; histogram: number } {
    const ema12 = ema(closes, 12);
    const ema26 = ema(closes, 26);
    const macdLine = ema12 - ema26;

    // Calculate signal line (9-day EMA of MACD)
    // Simplified: we calculate MACD for last 9 bars and EMA them
    const macdValues: number[] = [];
    for (let i = Math.max(0, closes.length - 9); i < closes.length; i++) {
        const subCloses = closes.slice(0, i + 1);
        const e12 = ema(subCloses, 12);
        const e26 = ema(subCloses, 26);
        macdValues.push(e12 - e26);
    }

    const signalLine = macdValues.length >= 9 ? ema(macdValues, 9) : macdLine;

    return {
        macd: macdLine,
        signal: signalLine,
        histogram: macdLine - signalLine,
    };
}

// =====================================================
// Average True Range (ATR)
// =====================================================

export function atr(prices: OHLCV[], period: number = 20): number {
    if (prices.length < 2) return 0;

    const trueRanges: number[] = [];

    for (let i = 1; i < prices.length; i++) {
        const high = prices[i].high;
        const low = prices[i].low;
        const prevClose = prices[i - 1].close;

        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );

        trueRanges.push(tr);
    }

    if (trueRanges.length < period) {
        return average(trueRanges);
    }

    return average(trueRanges.slice(-period));
}

// =====================================================
// ADX (Average Directional Index) with DI+/DI-
// =====================================================

export function adx(prices: OHLCV[], period: number = 14): { adx: number; diPlus: number; diMinus: number } {
    if (prices.length < period + 1) {
        return { adx: 0, diPlus: 0, diMinus: 0 };
    }

    const dmPlus: number[] = [];
    const dmMinus: number[] = [];
    const tr: number[] = [];

    for (let i = 1; i < prices.length; i++) {
        const high = prices[i].high;
        const low = prices[i].low;
        const prevHigh = prices[i - 1].high;
        const prevLow = prices[i - 1].low;
        const prevClose = prices[i - 1].close;

        // True Range
        const trValue = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        tr.push(trValue);

        // Directional Movement
        const upMove = high - prevHigh;
        const downMove = prevLow - low;

        if (upMove > downMove && upMove > 0) {
            dmPlus.push(upMove);
            dmMinus.push(0);
        } else if (downMove > upMove && downMove > 0) {
            dmPlus.push(0);
            dmMinus.push(downMove);
        } else {
            dmPlus.push(0);
            dmMinus.push(0);
        }
    }

    // Smoothed values
    const smoothedTR = average(tr.slice(-period));
    const smoothedDMPlus = average(dmPlus.slice(-period));
    const smoothedDMMinus = average(dmMinus.slice(-period));

    // DI+ and DI-
    const diPlus = smoothedTR > 0 ? (smoothedDMPlus / smoothedTR) * 100 : 0;
    const diMinus = smoothedTR > 0 ? (smoothedDMMinus / smoothedTR) * 100 : 0;

    // DX and ADX
    const diDiff = Math.abs(diPlus - diMinus);
    const diSum = diPlus + diMinus;
    const dx = diSum > 0 ? (diDiff / diSum) * 100 : 0;

    return {
        adx: dx, // Simplified: using DX instead of smoothed ADX
        diPlus,
        diMinus,
    };
}

// =====================================================
// Bollinger Bands
// =====================================================

export function bollingerBands(closes: number[], period: number = 20, stdDevMultiplier: number = 2): {
    upper: number;
    middle: number;
    lower: number;
} {
    const middle = sma(closes, period);
    const recentCloses = closes.slice(-period);
    const std = stdDev(recentCloses);

    return {
        upper: middle + stdDevMultiplier * std,
        middle,
        lower: middle - stdDevMultiplier * std,
    };
}

// =====================================================
// Volume Ratio
// =====================================================

export function volumeRatio(volumes: number[], period: number = 20): number {
    if (volumes.length < 2) return 1;

    const currentVolume = volumes[volumes.length - 1];
    const avgVolume = average(volumes.slice(-period - 1, -1));

    return avgVolume > 0 ? currentVolume / avgVolume : 1;
}

// =====================================================
// Calculate All Indicators
// =====================================================

export function calculateIndicators(prices: OHLCV[]): TechnicalIndicators {
    const closes = prices.map(p => p.close);
    const volumes = prices.map(p => p.volume);

    const macdResult = macd(closes);
    const adxResult = adx(prices);
    const bbands = bollingerBands(closes);

    return {
        sma20: sma(closes, 20),
        sma60: sma(closes, 60),
        sma120: sma(closes, 120),
        ema12: ema(closes, 12),
        ema26: ema(closes, 26),
        rsi14: rsi(closes, 14),
        macd: macdResult.macd,
        macdSignal: macdResult.signal,
        macdHistogram: macdResult.histogram,
        atr20: atr(prices, 20),
        adx14: adxResult.adx,
        diPlus: adxResult.diPlus,
        diMinus: adxResult.diMinus,
        bollingerUpper: bbands.upper,
        bollingerLower: bbands.lower,
        bollingerMiddle: bbands.middle,
        volumeRatio: volumeRatio(volumes, 20),
    };
}

// =====================================================
// ATR Percentage (for volatility-based targets)
// =====================================================

export function atrPercent(prices: OHLCV[], period: number = 20): number {
    const atrValue = atr(prices, period);
    const currentPrice = prices[prices.length - 1]?.close || 1;
    return (atrValue / currentPrice) * 100;
}
