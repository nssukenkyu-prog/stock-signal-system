// =====================================================
// Stooq.com Data Fetcher (Free, no API key required)
// Japanese and US stocks supported
// =====================================================

import type { OHLCV, YahooQuote } from '../types';
import { formatDate } from '../utils/helpers';

// =====================================================
// Get Historical Data from Stooq
// =====================================================

export async function getHistoricalStooq(
    symbol: string,
    days: number = 365
): Promise<OHLCV[]> {
    try {
        // Convert symbol to Stooq format
        const stooqSymbol = toStooqSymbol(symbol);

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const d1 = formatDateStooq(startDate);
        const d2 = formatDateStooq(endDate);

        const url = `https://stooq.com/q/d/l/?s=${stooqSymbol}&d1=${d1}&d2=${d2}&i=d`;

        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });

        if (!res.ok) {
            console.error(`[Stooq] HTTP ${res.status} for ${symbol}`);
            return [];
        }

        const csv = await res.text();
        return parseStooqCSV(csv);
    } catch (error) {
        console.error(`[Stooq] Failed to fetch ${symbol}:`, error);
        return [];
    }
}

// =====================================================
// Get Latest Price from Stooq
// =====================================================

export async function getQuoteStooq(symbol: string): Promise<YahooQuote | null> {
    try {
        // Get last 5 days of data
        const prices = await getHistoricalStooq(symbol, 10);

        if (prices.length < 2) return null;

        const latest = prices[prices.length - 1];
        const prev = prices[prices.length - 2];

        const change = latest.close - prev.close;
        const changePct = (change / prev.close) * 100;

        return {
            symbol: symbol,
            regularMarketPrice: latest.close,
            regularMarketChange: change,
            regularMarketChangePercent: changePct,
            regularMarketVolume: latest.volume,
            regularMarketOpen: latest.open,
            regularMarketDayHigh: latest.high,
            regularMarketDayLow: latest.low,
            regularMarketPreviousClose: prev.close,
        };
    } catch (error) {
        console.error(`[Stooq] Failed to get quote for ${symbol}:`, error);
        return null;
    }
}

// =====================================================
// Get Multiple Quotes
// =====================================================

export async function getQuotesStooq(symbols: string[]): Promise<Map<string, YahooQuote>> {
    const results = new Map<string, YahooQuote>();

    for (const symbol of symbols) {
        try {
            const quote = await getQuoteStooq(symbol);
            if (quote) {
                results.set(symbol, quote);
            }
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error(`[Stooq] Error fetching ${symbol}:`, error);
        }
    }

    return results;
}

// =====================================================
// Parse Stooq CSV
// =====================================================

function parseStooqCSV(csv: string): OHLCV[] {
    const lines = csv.trim().split('\n');

    // Skip header
    if (lines.length < 2) return [];

    const prices: OHLCV[] = [];

    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');

        if (parts.length < 6) continue;

        // Format: Date,Open,High,Low,Close,Volume
        const [dateStr, open, high, low, close, volume] = parts;

        // Convert date format (YYYYMMDD -> YYYY-MM-DD)
        let formattedDate = dateStr;
        if (dateStr.length === 8 && !dateStr.includes('-')) {
            formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
        }

        prices.push({
            date: formattedDate,
            open: parseFloat(open),
            high: parseFloat(high),
            low: parseFloat(low),
            close: parseFloat(close),
            volume: parseInt(volume) || 0,
            adjClose: parseFloat(close),
        });
    }

    // Sort by date ascending
    return prices.sort((a, b) => a.date.localeCompare(b.date));
}

// =====================================================
// Convert Symbol to Stooq Format
// =====================================================

function toStooqSymbol(symbol: string): string {
    // Japanese stocks: 3197.T -> 3197.JP
    if (symbol.endsWith('.T')) {
        return symbol.replace('.T', '.JP');
    }

    // US stocks: AAPL -> AAPL.US
    if (!symbol.includes('.') && !symbol.startsWith('^')) {
        return `${symbol}.US`;
    }

    // Indices
    if (symbol === '^N225') return '^NKX';
    if (symbol === '^GSPC') return '^SPX';
    if (symbol === '^DJI') return '^DJI';

    // Forex
    if (symbol === 'USDJPY=X') return 'USDJPY';

    return symbol;
}

// =====================================================
// Format Date for Stooq (YYYYMMDD)
// =====================================================

function formatDateStooq(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}
