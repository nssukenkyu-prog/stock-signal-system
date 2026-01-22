
import type { OHLCV } from '../types';

// Stooq CSV format: Date,Open,High,Low,Close,Volume
// https://stooq.com/q/d/l/?s=7203.JP&i=d

export async function getQuoteStooq(symbol: string): Promise<any | null> {
    try {
        const history = await getHistoricalStooq(symbol, 5);
        if (history.length > 0) {
            const latest = history[history.length - 1];
            return {
                symbol,
                regularMarketPrice: latest.close,
                regularMarketTime: latest.date,
            };
        }
        return null;
    } catch (e) {
        return null;
    }
}

export async function getQuotesStooq(symbols: string[]): Promise<any[]> {
    // Stooq doesn't support batch CSV well, so fetch individually?
    // Or maybe we implemented it sequentially.
    // For now, return empty or implement loop.
    return [];
}

export async function getHistoricalStooq(symbol: string, days: number = 200): Promise<OHLCV[]> {
    // Convert symbol (e.g. 7203.T -> 7203.JP for Stooq, ^SPX -> ^SPX)
    let stooqSymbol = symbol;
    if (symbol.endsWith('.T')) {
        stooqSymbol = symbol.replace('.T', '.JP');
    }
    // US symbols: AAPL -> AAPL.US
    if (!symbol.includes('.') && /^[A-Z]+$/.test(symbol)) {
        stooqSymbol = `${symbol}.US`;
    }

    const url = `https://stooq.com/q/d/l/?s=${stooqSymbol}&i=d`;

    try {
        const response = await fetch(url);
        if (!response.ok) return [];

        const text = await response.text();
        const lines = text.split('\n');
        const results: OHLCV[] = [];

        // Skip header
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const [dateStr, open, high, low, close, volume] = line.split(',');

            // Stooq date is YYYY-MM-DD
            if (!dateStr || !close) continue;

            results.push({
                date: dateStr,
                open: parseFloat(open),
                high: parseFloat(high),
                low: parseFloat(low),
                close: parseFloat(close),
                volume: parseInt(volume || '0', 10),
            });
        }

        // Sort ascending (oldest first)
        results.sort((a, b) => a.date.localeCompare(b.date));

        // Limit
        return results.slice(-days);

    } catch (error) {
        console.error(`[Stooq] Error fetching ${symbol}:`, error);
        return [];
    }
}
