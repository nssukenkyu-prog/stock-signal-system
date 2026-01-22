
// =====================================================
// LINE Messaging API Client
// =====================================================

import type { Env, SignalResult, SignalAction } from '../types';
import { formatPercent, formatCurrency } from './helpers';

const LINE_API_BASE = 'https://api.line.me/v2/bot';

interface LineMessageResponse {
    success: boolean;
    error?: string;
}

// =====================================================
// Send Push Message
// =====================================================

export async function sendPushMessage(
    token: string,
    userId: string,
    message: string
): Promise<LineMessageResponse> {
    try {
        const response = await fetch(`${LINE_API_BASE}/message/push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                to: userId,
                messages: [
                    {
                        type: 'text',
                        text: message,
                    },
                ],
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            return { success: false, error: `LINE API error: ${response.status} - ${error}` };
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: `Network error: ${(error as Error).message}` };
    }
}

// =====================================================
// Format Signal Message
// =====================================================

export function formatSignalMessage(signal: SignalResult): string {
    const emoji = getActionEmoji(signal.action);
    const actionText = getActionText(signal.action);

    let message = `${emoji} ${actionText}: ${signal.symbolName}(${signal.symbolId})\n\n`;
    message += `確率: ${Math.round(signal.confidence * 100)}% | 期間: ${signal.horizon}\n`;
    message += `━━━━━━━━━━━━━━\n`;

    // Reasons
    message += `【根拠】\n`;
    signal.reasons.slice(0, 4).forEach(reason => {
        message += `• ${reason}\n`;
    });

    // Warnings
    if (signal.warnings.length > 0) {
        message += `\n⚠️ 注意\n`;
        signal.warnings.slice(0, 2).forEach(warning => {
            message += `• ${warning}\n`;
        });
    }

    return message.trim();
}

// =====================================================
// Format Daily Summary Message
// =====================================================

export interface DailySummaryData {
    market: 'JP' | 'US';
    signals: SignalResult[];
    totalValue: number;      // Total portfolio value in JPY
    dailyPnL: number;        // Today's profit/loss in JPY
    dailyPnLPercent: number; // Today's profit/loss in %
    monthlyPnL: number;      // Month-to-date profit/loss in JPY
    monthlyPnLPercent: number; // Month-to-date profit/loss in %
}

export function formatDailySummary(data: DailySummaryData): string {
    const { market, signals, totalValue, dailyPnL, dailyPnLPercent, monthlyPnL, monthlyPnLPercent } = data;

    const marketName = market === 'JP' ? '日本市場' : '米国市場';
    const date = new Date().toLocaleDateString('ja-JP');
    const monthStr = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });

    let message = `📊 ${marketName} 日次サマリー\n`;
    message += `${date}\n`;
    message += `━━━━━━━━━━━━━━\n\n`;

    // Portfolio summary
    message += `💰 ポートフォリオ\n`;
    message += `評価額: ${formatCurrency(totalValue, 'JPY')}\n\n`;

    // Today's PnL
    const dailyEmoji = dailyPnL >= 0 ? '📈' : '📉';
    const dailySign = dailyPnL >= 0 ? '+' : '';
    message += `${dailyEmoji} 本日の損益\n`;
    message += `${dailySign}${formatCurrency(dailyPnL, 'JPY')} (${dailySign}${dailyPnLPercent.toFixed(2)}%)\n\n`;

    // Monthly PnL
    const monthlyEmoji = monthlyPnL >= 0 ? '📊' : '📉';
    const monthlySign = monthlyPnL >= 0 ? '+' : '';
    message += `${monthlyEmoji} ${monthStr}の損益\n`;
    message += `${monthlySign}${formatCurrency(monthlyPnL, 'JPY')} (${monthlySign}${monthlyPnLPercent.toFixed(2)}%)\n\n`;

    // Group by action
    const buySignals = signals.filter(s => s.action === 'BUY');
    const sellSignals = signals.filter(s => s.action === 'SELL');
    const watchSignals = signals.filter(s => s.action === 'WATCH');

    if (buySignals.length > 0) {
        message += `📈 BUY候補 (${buySignals.length}件)\n`;
        buySignals.slice(0, 3).forEach(s => {
            message += `• ${s.symbolName}: ${Math.round(s.confidence * 100)}%\n`;
        });
        message += `\n`;
    }

    if (sellSignals.length > 0) {
        message += `📉 SELL候補 (${sellSignals.length}件)\n`;
        sellSignals.slice(0, 3).forEach(s => {
            message += `• ${s.symbolName}: ${Math.round(s.confidence * 100)}%\n`;
        });
        message += `\n`;
    }

    if (watchSignals.length > 0) {
        message += `👀 WATCH (${watchSignals.length}件)\n`;
        watchSignals.slice(0, 3).forEach(s => {
            message += `• ${s.symbolName}\n`;
        });
    }

    return message.trim();
}

export interface WeeklySummaryData {
    totalValue: number;
    weeklyPnL: number;
    weeklyPnLPercent: number;
    monthlyPnL: number;
    monthlyPnLPercent: number;
    bestPerformer: { name: string; percent: number } | null;
    worstPerformer: { name: string; percent: number } | null;
}

export function formatWeeklySummary(data: WeeklySummaryData): string {
    const { totalValue, weeklyPnL, weeklyPnLPercent, monthlyPnL, monthlyPnLPercent, bestPerformer, worstPerformer } = data;
    const date = new Date().toLocaleDateString('ja-JP');

    let message = `📅 週間レポート (${date})\n`;
    message += `━━━━━━━━━━━━━━\n\n`;

    // Portfolio
    message += `💰 総資産\n`;
    message += `${formatCurrency(totalValue, 'JPY')}\n\n`;

    // Weekly PnL
    const weekEmoji = weeklyPnL >= 0 ? '📈' : '📉';
    const weekSign = weeklyPnL >= 0 ? '+' : '';
    message += `${weekEmoji} 週間損益\n`;
    message += `${weekSign}${formatCurrency(weeklyPnL, 'JPY')} (${weekSign}${weeklyPnLPercent.toFixed(2)}%)\n\n`;

    // Monthly PnL
    const monthEmoji = monthlyPnL >= 0 ? '📊' : '📉';
    const monthSign = monthlyPnL >= 0 ? '+' : '';
    message += `${monthEmoji} 月間損益\n`;
    message += `${monthSign}${formatCurrency(monthlyPnL, 'JPY')} (${monthSign}${monthlyPnLPercent.toFixed(2)}%)\n\n`;

    // Performers
    if (bestPerformer || worstPerformer) {
        message += `🏆 週間MVP\n`;
        if (bestPerformer) {
            message += `TOP: ${bestPerformer.name} (+${bestPerformer.percent.toFixed(2)}%)\n`;
        }
        if (worstPerformer) {
            message += `WORST: ${worstPerformer.name} (${worstPerformer.percent.toFixed(2)}%)\n`;
        }
    }

    return message.trim();
}


// =====================================================
// Format System Alert
// =====================================================

export function formatSystemAlert(title: string, details: string): string {
    return `🚨 システムアラート\n\n${title}\n\n${details}`;
}

// =====================================================
// Helper Functions
// =====================================================

function getActionEmoji(action: SignalAction): string {
    switch (action) {
        case 'BUY': return '📈';
        case 'SELL': return '📉';
        case 'HOLD': return '📊';
        case 'WATCH': return '👀';
    }
}

function getActionText(action: SignalAction): string {
    switch (action) {
        case 'BUY': return 'BUY推奨';
        case 'SELL': return 'SELL推奨';
        case 'HOLD': return '継続保有';
        case 'WATCH': return '要注目';
    }
}
