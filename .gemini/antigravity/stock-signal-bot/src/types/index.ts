// =====================================================
// Type Definitions for Stock Signal Bot
// =====================================================

// Cloudflare Bindings
export interface Env {
    STATE: KVNamespace;
    DB: D1Database;
    LINE_CHANNEL_ACCESS_TOKEN: string;
    LINE_USER_ID: string;
    ENVIRONMENT: string;
    COOLDOWN_HOURS: string;
    MAX_NOTIFICATIONS_PER_DAY: string;
}

// =====================================================
// Market & Symbol Types
// =====================================================

export type Market = 'JP' | 'US';
export type AssetType = 'stock' | 'etf' | 'mutual_fund';
export type AccountType = 'specific' | 'general' | 'nisa_growth' | 'nisa_tsumitate' | 'tsumitate_nisa';

export interface Symbol {
    id: string;           // e.g., "7203.T", "AAPL", "emaxis_slim_sp500"
    name: string;
    market: Market;
    sector?: string;
    isEtf: boolean;
    isActive: boolean;
}

export interface Holding {
    symbolId: string;
    name: string;
    accountType: AccountType;
    quantity: number;
    avgCost: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPnL: number;
    currency: 'JPY' | 'USD';
}

// =====================================================
// Price Data Types
// =====================================================

export interface OHLCV {
    date: string;        // YYYY-MM-DD
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    adjClose?: number;
}

export interface IntradayPrice {
    timestamp: string;   // ISO8601
    price: number;
    volume?: number;
}

// =====================================================
// Technical Indicators
// =====================================================

export interface TechnicalIndicators {
    sma20: number;
    sma60: number;
    sma120: number;
    ema12: number;
    ema26: number;
    rsi14: number;
    macd: number;
    macdSignal: number;
    macdHistogram: number;
    atr20: number;
    adx14: number;
    diPlus: number;
    diMinus: number;
    bollingerUpper: number;
    bollingerLower: number;
    bollingerMiddle: number;
    volumeRatio: number;  // current / 20day avg
}

// =====================================================
// Signal Types (L1-L4)
// =====================================================

export interface L1Signal {
    probability: number;     // 0-1: +X%到達確率
    targetPct: number;       // ボラ基準の目標上昇率
    horizonDays: number;     // 60/120
    factors: {
        momentum: number;
        trend: number;
        breakout: number;
        volume: number;
    };
}

export interface L2Signal {
    probability: number;     // 0-1: -Y%到達確率
    targetPct: number;       // ボラ基準の目標下落率
    horizonDays: number;
    factors: {
        momentum: number;
        trend: number;
        breakdown: number;
        volume: number;
    };
}

export interface L3Signal {
    expectedReturn: number;  // 期待リターン
    sharpeRatio: number;     // リスク調整済み
    isAdvantage: boolean;    // 閾値超過
}

export type TrendState = 'UPTREND' | 'DOWNTREND' | 'RANGE';
export type TrendSignal = 'CONTINUE' | 'REVERSAL_UP' | 'REVERSAL_DOWN';

export interface L4Signal {
    state: TrendState;
    signal: TrendSignal;
    adx: number;
    confidence: number;
}

// =====================================================
// Aggregated Signal Result
// =====================================================

export type SignalAction = 'BUY' | 'SELL' | 'HOLD' | 'WATCH';

export interface SignalResult {
    symbolId: string;
    symbolName: string;
    action: SignalAction;
    confidence: number;        // 0-1
    horizon: string;           // e.g., "60営業日"
    reasons: string[];
    warnings: string[];
    l1: L1Signal;
    l2: L2Signal;
    l3: L3Signal;
    l4: L4Signal;
    timestamp: string;
}

// =====================================================
// Event Types
// =====================================================

export type EventType = 'earnings' | 'economic' | 'dividend' | 'split';

export interface MarketEvent {
    id: string;
    symbolId?: string;
    type: EventType;
    date: string;
    description: string;
    importance: 1 | 2 | 3;   // 1=low, 2=medium, 3=high
}

// =====================================================
// News Scoring
// =====================================================

export interface NewsItem {
    headline: string;
    source: string;
    timestamp: string;
    score: number;           // -1 to 1
    keywords: string[];
}

// =====================================================
// Notification Types
// =====================================================

export interface NotificationState {
    symbolId: string;
    lastNotifiedAt: string;
    lastAction: SignalAction;
    notifyCount24h: number;
}

export interface NotificationLog {
    id: string;
    symbolId: string;
    action: SignalAction;
    message: string;
    sentAt: string;
    success: boolean;
}

// =====================================================
// KV State Types
// =====================================================

export interface SymbolState {
    symbolId: string;
    lastPrice: number;
    lastUpdated: string;
    lastSignal: SignalResult | null;
    indicators: TechnicalIndicators | null;
}

export interface ThresholdsConfig {
    l1MinProbability: number;   // default: 0.6
    l2MinProbability: number;   // default: 0.6
    l3MinSharpe: number;        // default: 0.5
    cooldownHours: number;      // default: 24
    hysteresisBuffer: number;   // default: 0.05
}

// =====================================================
// API Response Types
// =====================================================

export interface YahooQuote {
    symbol: string;
    regularMarketPrice: number;
    regularMarketChange: number;
    regularMarketChangePercent: number;
    regularMarketVolume: number;
    regularMarketOpen: number;
    regularMarketDayHigh: number;
    regularMarketDayLow: number;
    regularMarketPreviousClose: number;
}

export interface YahooHistoricalData {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    adjClose: number;
}
