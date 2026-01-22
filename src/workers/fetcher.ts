
// =====================================================
// Fetcher Worker - Data Acquisition
// =====================================================

import type { Env, Symbol } from '../types';
import { getQuotesStooq, getHistoricalStooq, getQuoteStooq } from '../data/stooq';
import { getQuotes as getQuotesYahoo, getUSDJPY } from '../data/yahoo-finance';
import { fetchFundPrice, FUND_CODE_MAPPINGS, FUND_CODES } from '../data/yahoo-finance-jp';
import { getAllSymbols, getHoldingSymbolIds, insertDailyPrice, updateHoldingPrice, getDailyPrices, getAllHoldings } from '../storage/d1';
import { formatDate } from '../utils/helpers';

// =====================================================
// Fetch and Update All Prices
// =====================================================

export async function fetchAllPrices(env: Env): Promise<void> {
    console.log('[Fetcher] Starting price fetch with Stooq...');

    try {
        const symbols = await getAllSymbols(env.DB);
        const holdingIds = await getHoldingSymbolIds(env.DB);

        // Filter out mutual funds
        const stockSymbols = symbols.filter(s =>
            !s.id.startsWith('MF_') &&
            !s.id.startsWith('EMAXIS') &&
            !s.id.startsWith('RAKUTEN') &&
            !s.id.startsWith('^')
        );

        let usdjpy = 150;
        try {
            // Fetch USDJPY from Stooq if possible, or Yahoo
            // const q = await getQuoteStooq('USDJPY=X');
            // if (q) usdjpy = q.regularMarketPrice;
        } catch (e) { }

        let successCount = 0;
        let failCount = 0;

        for (const symbol of stockSymbols) {
            try {
                console.log(`[Fetcher] Fetching ${symbol.id}...`);
                const prices = await getHistoricalStooq(symbol.id, 10);

                if (prices.length > 0) {
                    const latest = prices[prices.length - 1];
                    await insertDailyPrice(env.DB, symbol.id, latest);

                    if (holdingIds.includes(symbol.id)) {
                        const price = symbol.market === 'US' ? latest.close * usdjpy : latest.close;
                        await updateHoldingPrice(env.DB, symbol.id, price);
                    }

                    // KV state update removed to save write costs (KV Optimization)

                    console.log(`[Fetcher] ✓ ${symbol.id}: ${latest.close}`);
                    successCount++;
                } else {
                    failCount++;
                }
                await new Promise(resolve => setTimeout(resolve, 800));
            } catch (error) {
                console.error(`[Fetcher] Error ${symbol.id}:`, error);
                failCount++;
            }
        }
    } catch (error) {
        console.error('[Fetcher] Fatal error:', error);
        throw error;
    }
}

// =====================================================
// Fetch Mutual Funds
// =====================================================

export async function fetchMutualFunds(env: Env): Promise<void> {
    console.log('[Fetcher] Starting mutual fund price update...');

    const holdings = await getAllHoldings(env.DB);
    const funds = holdings.filter(h => h.symbolId.startsWith('MF_') || h.name.includes('ファンド') || h.name.includes('eMAXIS'));

    let successCount = 0;

    for (const fund of funds) {
        let code = FUND_CODES[fund.name];
        if (!code) {
            const mapping = FUND_CODE_MAPPINGS.find(m => m.pattern.test(fund.name));
            if (mapping) code = mapping.code;
        }

        if (!code) {
            console.log(`[Fetcher] No code found for fund: ${fund.name}`);
            continue;
        }

        const price = await fetchFundPrice(code);
        if (price) {
            await updateHoldingPrice(env.DB, fund.symbolId, price);
            try {
                await insertDailyPrice(env.DB, fund.symbolId, {
                    date: new Date().toISOString().slice(0, 10),
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                    volume: 0
                });
            } catch (e) { }

            console.log(`[Fetcher] Updated ${fund.name}: ${price}`);
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    console.log(`[Fetcher] Mutual fund update complete: ${successCount} updated`);
}

export async function initializeHistoricalData(env: Env): Promise<void> {
    // Simplified stub
}

export async function fetchHistoricalForSymbol(env: Env, symbolId: string, market: 'JP' | 'US'): Promise<void> {
    // Simplified stub
}
