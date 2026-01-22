
// =====================================================
// Signal Worker
// =====================================================

import type { Env, SignalResult, Symbol } from '../types';
import { getAllSymbols, getHoldingSymbolIds, getDailyPrices, insertSignalHistory } from '../storage/d1';
import { getThresholds, getPreviousSignal, setPreviousSignal } from '../storage/kv';
import { aggregateSignals, shouldNotify } from '../models/rules';
import { getUpcomingEventsForSymbol } from '../data/event-calendar';

export interface SignalGenerationResult {
    symbol: Symbol;
    signal: SignalResult;
    shouldNotify: boolean;
}

export async function generateAllSignals(env: Env): Promise<SignalGenerationResult[]> {
    console.log('[Signal] Generating signals...');
    const results: SignalGenerationResult[] = [];
    const symbols = await getAllSymbols(env.DB);
    const holdingIds = await getHoldingSymbolIds(env.DB);
    const thresholds = await getThresholds(env.STATE);

    for (const symbol of symbols) {
        if (symbol.id.startsWith('MF_') || symbol.id.startsWith('^')) continue;

        try {
            const prices = await getDailyPrices(env.DB, symbol.id, 200);
            if (prices.length < 50) continue;

            const events = await getUpcomingEventsForSymbol(symbol.id, 14);
            const prevSignalJson = await getPreviousSignal(env.STATE, symbol.id);
            const prevSignal = prevSignalJson ? JSON.parse(prevSignalJson) : null;
            const isHolding = holdingIds.includes(symbol.id);

            const signal = aggregateSignals({
                symbolId: symbol.id,
                symbolName: symbol.name,
                prices,
                thresholds,
                upcomingEvents: events,
                isHolding,
            });

            const notify = shouldNotify(signal, prevSignal, thresholds);

            if (signal.action !== 'HOLD') {
                await insertSignalHistory(env.DB, signal);
            }

            // KV Optimization: Only write if changed
            const currentSignalJson = JSON.stringify(signal);
            if (prevSignalJson !== currentSignalJson) {
                await setPreviousSignal(env.STATE, symbol.id, currentSignalJson);
            }

            if (notify) {
                results.push({ symbol, signal, shouldNotify: notify });
            }

        } catch (error) {
            console.error(`[Signal] Error ${symbol.id}:`, error);
        }
    }
    return results;
}

export async function generateHoldingsSignals(env: Env): Promise<SignalGenerationResult[]> {
    return []; // Simplified
}
