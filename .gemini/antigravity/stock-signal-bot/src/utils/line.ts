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
// Format Signal Message (User-Friendly Japanese)
// =====================================================

export function formatSignalMessage(signal: SignalResult): string {
    const emoji = getActionEmoji(signal.action);
    const actionText = getActionTextSimple(signal.action);

    // Calculate target price and stop-loss from L1/L2 data
    const currentPrice = signal.l1?.basePrice || 0;
    const targetPercent = signal.l1?.targetPct || 10;
    const stopLossPercent = signal.l2?.targetPct || 8;

    const targetPrice = currentPrice * (1 + targetPercent / 100);
    const stopLossPrice = currentPrice * (1 - stopLossPercent / 100);

    let message = `${emoji} ${signal.symbolName}\n`;
    message += `━━━━━━━━━━━━━━\n\n`;

    // Simple conclusion
    message += `📋 結論\n`;
    message += `${getSimpleConclusion(signal)}\n\n`;

    // Target prices (for BUY/SELL)
    if (signal.action === 'BUY' || signal.action === 'SELL') {
        if (currentPrice > 0) {
            const currency = signal.symbolId.includes('.T') || /^\d{4}$/.test(signal.symbolId) ? '¥' : '$';
            const priceFormat = (p: number) => currency === '¥' ?
                `${currency}${Math.round(p).toLocaleString()}` :
                `${currency}${p.toFixed(2)}`;

            message += `🎯 目標\n`;
            message += `現在: ${priceFormat(currentPrice)}\n`;
            if (signal.action === 'BUY') {
                message += `目標価格: ${priceFormat(targetPrice)} (+${targetPercent}%)\n`;
                message += `損切りライン: ${priceFormat(stopLossPrice)} (-${stopLossPercent}%)\n\n`;
            } else {
                message += `下落予想: ${priceFormat(stopLossPrice)} (-${stopLossPercent}%)\n\n`;
            }
        }

        // Risk level
        message += `⚠️ リスク\n`;
        message += `${getRiskLevel(signal)}\n\n`;
    }

    // Simple reason (no technical jargon)
    message += `💡 理由\n`;
    message += `${getSimpleReason(signal)}\n`;

    // Confidence
    message += `\n📊 確信度: ${Math.round(signal.confidence * 100)}%`;

    return message.trim();
}

// Get simple action text
function getActionTextSimple(action: SignalAction): string {
    switch (action) {
        case 'BUY': return '買い推奨';
        case 'SELL': return '売り推奨';
        case 'HOLD': return '継続保有';
        case 'WATCH': return '要注目';
    }
}

// Get simple conclusion without technical terms
function getSimpleConclusion(signal: SignalResult): string {
    switch (signal.action) {
        case 'BUY':
            if (signal.confidence >= 0.7) {
                return '今買うと利益が出やすい状況です。上昇の勢いがあります。';
            } else {
                return '買いのチャンスかもしれません。慎重に検討を。';
            }
        case 'SELL':
            if (signal.confidence >= 0.7) {
                return '利益確定または損切りを検討してください。下落リスクが高まっています。';
            } else {
                return '売り時かもしれません。状況を注視してください。';
            }
        case 'WATCH':
            return '今すぐの売買は不要ですが、変化に注目してください。';
        case 'HOLD':
            return '現状維持で問題ありません。';
    }
}

// Get simple reason without technical jargon
function getSimpleReason(signal: SignalResult): string {
    const { l4 } = signal;

    if (signal.action === 'BUY') {
        if (l4?.state === 'UPTREND') {
            return '株価が上昇トレンドにあり、まだ上がる可能性があります。';
        } else if (l4?.signal === 'REVERSAL_UP') {
            return '下落が止まり、反発の兆候が見られます。';
        } else {
            return '価格が割安な水準にあり、上昇余地があります。';
        }
    } else if (signal.action === 'SELL') {
        if (l4?.state === 'DOWNTREND') {
            return '株価が下落トレンドにあり、さらに下がる可能性があります。';
        } else if (l4?.signal === 'REVERSAL_DOWN') {
            return '上昇が止まり、調整の兆候が見られます。';
        } else {
            return '価格が過熱気味で、調整リスクがあります。';
        }
    } else if (signal.action === 'WATCH') {
        return '上昇と下落の両方の可能性があり、様子見が無難です。';
    }

    return '特に大きな変化はありません。';
}

