
// =====================================================
// D1 Database Operations
// =====================================================

import type { Env, Symbol, Holding, OHLCV, MarketEvent, SignalResult } from '../types';

// =====================================================
// Symbols
// =====================================================

export async function getAllSymbols(db: D1Database, activeOnly = true): Promise<Symbol[]> {
    const query = activeOnly
        ? 'SELECT * FROM symbols WHERE is_active = 1'
        : 'SELECT * FROM symbols';
    const result = await db.prepare(query).all();
    return (result.results || []).map(row => ({
        id: row.id as string,
        name: row.name as string,
        market: row.market as 'JP' | 'US',
        sector: row.sector as string | undefined,
        isEtf: row.asset_type === 'etf' || row.asset_type === 'mutual_fund',
        isActive: row.is_active === 1,
    }));
}

export async function getSymbolById(db: D1Database, id: string): Promise<Symbol | null> {
    const result = await db.prepare('SELECT * FROM symbols WHERE id = ?').bind(id).first();
    if (!result) return null;
    return {
        id: result.id as string,
        name: result.name as string,
        market: result.market as 'JP' | 'US',
        sector: result.sector as string | undefined,
        isEtf: result.asset_type === 'etf' || result.asset_type === 'mutual_fund',
        isActive: result.is_active === 1,
    };
}

// =====================================================
// Holdings
// =====================================================

export async function getAllHoldings(db: D1Database): Promise<Holding[]> {
    const query = 'SELECT * FROM holdings ORDER BY market_value DESC';
    const result = await db.prepare(query).all();
    return (result.results || []).map(row => ({
        symbolId: row.symbol_id as string,
        name: row.name as string,
        accountType: row.account_type as any,
        quantity: row.quantity as number,
        avgCost: row.avg_cost as number,
        currentPrice: row.current_price as number,
        marketValue: row.market_value as number,
        unrealizedPnL: row.unrealized_pnl as number,
        currency: (row.currency as 'JPY' | 'USD') || 'JPY',
    }));
}

export async function getHoldingSymbolIds(db: D1Database): Promise<string[]> {
    const result = await db.prepare('SELECT DISTINCT symbol_id FROM holdings').all();
    return (result.results || []).map(row => row.symbol_id as string);
}

export async function updateHoldingPrice(
    db: D1Database,
    symbolId: string,
    price: number
): Promise<void> {
    await db.prepare(`
    UPDATE holdings 
    SET current_price = ?, 
        market_value = quantity * ?,
        unrealized_pnl = quantity * (? - avg_cost),
        updated_at = datetime('now')
    WHERE symbol_id = ?
  `).bind(price, price, price, symbolId).run();
}

// =====================================================
// Price Data
// =====================================================

export async function insertDailyPrice(db: D1Database, symbolId: string, data: OHLCV): Promise<void> {
    await db.prepare(`
    INSERT OR REPLACE INTO prices_daily (symbol_id, date, open, high, low, close, volume, adj_close)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
        symbolId,
        data.date,
        data.open,
        data.high,
        data.low,
        data.close,
        data.volume,
        data.adjClose || data.close
    ).run();
}

export async function getDailyPrices(
    db: D1Database,
    symbolId: string,
    days: number = 200
): Promise<OHLCV[]> {
    const result = await db.prepare(`
    SELECT * FROM prices_daily 
    WHERE symbol_id = ? 
    ORDER BY date DESC 
    LIMIT ?
  `).bind(symbolId, days).all();

    return (result.results || []).map(row => ({
        date: row.date as string,
        open: row.open as number,
        high: row.high as number,
        low: row.low as number,
        close: row.close as number,
        volume: row.volume as number,
        adjClose: row.adj_close as number,
    })).reverse(); // Return in chronological order
}

export async function getLatestPrice(db: D1Database, symbolId: string): Promise<number | null> {
    const result = await db.prepare(`
    SELECT close FROM prices_daily 
    WHERE symbol_id = ? 
    ORDER BY date DESC 
    LIMIT 1
  `).bind(symbolId).first();
    return result ? result.close as number : null;
}

export async function insertIntradayPrice(
    db: D1Database,
    symbolId: string,
    timestamp: string,
    price: number,
    volume?: number
): Promise<void> {
    await db.prepare(`
    INSERT OR REPLACE INTO prices_intraday (symbol_id, timestamp, price, volume)
    VALUES (?, ?, ?, ?)
  `).bind(symbolId, timestamp, price, volume || null).run();
}

// Clean up old intraday data (keep last 2 days)
export async function cleanupIntradayPrices(db: D1Database): Promise<void> {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
    await db.prepare(`
    DELETE FROM prices_intraday WHERE timestamp < ?
  `).bind(twoDaysAgo).run();
}

// =====================================================
// Events
// =====================================================

export async function getUpcomingEvents(db: D1Database, days: number = 7): Promise<MarketEvent[]> {
    const today = new Date().toISOString().slice(0, 10);
    const futureDate = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const result = await db.prepare(`
    SELECT * FROM events 
    WHERE event_date BETWEEN ? AND ?
    ORDER BY event_date, importance DESC
  `).bind(today, futureDate).all();

    return (result.results || []).map(row => ({
        id: row.id as string,
        symbolId: row.symbol_id as string | undefined,
        type: row.event_type as any,
        date: row.event_date as string,
        description: row.description as string,
        importance: row.importance as 1 | 2 | 3,
    }));
}

export async function insertEvent(db: D1Database, event: MarketEvent): Promise<void> {
    await db.prepare(`
    INSERT OR REPLACE INTO events (id, symbol_id, event_type, event_date, description, importance)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
        event.id,
        event.symbolId || null,
        event.type,
        event.date,
        event.description,
        event.importance
    ).run();
}

