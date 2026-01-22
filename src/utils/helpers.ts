
export function formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

export function formatCurrency(amount: number, currency: 'JPY' | 'USD' = 'JPY'): string {
    if (currency === 'JPY') {
        return `¥${Math.round(amount).toLocaleString()}`;
    } else {
        return `$${amount.toFixed(2).toLocaleString()}`;
    }
}

export function formatPercent(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
}

export function isJapanMarketOpen(): boolean {
    // Simplified logic, check scheduler.ts for usage
    // This helper might just check hours
    const now = new Date();
    // UTC+9
    const jstHour = (now.getUTCHours() + 9) % 24;
    return jstHour >= 9 && jstHour < 15;
}

export function isUSMarketOpen(): boolean {
    const now = new Date();
    const estHour = (now.getUTCHours() - 5 + 24) % 24;
    return estHour >= 9 && estHour < 16;
}
