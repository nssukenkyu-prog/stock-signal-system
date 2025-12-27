// =====================================================
// Fetcher Worker - Data Acquisition
// Uses Stooq.com as primary (no rate limits)
// Falls back to Yahoo Finance if needed
// =====================================================

import type { Env, Symbol } from '../types';
import { getQuotesStooq, getHistoricalStooq, getQuoteStooq } from '../data/stooq';
import { getQuotes as getQuotesYahoo, getUSDJPY } from '../data/yahoo-finance';
import { getAllSymbols, getHoldingSymbolIds, insertDailyPrice, updateHoldingPrice, getDailyPrices } from '../storage/d1';
import { setSymbolState } from '../storage/kv';
import { calculateIndicators } from '../models/indicators';
import { formatDate } from '../utils/helpers';

// =====================================================
// Fetch and Update All Prices
// =====================================================

export async function fetchAllPrices(env: Env): Promise<void> {
    console.log('[Fetcher] Starting price fetch with Stooq...');

    try {
        // Get all active symbols
        const symbols = await getAllSymbols(env.DB);
        const holdingIds = await getHoldingSymbolIds(env.DB);

        // Filter out mutual funds
        const stockSymbols = symbols.filter(s =>
            !s.id.startsWith('EMAXIS') &&
            !s.id.startsWith('RAKUTEN') &&
            !s.id.startsWith('^')
        );

        // Get USDJPY for USD holdings
        let usdjpy = 150; // Default fallback
        try {
            const usdQuote = await getQuoteStooq('USDJPY=X');
            if (usdQuote) {
                usdjpy = usdQuote.regularMarketPrice;
            }
        } catch (e) {
            console.log('[Fetcher] Using default USDJPY:', usdjpy);
        }

        let successCount = 0;
        let failCount = 0;

        // Fetch each symbol individually from Stooq
        for (const symbol of stockSymbols) {
            try {
                console.log(`[Fetcher] Fetching ${symbol.id}...`);

                // Get historical data (includes latest price)
                const prices = await getHistoricalStooq(symbol.id, 10);

                if (prices.length > 0) {
                    const latest = prices[prices.length - 1];

                    // Insert the latest price
                    await insertDailyPrice(env.DB, symbol.id, latest);

                    // Update holding price if applicable
                    if (holdingIds.includes(symbol.id)) {
                        const price = symbol.market === 'US'
                            ? latest.close * usdjpy
                            : latest.close;
                        await updateHoldingPrice(env.DB, symbol.id, price);
                    }

                    // Update KV state
                    const allPrices = await getDailyPrices(env.DB, symbol.id, 150);
                    const indicators = allPrices.length >= 60 ? calculateIndicators(allPrices) : null;

                    await setSymbolState(env.STATE, symbol.id, {
                        symbolId: symbol.id,
                        lastPrice: latest.close,
                        lastUpdated: new Date().toISOString(),
                        lastSignal: null,
                        indicators,
                    });

                    console.log(`[Fetcher] ✓ ${symbol.id}: ${latest.close} (${latest.date})`);
                    successCount++;
                } else {
                    console.log(`[Fetcher] ✗ ${symbol.id}: No data from Stooq`);
                    failCount++;
                }

                // Delay between requests
                await new Promise(resolve => setTimeout(resolve, 800));

            } catch (error) {
                console.error(`[Fetcher] Error updating ${symbol.id}:`, error);
                failCount++;
            }
        }

        console.log(`[Fetcher] Complete: ${successCount} success, ${failCount} failed`);
    } catch (error) {
        console.error('[Fetcher] Fatal error:', error);
        throw error;
    }
}

// =====================================================
// Fetch Historical Data for New Symbols
// =====================================================

export async function fetchHistoricalForSymbol(
    env: Env,
    symbolId: string,
    market: 'JP' | 'US'
): Promise<void> {
    console.log(`[Fetcher] Loading historical data for ${symbolId}...`);

    // Fetch 1 year of historical data from Stooq
    const prices = await getHistoricalStooq(symbolId, 365);

    for (const price of prices) {
        await insertDailyPrice(env.DB, symbolId, price);
    }

    console.log(`[Fetcher] Loaded ${prices.length} historical prices for ${symbolId}`);
}

// =====================================================
// Initialize All Historical Data
// =====================================================

export async function initializeHistoricalData(env: Env): Promise<void> {
    console.log('[Fetcher] Initializing historical data from Stooq...');

    const symbols = await getAllSymbols(env.DB);

    for (const symbol of symbols) {
        // Skip mutual funds and indices
        if (symbol.id.startsWith('EMAXIS') ||
            symbol.id.startsWith('RAKUTEN') ||
            symbol.id.startsWith('^')) {
            continue;
        }

        try {
            await fetchHistoricalForSymbol(env, symbol.id, symbol.market);

            // Longer delay to be nice to Stooq
            await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (error) {
            console.error(`[Fetcher] Failed to initialize ${symbol.id}:`, error);
        }
    }

    console.log('[Fetcher] Historical data initialization complete');
}

