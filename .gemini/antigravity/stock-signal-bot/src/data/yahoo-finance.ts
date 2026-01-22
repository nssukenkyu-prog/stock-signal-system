// =====================================================
// Yahoo Finance Data Fetcher (Unofficial API)
// =====================================================

import type { OHLCV, YahooQuote } from '../types';
import { retry, formatDate } from '../utils/helpers';

const YAHOO_BASE_URL = 'https://query1.finance.yahoo.com';

// =====================================================
// Get Real-time Quote
// =====================================================

export async function getQuote(symbol: string): Promise<YahooQuote | null> {
    try {
        const url = `${YAHOO_BASE_URL}/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;

        const response = await retry(async () => {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; StockBot/1.0)',
                },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res;
        });

        const data = await response.json() as any;
        const result = data?.quoteResponse?.result?.[0];

        if (!result) return null;

        return {
            symbol: result.symbol,
            regularMarketPrice: result.regularMarketPrice || 0,
            regularMarketChange: result.regularMarketChange || 0,
            regularMarketChangePercent: result.regularMarketChangePercent || 0,
            regularMarketVolume: result.regularMarketVolume || 0,
            regularMarketOpen: result.regularMarketOpen || 0,
            regularMarketDayHigh: result.regularMarketDayHigh || 0,
            regularMarketDayLow: result.regularMarketDayLow || 0,
            regularMarketPreviousClose: result.regularMarketPreviousClose || 0,
        };
    } catch (error) {
        console.error(`Failed to fetch quote for ${symbol}:`, error);
        return null;
    }
}

// =====================================================
// Get Multiple Quotes (with improved rate limiting)
// =====================================================

export async function getQuotes(symbols: string[]): Promise<Map<string, YahooQuote>> {
    const results = new Map<string, YahooQuote>();

    if (symbols.length === 0) return results;

    // Try batch request first (more efficient)
    const allSymbols = symbols.join(',');

    try {
        const url = `${YAHOO_BASE_URL}/v7/finance/quote?symbols=${encodeURIComponent(allSymbols)}`;

        const response = await retryWithBackoff(async () => {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json',
                },
            });

            if (res.status === 429) {
                console.log('[Yahoo] Rate limited, will retry with backoff');
                throw new Error('RATE_LIMITED');
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res;
        }, 5, 2000); // 5 retries, starting at 2 seconds

        const data = await response.json() as any;
        const quotes = data?.quoteResponse?.result || [];

        for (const quote of quotes) {
            results.set(quote.symbol, {
                symbol: quote.symbol,
                regularMarketPrice: quote.regularMarketPrice || 0,
                regularMarketChange: quote.regularMarketChange || 0,
                regularMarketChangePercent: quote.regularMarketChangePercent || 0,
                regularMarketVolume: quote.regularMarketVolume || 0,
                regularMarketOpen: quote.regularMarketOpen || 0,
                regularMarketDayHigh: quote.regularMarketDayHigh || 0,
                regularMarketDayLow: quote.regularMarketDayLow || 0,
                regularMarketPreviousClose: quote.regularMarketPreviousClose || 0,
            });
        }

        console.log(`[Yahoo] Fetched ${results.size}/${symbols.length} quotes`);
    } catch (error) {
        console.error(`[Yahoo] Batch quote failed, trying individual:`, error);

        // Fallback: fetch individually with longer delays
        for (const symbol of symbols) {
            try {
                await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5s delay
                const quote = await getQuoteFromChart(symbol);
                if (quote) {
                    results.set(symbol, quote);
                }
            } catch (e) {
                console.error(`[Yahoo] Failed to fetch ${symbol}:`, e);
            }
        }
    }

    return results;
}

// Retry with exponential backoff
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelayMs: number = 1000
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            if (attempt < maxAttempts) {
                const delay = baseDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
                console.log(`[Yahoo] Retry ${attempt}/${maxAttempts} after ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}

// Fallback: get quote from chart API (different rate limits)
async function getQuoteFromChart(symbol: string): Promise<YahooQuote | null> {
    try {
        const url = `${YAHOO_BASE_URL}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            },
        });

        if (!res.ok) return null;

        const data = await res.json() as any;
        const meta = data?.chart?.result?.[0]?.meta;

        if (!meta) return null;

        return {
            symbol: meta.symbol,
            regularMarketPrice: meta.regularMarketPrice || 0,
            regularMarketChange: (meta.regularMarketPrice || 0) - (meta.previousClose || 0),
            regularMarketChangePercent: meta.previousClose ?
                ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100 : 0,
            regularMarketVolume: meta.regularMarketVolume || 0,
            regularMarketOpen: meta.regularMarketOpen || meta.regularMarketPrice || 0,
            regularMarketDayHigh: meta.regularMarketDayHigh || meta.regularMarketPrice || 0,
            regularMarketDayLow: meta.regularMarketDayLow || meta.regularMarketPrice || 0,
            regularMarketPreviousClose: meta.previousClose || 0,
        };
    } catch (error) {
        console.error(`[Yahoo] Chart API failed for ${symbol}:`, error);
        return null;
    }
}

// =====================================================
// Get Historical Data
// =====================================================

export async function getHistoricalData(
    symbol: string,
    period1: Date,
    period2: Date = new Date()
): Promise<OHLCV[]> {
    try {
        const p1 = Math.floor(period1.getTime() / 1000);
        const p2 = Math.floor(period2.getTime() / 1000);

        const url = `${YAHOO_BASE_URL}/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d`;

        const response = await retry(async () => {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; StockBot/1.0)',
                },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res;
        });

        const data = await response.json() as any;
        const result = data?.chart?.result?.[0];

        if (!result || !result.timestamp) return [];

        const timestamps = result.timestamp;
        const quotes = result.indicators?.quote?.[0];
        const adjClose = result.indicators?.adjclose?.[0]?.adjclose;

        if (!quotes) return [];

        const prices: OHLCV[] = [];

        for (let i = 0; i < timestamps.length; i++) {
            const close = quotes.close?.[i];
            if (close == null) continue;

            const date = new Date(timestamps[i] * 1000);
            prices.push({
                date: formatDate(date),
                open: quotes.open?.[i] || close,
                high: quotes.high?.[i] || close,
                low: quotes.low?.[i] || close,
                close,
                volume: quotes.volume?.[i] || 0,
                adjClose: adjClose?.[i] || close,
            });
        }

        return prices;
    } catch (error) {
        console.error(`Failed to fetch historical data for ${symbol}:`, error);
        return [];
    }
}

// =====================================================
// Get USDJPY Rate
// =====================================================

export async function getUSDJPY(): Promise<number> {
    const quote = await getQuote('USDJPY=X');
    return quote?.regularMarketPrice || 150; // Fallback
}

// =====================================================
// Get Index Data
// =====================================================

export async function getIndices(): Promise<{
    nikkei: number | null;
    sp500: number | null;
    dowjones: number | null;
}> {
    const quotes = await getQuotes(['^N225', '^GSPC', '^DJI']);

    return {
        nikkei: quotes.get('^N225')?.regularMarketPrice || null,
        sp500: quotes.get('^GSPC')?.regularMarketPrice || null,
        dowjones: quotes.get('^DJI')?.regularMarketPrice || null,
    };
}

// =====================================================
// Convert Symbol to Yahoo Format
// =====================================================

export function toYahooSymbol(symbolId: string, market: 'JP' | 'US'): string {
    // Already in Yahoo format
    if (symbolId.includes('.') || symbolId.startsWith('^') || symbolId.includes('=')) {
        return symbolId;
    }

    // Japanese stock
    if (market === 'JP' && /^\d{4}$/.test(symbolId)) {
        return `${symbolId}.T`;
    }

    return symbolId;
}
