// =====================================================
// Signal Worker - Signal Generation
// =====================================================

import type { Env, SignalResult, Symbol } from '../types';
import { getAllSymbols, getHoldingSymbolIds, getDailyPrices, insertSignalHistory } from '../storage/d1';
import { getSymbolState, setSymbolState, getThresholds, getPreviousSignal, setPreviousSignal } from '../storage/kv';
import { aggregateSignals, shouldNotify } from '../models/rules';
import { getUpcomingEventsForSymbol } from '../data/event-calendar';

export interface SignalGenerationResult {
    symbol: Symbol;
    signal: SignalResult;
    shouldNotify: boolean;
}

// =====================================================
// Generate Signals for All Symbols
// =====================================================

export async function generateAllSignals(env: Env): Promise<SignalGenerationResult[]> {
    console.log('[Signal] Generating signals...');

    const results: SignalGenerationResult[] = [];

    try {
        const symbols = await getAllSymbols(env.DB);
        const holdingIds = await getHoldingSymbolIds(env.DB);
        const thresholds = await getThresholds(env.STATE);

        for (const symbol of symbols) {
            try {
                // Skip mutual funds (tracked differently)
                if (symbol.id.startsWith('EMAXIS') || symbol.id.startsWith('RAKUTEN') || symbol.id.startsWith('^')) {
                    continue;
                }

                const result = await generateSignalForSymbol(env, symbol, holdingIds, thresholds);
                if (result) {
                    results.push(result);
                }
            } catch (error) {
                console.error(`[Signal] Error processing ${symbol.id}:`, error);
            }
        }

        console.log(`[Signal] Generated ${results.length} signals, ${results.filter(r => r.shouldNotify).length} to notify`);
        return results;
    } catch (error) {
        console.error('[Signal] Fatal error:', error);
        throw error;
    }
}

// =====================================================
// Generate Signal for Single Symbol
// =====================================================

async function generateSignalForSymbol(
    env: Env,
    symbol: Symbol,
    holdingIds: string[],
    thresholds: any
): Promise<SignalGenerationResult | null> {
    // Get historical prices
    const prices = await getDailyPrices(env.DB, symbol.id, 200);

    if (prices.length < 60) {
        console.log(`[Signal] Skipping ${symbol.id}, insufficient data (${prices.length} days)`);
        return null;
    }

    // Get upcoming events
    const events = await getUpcomingEventsForSymbol(symbol.id, 14);

    // Get previous signal for hysteresis
    const prevSignalJson = await getPreviousSignal(env.STATE, symbol.id);
    const prevSignal = prevSignalJson ? JSON.parse(prevSignalJson) as SignalResult : null;

    // Check if this is a holding
    const isHolding = holdingIds.includes(symbol.id);

    // Generate signal
    const signal = aggregateSignals({
        symbolId: symbol.id,
        symbolName: symbol.name,
        prices,
        thresholds,
        upcomingEvents: events,
        isHolding,
    });

    // Check if should notify
    const notify = shouldNotify(signal, prevSignal, thresholds);

    // Save signal to history if actionable
    if (signal.action !== 'HOLD') {
        await insertSignalHistory(env.DB, signal);
    }

    // Update previous signal
    await setPreviousSignal(env.STATE, symbol.id, JSON.stringify(signal));

    // Update symbol state
    const currentState = await getSymbolState(env.STATE, symbol.id);
    if (currentState) {
        await setSymbolState(env.STATE, symbol.id, {
            ...currentState,
            lastSignal: signal,
        });
    }

    return {
        symbol,
        signal,
        shouldNotify: notify,
    };
}

// =====================================================
// Get Holdings Signals Only
// =====================================================

export async function generateHoldingsSignals(env: Env): Promise<SignalGenerationResult[]> {
    console.log('[Signal] Generating holdings signals...');

    const results: SignalGenerationResult[] = [];
    const symbols = await getAllSymbols(env.DB);
    const holdingIds = await getHoldingSymbolIds(env.DB);
    const thresholds = await getThresholds(env.STATE);

    for (const symbol of symbols) {
        if (!holdingIds.includes(symbol.id)) continue;

        // Skip non-stock holdings
        if (symbol.id.startsWith('EMAXIS') || symbol.id.startsWith('RAKUTEN')) {
            continue;
        }

        try {
            const result = await generateSignalForSymbol(env, symbol, holdingIds, thresholds);
            if (result) {
                results.push(result);
            }
        } catch (error) {
            console.error(`[Signal] Error processing holding ${symbol.id}:`, error);
        }
    }

    return results;
}