// Get risk level in simple terms
function getRiskLevel(signal: SignalResult): string {
    const l2Probability = signal.l2?.probability || 0.5;

    if (l2Probability < 0.3) {
        return '低リスク - 大きな下落の可能性は低め';
    } else if (l2Probability < 0.5) {
        return '中リスク - 通常の変動範囲';
    } else if (l2Probability < 0.7) {
        return '高リスク - 一時的な下落に注意';
    } else {
        return '⚠️ 要注意 - 大きな変動の可能性';
    }
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

// Legacy format for backwards compatibility
export function formatDailySummaryLegacy(
    market: 'JP' | 'US',
    signals: SignalResult[],
    totalValue: number,
    dailyPnL: number
): string {
    return formatDailySummary({
        market,
        signals,
        totalValue,
        dailyPnL,
        dailyPnLPercent: (dailyPnL / totalValue) * 100,
        monthlyPnL: dailyPnL, // Fallback to daily
        monthlyPnLPercent: (dailyPnL / totalValue) * 100,
    });
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

// =====================================================
// Portfolio Milestone Alerts
// =====================================================

export interface PortfolioMilestoneData {
    currentValue: number;
    previousHigh: number;
    previousLow: number;
    targetProfit: number;       // Monthly target in JPY
    actualProfit: number;       // Current month profit
    lossThreshold: number;      // Alert if loss exceeds this %
    currentLossPercent: number;
}

export function checkPortfolioMilestones(data: PortfolioMilestoneData): string[] {
    const alerts: string[] = [];

    // Check if new all-time high
    if (data.currentValue > data.previousHigh) {
        alerts.push(formatPortfolioAlert('NEW_HIGH', data));
    }

    // Check if monthly target reached
    if (data.actualProfit >= data.targetProfit && data.targetProfit > 0) {
        alerts.push(formatPortfolioAlert('TARGET_REACHED', data));
    }

    // Check if loss threshold breached
    if (data.currentLossPercent < -data.lossThreshold) {
        alerts.push(formatPortfolioAlert('LOSS_WARNING', data));
    }

    return alerts;
}

export function formatPortfolioAlert(
    type: 'NEW_HIGH' | 'TARGET_REACHED' | 'LOSS_WARNING' | 'RECOVERY',
    data: PortfolioMilestoneData
): string {
    const formatValue = (v: number) => `¥${Math.round(v).toLocaleString()}`;

    switch (type) {
        case 'NEW_HIGH':
            return `🎉 過去最高更新！
━━━━━━━━━━━━━━

評価額が過去最高を更新しました！

現在の評価額: ${formatValue(data.currentValue)}
前回の最高値: ${formatValue(data.previousHigh)}

おめでとうございます！`;

        case 'TARGET_REACHED':
            return `🎯 月間目標達成！
━━━━━━━━━━━━━━

今月の目標利益に達しました！

目標: ${formatValue(data.targetProfit)}
達成: ${formatValue(data.actualProfit)}

利益確定を検討しても良いタイミングです。`;

        case 'LOSS_WARNING':
            return `⚠️ 損失アラート
━━━━━━━━━━━━━━

ポートフォリオの損失が拡大しています。

現在の損失: ${data.currentLossPercent.toFixed(1)}%
警戒ライン: -${data.lossThreshold}%

冷静に状況を判断してください。`;

        case 'RECOVERY':
            return `📈 回復のお知らせ
━━━━━━━━━━━━━━

ポートフォリオが回復傾向にあります。

現在の評価額: ${formatValue(data.currentValue)}`;
    }
}

// =====================================================
// Weekly Report
// =====================================================

export interface WeeklyReportData {
    weekStart: string;          // YYYY-MM-DD
    weekEnd: string;
    startValue: number;
    endValue: number;
    weeklyPnL: number;
    weeklyPnLPercent: number;
    monthlyPnL: number;
    monthlyPnLPercent: number;
    bestPerformer?: { name: string; change: number };
    worstPerformer?: { name: string; change: number };
    buySignalsCount: number;
    sellSignalsCount: number;
    upcomingEvents: string[];
}

export function formatWeeklyReport(data: WeeklyReportData): string {
    const formatValue = (v: number) => `¥${Math.round(v).toLocaleString()}`;
    const sign = (v: number) => v >= 0 ? '+' : '';

    let message = `📅 週次レポート\n`;
    message += `${data.weekStart} 〜 ${data.weekEnd}\n`;
    message += `━━━━━━━━━━━━━━\n\n`;

    // Weekly performance
    const weekEmoji = data.weeklyPnL >= 0 ? '📈' : '📉';
    message += `${weekEmoji} 今週の成績\n`;
    message += `評価額: ${formatValue(data.endValue)}\n`;
    message += `週間損益: ${sign(data.weeklyPnL)}${formatValue(data.weeklyPnL)} (${sign(data.weeklyPnLPercent)}${data.weeklyPnLPercent.toFixed(2)}%)\n\n`;

    // Monthly cumulative
    const monthEmoji = data.monthlyPnL >= 0 ? '✨' : '💭';
    message += `${monthEmoji} 今月の累計\n`;
    message += `${sign(data.monthlyPnL)}${formatValue(data.monthlyPnL)} (${sign(data.monthlyPnLPercent)}${data.monthlyPnLPercent.toFixed(2)}%)\n\n`;

    // Best/Worst performers
    if (data.bestPerformer) {
        message += `🏆 今週のベスト\n`;
        message += `${data.bestPerformer.name}: ${sign(data.bestPerformer.change)}${data.bestPerformer.change.toFixed(1)}%\n\n`;
    }

    if (data.worstPerformer) {
        message += `📉 今週のワースト\n`;
        message += `${data.worstPerformer.name}: ${data.worstPerformer.change.toFixed(1)}%\n\n`;
    }

    // Signal summary
    message += `📊 シグナル統計\n`;
    message += `BUY推奨: ${data.buySignalsCount}件\n`;
    message += `SELL推奨: ${data.sellSignalsCount}件\n\n`;

    // Upcoming events
    if (data.upcomingEvents.length > 0) {
        message += `📆 来週の注目イベント\n`;
        data.upcomingEvents.slice(0, 3).forEach(event => {
            message += `• ${event}\n`;
        });
    }

    return message.trim();
}
