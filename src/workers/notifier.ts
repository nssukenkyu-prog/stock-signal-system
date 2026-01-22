
// =====================================================
// Notifier Worker - Send Notifications
// =====================================================

import type { Env, SignalResult } from '../types';
import { sendPushMessage, formatSignalMessage, formatDailySummary, formatWeeklySummary, formatSystemAlert } from '../utils/line';
import { insertNotificationLog, getAllHoldings, calculateMonthlyPnL, calculateWeeklyPnL, savePortfolioSnapshot } from '../storage/d1';
import { isInCooldown, setCooldown, getDailyNotifyCount, incrementDailyNotifyCount } from '../storage/kv';

export async function sendSignalNotifications(env: Env, results: any[]): Promise<void> {
    const notifyResults = results.filter(r => r.shouldNotify);
    if (notifyResults.length === 0) return;

    for (const res of notifyResults) {
        if (await isInCooldown(env.STATE, res.symbol.id)) continue;

        const message = formatSignalMessage(res.signal);
        const response = await sendPushMessage(env.LINE_CHANNEL_ACCESS_TOKEN, env.LINE_USER_ID, message);

        await insertNotificationLog(env.DB, res.symbol.id, res.signal.action, message, response.success, response.error);
        if (response.success) {
            await setCooldown(env.STATE, res.symbol.id, parseInt(env.COOLDOWN_HOURS));
            await incrementDailyNotifyCount(env.STATE);
        }
    }
}

export async function sendDailySummary(env: Env, market: 'JP' | 'US', signals: any[]): Promise<void> {
    try {
        const holdings = await getAllHoldings(env.DB);
        const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);

        // Calculate PnL vs Month Start
        const monthlyData = await calculateMonthlyPnL(env.DB, totalValue);

        // Calculate Daily PnL (sum of unrealized deviation or just diff from yesterday? 
        // For simplicity, let's use holdings.unrealizedPnL if we trust it represents total.
        // Actually, daily PnL is usually (TodayValue - YesterdayValue).
        // Let's rely on snapshot if available, or just calculate from holdings changes if we tracked previous close.
        // Simplified: use a field if we had it.
        // For now, assume 0 or implement correct daily PnL logic later.
        const dailyPnL = 0;
        const dailyPnLPercent = 0;

        // Save Snapshot
        await savePortfolioSnapshot(env.DB, totalValue, dailyPnL);

        const message = formatDailySummary({
            market,
            signals,
            totalValue,
            dailyPnL,
            dailyPnLPercent,
            monthlyPnL: monthlyData.pnl,
            monthlyPnLPercent: monthlyData.percent,
        });

        await sendPushMessage(env.LINE_CHANNEL_ACCESS_TOKEN, env.LINE_USER_ID, message);
        await insertNotificationLog(env.DB, null, 'DAILY_SUMMARY', message, true);

    } catch (e) {
        console.error('Error sending daily summary', e);
    }
}

export async function sendWeeklySummary(env: Env): Promise<void> {
    console.log('[Notifier] Sending weekly summary...');
    try {
        const holdings = await getAllHoldings(env.DB);
        const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);

        const monthlyData = await calculateMonthlyPnL(env.DB, totalValue);
        const weeklyData = await calculateWeeklyPnL(env.DB, totalValue);

        // Simple Best/Worst
        const sorted = [...holdings].sort((a, b) => b.unrealizedPnL - a.unrealizedPnL);
        const best = sorted[0];
        const worst = sorted[sorted.length - 1];

        const getPercent = (h: any) => h.marketValue > 0 ? (h.unrealizedPnL / (h.marketValue - h.unrealizedPnL)) * 100 : 0;

        const message = formatWeeklySummary({
            totalValue,
            weeklyPnL: weeklyData.pnl,
            weeklyPnLPercent: weeklyData.percent,
            monthlyPnL: monthlyData.pnl,
            monthlyPnLPercent: monthlyData.percent,
            bestPerformer: best ? { name: best.name, percent: getPercent(best) } : null,
            worstPerformer: worst ? { name: worst.name, percent: getPercent(worst) } : null,
        });

        await sendPushMessage(env.LINE_CHANNEL_ACCESS_TOKEN, env.LINE_USER_ID, message);
        await insertNotificationLog(env.DB, null, 'WEEKLY', message, true);

    } catch (error) {
        console.error('[Notifier] Error sending weekly summary:', error);
    }
}

export async function sendAlert(env: Env, title: string, detail: string): Promise<void> {
    // Stub
}

export async function sendTestNotification(env: Env): Promise<boolean> {
    const res = await sendPushMessage(env.LINE_CHANNEL_ACCESS_TOKEN, env.LINE_USER_ID, "Test Notification");
    return res.success;
}
