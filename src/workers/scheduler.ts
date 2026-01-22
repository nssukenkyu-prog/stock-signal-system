
// =====================================================
// Scheduler - Cron Job Handler
// =====================================================

import type { Env } from '../types';
import { fetchAllPrices, initializeHistoricalData, fetchMutualFunds } from './fetcher';
import { generateAllSignals } from './signal';
import { sendSignalNotifications, sendDailySummary, sendWeeklySummary, sendAlert } from './notifier';
import { isJapanMarketOpen, isUSMarketOpen } from '../utils/helpers';
import { isEmergencyStop, setEmergencyStop } from '../storage/kv';
import { cleanupIntradayPrices } from '../storage/d1';

export async function handleCronTrigger(
    event: any,
    env: Env,
    ctx: ExecutionContext
): Promise<void> {
    console.log(`[Scheduler] Cron triggered: ${new Date().toISOString()}`);

    if (await isEmergencyStop(env.STATE)) {
        console.log('[Scheduler] System is in EMERGENCY STOP mode. Skipping.');
        return;
    }

    // Cron string parsing (Simplified):
    // In real worker, we usually check the time unless we have named triggers or multiple workers.
    // Wrangler trigger: "*/5 0-6 ..."

    // We can infer job type by current time
    const now = new Date();
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();
    const day = now.getUTCDay(); // 0=Sun, 6=Sat

    // Weekly Summary: Sat 10:00 UTC (19:00 JST)
    if (day === 6 && hour === 10 && minute === 0) {
        await sendWeeklySummary(env);
        return;
    }

    // Mutual Fund Daily: Mon-Fri 13:00 UTC (22:00 JST)
    if (hour === 13 && minute === 0) {
        await fetchMutualFunds(env);
        return;
    }

    // Daily Market Summaries ?
    // JP Close: 07:00 UTC (16:00 JST)
    if (hour === 7 && minute === 0) {
        await sendDailySummary(env, 'JP', []);
        return;
    }
    // US Close: 22:00 UTC (07:00 JST)
    if (hour === 22 && minute === 0) {
        await sendDailySummary(env, 'US', []);
        return;
    }

    // Regular Monitoring (every 5 mins)
    // Check if markets open
    if (isJapanMarketOpen() || isUSMarketOpen()) {
        await runMonitoringJob(env);
    }
}

export async function runMonitoringJob(env: Env): Promise<void> {
    await fetchAllPrices(env);
    const results = await generateAllSignals(env);
    await sendSignalNotifications(env, results);
}

export async function runInitializationJob(env: Env): Promise<void> {
    await initializeHistoricalData(env);
}

export async function resetEmergencyStop(env: Env): Promise<void> {
    await setEmergencyStop(env.STATE, false);
}

export async function runDailySummaryJob(env: Env, market: 'JP' | 'US'): Promise<void> {
    const results = await generateAllSignals(env); // Or just get cached signals
    await sendDailySummary(env, market, results.map(r => r.signal));
}
