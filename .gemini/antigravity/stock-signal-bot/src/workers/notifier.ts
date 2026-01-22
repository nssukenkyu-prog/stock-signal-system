// =====================================================
// Notifier Worker - LINE Notifications
// =====================================================

import type { Env, SignalResult } from '../types';
import { sendPushMessage, formatSignalMessage, formatDailySummary, formatSystemAlert } from '../utils/line';
import { insertNotificationLog, getAllHoldings, calculateMonthlyPnL, savePortfolioSnapshot } from '../storage/d1';
import {
    isInCooldown,
    setCooldown,
    getDailyNotifyCount,
    incrementDailyNotifyCount,
    isEmergencyStop,
    setEmergencyStop,
    getThresholds
} from '../storage/kv';
import type { SignalGenerationResult } from './signal';

const MAX_NOTIFICATIONS_PER_DAY = 50;

// =====================================================
// Send Signal Notifications
// =====================================================

export async function sendSignalNotifications(
    env: Env,
    results: SignalGenerationResult[]
): Promise<void> {
    console.log('[Notifier] Processing signal notifications...');

    // Check emergency stop
    if (await isEmergencyStop(env.STATE)) {
        console.log('[Notifier] Emergency stop is active, skipping notifications');
        return;
    }

    // Check daily limit
    const dailyCount = await getDailyNotifyCount(env.STATE);
    if (dailyCount >= MAX_NOTIFICATIONS_PER_DAY) {
        console.log(`[Notifier] Daily limit reached (${dailyCount}/${MAX_NOTIFICATIONS_PER_DAY})`);
        await setEmergencyStop(env.STATE, true);

        // Send alert about limit being reached
        await sendAlert(env, 'Daily Limit Reached',
            `通知数が上限(${MAX_NOTIFICATIONS_PER_DAY})に達したため、自動通知を停止しました。`);
        return;
    }

    const thresholds = await getThresholds(env.STATE);
    const cooldownHours = parseInt(env.COOLDOWN_HOURS) || thresholds.cooldownHours;

    // Filter signals that should be notified
    const toNotify = results.filter(r => r.shouldNotify);

    for (const result of toNotify) {
        const { signal } = result;

        // Check cooldown
        if (await isInCooldown(env.STATE, signal.symbolId)) {
            console.log(`[Notifier] Skipping ${signal.symbolId}, in cooldown`);
            continue;
        }

        // Check remaining daily quota
        const currentCount = await getDailyNotifyCount(env.STATE);
        if (currentCount >= MAX_NOTIFICATIONS_PER_DAY) {
            break;
        }

        try {
            // Format and send message
            const message = formatSignalMessage(signal);
            const response = await sendPushMessage(
                env.LINE_CHANNEL_ACCESS_TOKEN,
                env.LINE_USER_ID,
                message
            );

            // Log notification
            await insertNotificationLog(
                env.DB,
                signal.symbolId,
                signal.action,
                message,
                response.success,
                response.error
            );

            if (response.success) {
                // Set cooldown
                await setCooldown(env.STATE, signal.symbolId, cooldownHours);
                await incrementDailyNotifyCount(env.STATE);
                console.log(`[Notifier] Sent ${signal.action} notification for ${signal.symbolId}`);
            } else {
                console.error(`[Notifier] Failed to send for ${signal.symbolId}:`, response.error);
            }
        } catch (error) {
            console.error(`[Notifier] Error sending notification for ${signal.symbolId}:`, error);
        }
    }

    console.log('[Notifier] Notification processing complete');
}

// =====================================================
// Send Daily Summary
// =====================================================

export async function sendDailySummary(
    env: Env,
    market: 'JP' | 'US',
    signals: SignalResult[]
): Promise<void> {
    console.log(`[Notifier] Sending ${market} daily summary...`);

    // Check emergency stop
    if (await isEmergencyStop(env.STATE)) {
        console.log('[Notifier] Emergency stop is active, skipping summary');
        return;
    }

    try {
        // Get portfolio value and calculate PnL
        const holdings = await getAllHoldings(env.DB);
        const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
        const dailyPnL = holdings.reduce((sum, h) => sum + h.unrealizedPnL, 0);
        const dailyPnLPercent = totalValue > 0 ? (dailyPnL / totalValue) * 100 : 0;

        // Calculate monthly PnL
        const monthlyData = await calculateMonthlyPnL(env.DB, totalValue);

        // Save today's snapshot for future reference
        await savePortfolioSnapshot(env.DB, totalValue, dailyPnL);

        // Filter signals for this market
        const marketSignals = signals.filter(s => {
            const isJP = s.symbolId.includes('.T') || /^\d{4}$/.test(s.symbolId);
            return market === 'JP' ? isJP : !isJP;
        });

        // Format and send with new format
        const message = formatDailySummary({
            market,
            signals: marketSignals,
            totalValue,
            dailyPnL,
            dailyPnLPercent,
            monthlyPnL: monthlyData.pnl,
            monthlyPnLPercent: monthlyData.percent,
        });

        const response = await sendPushMessage(
            env.LINE_CHANNEL_ACCESS_TOKEN,
            env.LINE_USER_ID,
            message
        );

        await insertNotificationLog(
            env.DB,
            null,
            null,
            message,
            response.success,
            response.error
        );

        if (response.success) {
            await incrementDailyNotifyCount(env.STATE);
            console.log('[Notifier] Daily summary sent');
        } else {
            console.error('[Notifier] Failed to send daily summary:', response.error);
        }
    } catch (error) {
        console.error('[Notifier] Error sending daily summary:', error);
    }
}

// =====================================================
// Send System Alert
// =====================================================

export async function sendAlert(
    env: Env,
    title: string,
    details: string
): Promise<void> {
    try {
        const message = formatSystemAlert(title, details);

        const response = await sendPushMessage(
            env.LINE_CHANNEL_ACCESS_TOKEN,
            env.LINE_USER_ID,
            message
        );

        await insertNotificationLog(
            env.DB,
            null,
            'ALERT',
            message,
            response.success,
            response.error
        );

        console.log('[Notifier] Alert sent:', response.success ? 'success' : response.error);
    } catch (error) {
        console.error('[Notifier] Error sending alert:', error);
    }
}

// =====================================================
// Send Test Notification
// =====================================================

export async function sendTestNotification(env: Env): Promise<boolean> {
    const message = `🧪 テスト通知

システムからの通知テストです。
日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}

このメッセージが届いていれば、LINEへの通知は正常に機能しています。`;

    const response = await sendPushMessage(
        env.LINE_CHANNEL_ACCESS_TOKEN,
        env.LINE_USER_ID,
        message
    );

    await insertNotificationLog(
        env.DB,
        null,
        'TEST',
        message,
        response.success,
        response.error
    );

    return response.success;
}
