// =====================================================
// Event Calendar Fetcher
// =====================================================

import type { MarketEvent } from '../types';
import { generateId, formatDate } from '../utils/helpers';

// =====================================================
// Fetch Economic Calendar (Investing.com Alternative)
// =====================================================

export async function fetchEconomicCalendar(): Promise<MarketEvent[]> {
    // Note: Most economic calendar APIs require paid subscriptions.
    // This is a simplified implementation that can be extended.

    // Fallback: return known important dates
    const now = new Date();
    const events: MarketEvent[] = [];

    // FOMC meetings (pre-defined key dates for 2025)
    const fomcDates = [
        '2025-01-29', '2025-03-19', '2025-05-07',
        '2025-06-18', '2025-07-30', '2025-09-17',
        '2025-11-05', '2025-12-17'
    ];

    for (const dateStr of fomcDates) {
        const date = new Date(dateStr);
        if (date >= now) {
            events.push({
                id: `fomc_${dateStr}`,
                type: 'economic',
                date: dateStr,
                description: 'FOMC金利決定会合',
                importance: 3,
            });
        }
    }

    // JP BOJ meetings
    const bojDates = [
        '2025-01-24', '2025-03-14', '2025-04-25',
        '2025-06-13', '2025-07-31', '2025-09-19',
        '2025-10-31', '2025-12-19'
    ];

    for (const dateStr of bojDates) {
        const date = new Date(dateStr);
        if (date >= now) {
            events.push({
                id: `boj_${dateStr}`,
                type: 'economic',
                date: dateStr,
                description: '日銀金融政策決定会合',
                importance: 3,
            });
        }
    }

    // US jobs report (first Friday of each month)
    for (let month = 0; month < 12; month++) {
        const firstDay = new Date(2025, month, 1);
        const firstFriday = new Date(firstDay);
        const dayOfWeek = firstDay.getDay();
        const daysToFriday = (5 - dayOfWeek + 7) % 7;
        firstFriday.setDate(1 + daysToFriday);

        if (firstFriday >= now) {
            const dateStr = formatDate(firstFriday);
            events.push({
                id: `jobs_${dateStr}`,
                type: 'economic',
                date: dateStr,
                description: '米雇用統計',
                importance: 3,
            });
        }
    }

    // CPI release (typically mid-month)
    for (let month = 0; month < 12; month++) {
        const cpiDate = new Date(2025, month, 12);
        if (cpiDate >= now) {
            const dateStr = formatDate(cpiDate);
            events.push({
                id: `cpi_${dateStr}`,
                type: 'economic',
                date: dateStr,
                description: '米CPI(消費者物価指数)',
                importance: 2,
            });
        }
    }

    return events.sort((a, b) => a.date.localeCompare(b.date));
}

// =====================================================
// Fetch Earnings Calendar (Yahoo Finance)
// =====================================================

export async function fetchEarningsCalendar(symbols: string[]): Promise<MarketEvent[]> {
    const events: MarketEvent[] = [];

    // Yahoo Finance earnings endpoint (limited)
    for (const symbol of symbols) {
        try {
            const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=calendarEvents`;

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; StockBot/1.0)',
                },
            });

            if (!response.ok) continue;

            const data = await response.json() as any;
            const calendarEvents = data?.quoteSummary?.result?.[0]?.calendarEvents;

            if (calendarEvents?.earnings?.earningsDate) {
                const earningsDates = calendarEvents.earnings.earningsDate;
                if (earningsDates.length > 0) {
                    const date = new Date(earningsDates[0].raw * 1000);
                    if (date >= new Date()) {
                        events.push({
                            id: generateId('earnings'),
                            symbolId: symbol,
                            type: 'earnings',
                            date: formatDate(date),
                            description: `${symbol} 決算発表`,
                            importance: 2,
                        });
                    }
                }
            }

            // Check for dividends
            if (calendarEvents?.dividendDate) {
                const divDate = new Date(calendarEvents.dividendDate.raw * 1000);
                if (divDate >= new Date()) {
                    events.push({
                        id: generateId('dividend'),
                        symbolId: symbol,
                        type: 'dividend',
                        date: formatDate(divDate),
                        description: `${symbol} 配当権利日`,
                        importance: 1,
                    });
                }
            }
        } catch (error) {
            // Skip symbols that fail
            continue;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return events;
}

// =====================================================
// Get Upcoming Events for Symbol
// =====================================================

export async function getUpcomingEventsForSymbol(
    symbolId: string,
    days: number = 14
): Promise<MarketEvent[]> {
    const allEvents = await fetchEarningsCalendar([symbolId]);
    const economicEvents = await fetchEconomicCalendar();

    const futureDate = new Date(Date.now() + days * 24 * 3600 * 1000);
    const futureDateStr = formatDate(futureDate);
    const todayStr = formatDate(new Date());

    return [...allEvents, ...economicEvents]
        .filter(e => e.date >= todayStr && e.date <= futureDateStr)
        .sort((a, b) => a.date.localeCompare(b.date));
}
