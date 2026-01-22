// =====================================================
// Utility Functions
// =====================================================

// Generate unique ID
export function generateId(prefix: string = ''): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

// Format date as YYYY-MM-DD
export function formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

// Format date as Japanese
export function formatDateJP(date: Date): string {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

// Get JST date
export function getJSTDate(): Date {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return jst;
}

// Check if Japanese market is open
export function isJapanMarketOpen(): boolean {
    const jst = getJSTDate();
    const hour = jst.getUTCHours();
    const day = jst.getUTCDay();
    // Monday-Friday, 9:00-15:00 JST
    return day >= 1 && day <= 5 && hour >= 0 && hour < 6; // UTC 0-6 = JST 9-15
}

// Check if US market is open
export function isUSMarketOpen(): boolean {
    const now = new Date();
    const estOffset = -5; // EST (ignore DST for simplicity)
    const est = new Date(now.getTime() + estOffset * 60 * 60 * 1000);
    const hour = est.getUTCHours();
    const day = est.getUTCDay();
    // Monday-Friday, 9:30-16:00 EST
    return day >= 1 && day <= 5 && ((hour >= 14 && hour < 21) || (hour === 14 && est.getUTCMinutes() >= 30));
}

// Calculate percentage change
export function pctChange(current: number, previous: number): number {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
}

// Round to decimal places
export function round(value: number, decimals: number = 2): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}

// Clamp value between min and max
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

// Average of array
export function average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// Standard deviation
export function stdDev(arr: number[]): number {
    const avg = average(arr);
    const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
    return Math.sqrt(average(squareDiffs));
}

// Retry wrapper for API calls
export async function retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 1000
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
            }
        }
    }

    throw lastError;
}

// Safe JSON parse
export function safeJsonParse<T>(json: string, defaultValue: T): T {
    try {
        return JSON.parse(json) as T;
    } catch {
        return defaultValue;
    }
}

// Truncate string for notifications
export function truncate(str: string, maxLength: number = 100): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
}

// Format currency
export function formatCurrency(amount: number, currency: 'JPY' | 'USD' = 'JPY'): string {
    if (currency === 'JPY') {
        return `¥${Math.round(amount).toLocaleString()}`;
    }
    return `$${amount.toFixed(2)}`;
}

// Format percentage
export function formatPercent(value: number, decimals: number = 1): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(decimals)}%`;
}
