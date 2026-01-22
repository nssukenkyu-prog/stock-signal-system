// =====================================================
// KV Storage Operations
// =====================================================

import type { Env, SymbolState, ThresholdsConfig, NotificationState } from '../types';

// Default thresholds
const DEFAULT_THRESHOLDS: ThresholdsConfig = {
    l1MinProbability: 0.6,
    l2MinProbability: 0.6,
    l3MinSharpe: 0.5,
    cooldownHours: 24,
    hysteresisBuffer: 0.05,
};

// =====================================================
// Symbol State
// =====================================================

export async function getSymbolState(kv: KVNamespace, symbolId: string): Promise<SymbolState | null> {
    const key = `state:${symbolId}`;
    const data = await kv.get(key);
    return data ? JSON.parse(data) : null;
}

export async function setSymbolState(kv: KVNamespace, symbolId: string, state: SymbolState): Promise<void> {
    const key = `state:${symbolId}`;
    await kv.put(key, JSON.stringify(state));
}

// =====================================================
// Notification State
// =====================================================

export async function getNotificationState(kv: KVNamespace, symbolId: string): Promise<NotificationState | null> {
    const key = `notify:state:${symbolId}`;
    const data = await kv.get(key);
    return data ? JSON.parse(data) : null;
}

export async function setNotificationState(
    kv: KVNamespace,
    symbolId: string,
    state: NotificationState
): Promise<void> {
    const key = `notify:state:${symbolId}`;
    await kv.put(key, JSON.stringify(state));
}

// Check if symbol is in cooldown
export async function isInCooldown(kv: KVNamespace, symbolId: string): Promise<boolean> {
    const key = `notify:cooldown:${symbolId}`;
    const data = await kv.get(key);
    return data !== null;
}

// Set cooldown with TTL
export async function setCooldown(kv: KVNamespace, symbolId: string, hours: number): Promise<void> {
    const key = `notify:cooldown:${symbolId}`;
    const ttlSeconds = hours * 3600;
    await kv.put(key, new Date().toISOString(), { expirationTtl: ttlSeconds });
}

// =====================================================
// Thresholds Config
// =====================================================

export async function getThresholds(kv: KVNamespace): Promise<ThresholdsConfig> {
    const key = 'config:thresholds';
    const data = await kv.get(key);
    return data ? { ...DEFAULT_THRESHOLDS, ...JSON.parse(data) } : DEFAULT_THRESHOLDS;
}

export async function setThresholds(kv: KVNamespace, config: Partial<ThresholdsConfig>): Promise<void> {
    const key = 'config:thresholds';
    const current = await getThresholds(kv);
    await kv.put(key, JSON.stringify({ ...current, ...config }));
}

// =====================================================
// Daily Notification Counter
// =====================================================

export async function getDailyNotifyCount(kv: KVNamespace): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    const key = `notify:count:${today}`;
    const count = await kv.get(key);
    return count ? parseInt(count, 10) : 0;
}

export async function incrementDailyNotifyCount(kv: KVNamespace): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    const key = `notify:count:${today}`;
    const current = await getDailyNotifyCount(kv);
    const newCount = current + 1;
    // TTL of 48 hours for cleanup
    await kv.put(key, newCount.toString(), { expirationTtl: 172800 });
    return newCount;
}

// =====================================================
// Previous Signal (for hysteresis)
// =====================================================

export async function getPreviousSignal(kv: KVNamespace, symbolId: string): Promise<string | null> {
    const key = `signal:prev:${symbolId}`;
    return kv.get(key);
}

export async function setPreviousSignal(
    kv: KVNamespace,
    symbolId: string,
    signal: string
): Promise<void> {
    const key = `signal:prev:${symbolId}`;
    await kv.put(key, signal, { expirationTtl: 604800 }); // 7 days
}

// =====================================================
// Emergency Stop Flag
// =====================================================

export async function isEmergencyStop(kv: KVNamespace): Promise<boolean> {
    const key = 'system:emergency_stop';
    const value = await kv.get(key);
    return value === 'true';
}

export async function setEmergencyStop(kv: KVNamespace, stop: boolean): Promise<void> {
    const key = 'system:emergency_stop';
    if (stop) {
        await kv.put(key, 'true');
    } else {
        await kv.delete(key);
    }
}
