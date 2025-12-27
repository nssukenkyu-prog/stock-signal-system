// =====================================================
// Scheduler Worker - Cron Job Handler
// =====================================================

import type { Env } from '../types';
import { fetchAllPrices, initializeHistoricalData } from './fetcher';
import { generateAllSignals, generateHoldingsSignals } from './signal';
import { sendSignalNotifications, sendDailySummary, sendAlert } from './notifier';
import { isJapanMarketOpen, isUSMarketOpen } from '../utils/helpers';
import { isEmergencyStop, setEmergencyStop } from '../storage/kv';
import { cleanupIntradayPrices } from '../storage/d1';

// =====================================================
// Cron Trigger Handler
// =====================================================

export async function handleCronTrigger(
    trigger: string,
    env: Env,
    ctx: ExecutionContext
): Promise<void> {
    console.log(`[Scheduler] Cron trigger: ${trigger} at ${new Date().toISOString()}`);

    try {
        // Parse cron expression to determine job type
        const hour = new Date().getUTCHours();
        const minute = new Date().getUTCMinutes();

        // Daily summary times (UTC)
        // 7:00 UTC = 16:00 JST (Japan market close)
        // 22:00 UTC = 7:00 JST next day (US market close summary)

        if (hour === 7 && minute === 0) {
            // Japan market daily summary
            await runDailySummaryJob(env, 'JP');
        } else if (hour === 22 && minute === 0) {
            // US market daily summary
            await runDailySummaryJob(env, 'US');
        } else {
            // Regular price monitoring
            await runMonitoringJob(env);
        }
    } catch (error) {
        console.error('[Scheduler] Job failed:', error);

        // Send alert but don't throw
        try {
            await sendAlert(env, 'ジョブ実行エラー',
                `エラー: ${(error as Error).message}\n時刻: ${new Date().toISOString()}`);
        } catch (alertError) {
            console.error('[Scheduler] Failed to send error alert:', alertError);
        }
    }
}

// =====================================================
// Monitoring Job (Every 5 minutes during market hours)
// =====================================================

async function runMonitoringJob(env: Env): Promise<void> {
    console.log('[Scheduler] Running monitoring job...');

    // Check if any market is open
    const jpOpen = isJapanMarketOpen();
    const usOpen = isUSMarketOpen();

    if (!jpOpen && !usOpen) {
        console.log('[Scheduler] No market open, skipping monitoring');
        return;
    }

    // Check emergency stop
    if (await isEmergencyStop(env.STATE)) {
        console.log('[Scheduler] Emergency stop active, skipping');
        return;
    }

    // Fetch latest prices
    await fetchAllPrices(env);

    // Generate signals
    const results = await generateAllSignals(env);

    // Send notifications for actionable signals
    const actionable = results.filter(r =>
        r.shouldNotify && (r.signal.action === 'BUY' || r.signal.action === 'SELL')
    );

    if (actionable.length > 0) {
        await sendSignalNotifications(env, actionable);
    }

    console.log('[Scheduler] Monitoring job complete');
}

// =====================================================
// Daily Summary Job
// =====================================================

async function runDailySummaryJob(env: Env, market: 'JP' | 'US'): Promise<void> {
    console.log(`[Scheduler] Running ${market} daily summary job...`);

    // Fetch final prices
    await fetchAllPrices(env);

    // Generate signals for all holdings
    const results = await generateHoldingsSignals(env);
    const signals = results.map(r => r.signal);

    // Send daily summary
    await sendDailySummary(env, market, signals);

    // Cleanup old intraday data
    await cleanupIntradayPrices(env.DB);

    console.log(`[Scheduler] ${market} daily summary complete`);
}

// =====================================================
// Initial Setup Job (Manual trigger)
// =====================================================

export async function runInitializationJob(env: Env): Promise<void> {
    console.log('[Scheduler] Running initialization job...');

    // Initialize historical data for all symbols
    await initializeHistoricalData(env);

    // Reset emergency stop if set
    await setEmergencyStop(env.STATE, false);

    console.log('[Scheduler] Initialization complete');
}

// =====================================================
// Reset Emergency Stop (Manual)
// =====================================================

export async function resetEmergencyStop(env: Env): Promise<void> {
    await setEmergencyStop(env.STATE, false);
    console.log('[Scheduler] Emergency stop reset');
}
