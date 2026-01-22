// =====================================================
// Alpha Vantage Data Fetcher (Free Tier: 25 requests/day)
// =====================================================

import type { OHLCV, YahooQuote } from '../types';
import { formatDate } from '../utils/helpers';

// Get API key from environment (will be set as secret)
const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query';

// =====================================================
// Get Global Quote
// =====================================================

export async function getQuoteAlphaVantage(
    symbol: string,
    apiKey: string
): Promise<YahooQuote | null> {
    try {
        const url = `${ALPHA_VANTAGE_BASE}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;

        const res = await fetch(url);
        if (!res.ok) return null;

        const data = await res.json() as any;
        const quote = data?.['Global Quote'];

        if (!quote || !quote['05. price']) return null;

        const price = parseFloat(quote['05. price']);
        const prevClose = parseFloat(quote['08. previous close'] || '0');
        const change = parseFloat(quote['09. change'] || '0');
        const changePct = parseFloat(quote['10. change percent']?.replace('%', '') || '0');

        return {
            symbol: quote['01. symbol'],
            regularMarketPrice: price,
            regularMarketChange: change,
            regularMarketChangePercent: changePct,
            regularMarketVolume: parseInt(quote['06. volume'] || '0'),
            regularMarketOpen: parseFloat(quote['02. open'] || price.toString()),
            regularMarketDayHigh: parseFloat(quote['03. high'] || price.toString()),
            regularMarketDayLow: parseFloat(quote['04. low'] || price.toString()),
            regularMarketPreviousClose: prevClose,
        };
    } catch (error) {
        console.error(`[AlphaVantage] Failed to fetch ${symbol}:`, error);
        return null;
    }
}

// =====================================================
// Get Daily Historical Data
// =====================================================

export async function getHistoricalAlphaVantage(
    symbol: string,
    apiKey: string
): Promise<OHLCV[]> {
    try {
        const url = `${ALPHA_VANTAGE_BASE}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${apiKey}`;

        const res = await fetch(url);
        if (!res.ok) return [];

        const data = await res.json() as any;
        const timeSeries = data?.['Time Series (Daily)'];

        if (!timeSeries) return [];

        const prices: OHLCV[] = [];

        for (const [dateStr, values] of Object.entries(timeSeries)) {
            const v = values as any;
            prices.push({
                date: dateStr,
                open: parseFloat(v['1. open']),
                high: parseFloat(v['2. high']),
                low: parseFloat(v['3. low']),
                close: parseFloat(v['4. close']),
                volume: parseInt(v['5. volume']),
                adjClose: parseFloat(v['4. close']),
            });
        }

        // Sort by date ascending
        return prices.sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
        console.error(`[AlphaVantage] Failed to fetch historical ${symbol}:`, error);
        return [];
    }
}

// =====================================================
// Convert symbol for Alpha Vantage
// =====================================================

export function toAlphaVantageSymbol(symbolId: string): string {
    // Japanese stocks: 3197.T -> 3197.TYO (Tokyo Stock Exchange)
    if (symbolId.endsWith('.T')) {
        return symbolId.replace('.T', '.TYO');
    }
    return symbolId;
}
