
export interface Env {
    DB: D1Database;
    STATE: KVNamespace;
    LINE_CHANNEL_ACCESS_TOKEN: string;
    LINE_USER_ID: string;
    ENVIRONMENT: string;
    COOLDOWN_HOURS: string;
    MAX_NOTIFICATIONS_PER_DAY: string;
}

export interface Symbol {
    id: string;
    name: string;
    market: 'JP' | 'US';
    sector?: string;
    isEtf: boolean;
    isActive: boolean;
}

export interface Holding {
    symbolId: string;
    name: string;
    accountType: string;
    quantity: number;
    avgCost: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPnL: number;
    currency: 'JPY' | 'USD';
}

export interface OHLCV {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    adjClose?: number;
}

export interface SignalResult {
    symbolId: string;
    symbolName: string;
    action: 'BUY' | 'SELL' | 'HOLD' | 'WATCH';
    confidence: number;
    horizon: string;
    reasons: string[];
    warnings: string[];
    l1?: any;
    l2?: any;
    l3?: any;
    l4?: any;
}

export type SignalAction = SignalResult['action'];

export interface SymbolState {
    symbolId: string;
    lastPrice: number;
    lastUpdated: string;
    lastSignal: SignalResult | null;
    indicators?: any;
}

export interface NotificationState {
    lastNotified: string;
    count: number;
}

export interface ThresholdsConfig {
    l1MinProbability: number;
    l2MinProbability: number;
    l3MinSharpe: number;
    cooldownHours: number;
    hysteresisBuffer: number;
}

export interface MarketEvent {
    id: string;
    symbolId?: string;
    type: string;
    date: string;
    description: string;
    importance: 1 | 2 | 3;
}