// =====================================================
// Signal History
// =====================================================

export async function insertSignalHistory(db: D1Database, signal: SignalResult): Promise<void> {
    const id = `${signal.symbolId}_${Date.now()}`;
    await db.prepare(`
    INSERT INTO signal_history (id, symbol_id, action, confidence, horizon, reasons, warnings, l1_data, l2_data, l3_data, l4_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
        id,
        signal.symbolId,
        signal.action,
        signal.confidence,
        signal.horizon,
        JSON.stringify(signal.reasons),
        JSON.stringify(signal.warnings),
        JSON.stringify(signal.l1),
        JSON.stringify(signal.l2),
        JSON.stringify(signal.l3),
        JSON.stringify(signal.l4)
    ).run();
}

// =====================================================
// Notification Logs
// =====================================================

export async function insertNotificationLog(
    db: D1Database,
    symbolId: string | null,
    action: string | null,
    message: string,
    success: boolean,
    errorMessage?: string
): Promise<void> {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await db.prepare(`
    INSERT INTO notification_logs (id, symbol_id, action, message, success, error_message)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, symbolId, action, message, success ? 1 : 0, errorMessage || null).run();
}

export async function getRecentNotifications(db: D1Database, hours: number = 24): Promise<any[]> {
    const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    const result = await db.prepare(`
    SELECT * FROM notification_logs 
    WHERE sent_at > ?
    ORDER BY sent_at DESC
  `).bind(since).all();
    return result.results || [];
}

// =====================================================
// Portfolio Snapshots
// =====================================================

export interface PortfolioSnapshot {
    date: string;
    totalValue: number;
    dailyPnL: number;
    monthlyStartValue: number | null;
}

export async function savePortfolioSnapshot(
    db: D1Database,
    totalValue: number,
    dailyPnL: number
): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 8) + '01'; // First day of month

    // Get month start value
    const monthStartSnapshot = await db.prepare(`
        SELECT total_value FROM portfolio_snapshots 
        WHERE date = ? LIMIT 1
    `).bind(monthStart).first();

    const monthlyStartValue = monthStartSnapshot?.total_value ?? totalValue;

    const id = `snap_${today}`;
    await db.prepare(`
        INSERT OR REPLACE INTO portfolio_snapshots 
        (id, date, total_value, daily_pnl, monthly_start_value)
        VALUES (?, ?, ?, ?, ?)
    `).bind(id, today, totalValue, dailyPnL, monthlyStartValue).run();
}

export async function getPortfolioSnapshot(
    db: D1Database,
    date: string
): Promise<PortfolioSnapshot | null> {
    const result = await db.prepare(`
        SELECT * FROM portfolio_snapshots WHERE date = ?
    `).bind(date).first();

    if (!result) return null;

    return {
        date: result.date as string,
        totalValue: result.total_value as number,
        dailyPnL: result.daily_pnl as number,
        monthlyStartValue: result.monthly_start_value as number | null,
    };
}

export async function getMonthStartValue(db: D1Database): Promise<number | null> {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString().slice(0, 10);

    // Try to get month start snapshot
    const snapshot = await getPortfolioSnapshot(db, monthStart);
    if (snapshot) return snapshot.totalValue;

    // Fallback: get earliest snapshot this month
    const result = await db.prepare(`
        SELECT total_value FROM portfolio_snapshots 
        WHERE date >= ? 
        ORDER BY date ASC 
        LIMIT 1
    `).bind(monthStart).first();

    return result?.total_value as number | null;
}

export async function calculateMonthlyPnL(
    db: D1Database,
    currentValue: number
): Promise<{ pnl: number; percent: number }> {
    const monthStartValue = await getMonthStartValue(db);

    if (!monthStartValue) {
        return { pnl: 0, percent: 0 };
    }

    const pnl = currentValue - monthStartValue;
    const percent = (pnl / monthStartValue) * 100;

    return { pnl, percent };
}

export async function calculateWeeklyPnL(
    db: D1Database,
    currentValue: number
): Promise<{ pnl: number; percent: number }> {
    const today = new Date();
    // 7 days ago
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const snapshot = await db.prepare(`
        SELECT total_value FROM portfolio_snapshots 
        WHERE date <= ? 
        ORDER BY date DESC 
        LIMIT 1
    `).bind(weekAgo).first();

    const weekStartValue = snapshot?.total_value as number || currentValue;

    // If no past data, PnL is 0
    if (!weekStartValue || weekStartValue === 0) {
        return { pnl: 0, percent: 0 };
    }

    const pnl = currentValue - weekStartValue;
    const percent = (pnl / weekStartValue) * 100;

    return { pnl, percent };
}
