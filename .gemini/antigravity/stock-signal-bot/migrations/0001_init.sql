-- =====================================================
-- D1 Database Schema for Stock Signal Bot
-- =====================================================

-- 銘柄マスター
CREATE TABLE IF NOT EXISTS symbols (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('JP', 'US')),
  asset_type TEXT DEFAULT 'stock' CHECK (asset_type IN ('stock', 'etf', 'mutual_fund')),
  sector TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 日足価格データ
CREATE TABLE IF NOT EXISTS prices_daily (
  symbol_id TEXT NOT NULL,
  date TEXT NOT NULL,
  open REAL,
  high REAL,
  low REAL,
  close REAL NOT NULL,
  volume INTEGER,
  adj_close REAL,
  PRIMARY KEY (symbol_id, date),
  FOREIGN KEY (symbol_id) REFERENCES symbols(id)
);

-- 分足価格データ（直近2日分のみ保持）
CREATE TABLE IF NOT EXISTS prices_intraday (
  symbol_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  price REAL NOT NULL,
  volume INTEGER,
  PRIMARY KEY (symbol_id, timestamp)
);

-- イベントカレンダー
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  symbol_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('earnings', 'economic', 'dividend', 'split')),
  event_date TEXT NOT NULL,
  description TEXT,
  importance INTEGER DEFAULT 1 CHECK (importance BETWEEN 1 AND 3),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (symbol_id) REFERENCES symbols(id)
);

-- 保有銘柄
CREATE TABLE IF NOT EXISTS holdings (
  id TEXT PRIMARY KEY,
  symbol_id TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  quantity REAL NOT NULL,
  avg_cost REAL NOT NULL,
  current_price REAL,
  market_value REAL,
  unrealized_pnl REAL,
  currency TEXT DEFAULT 'JPY' CHECK (currency IN ('JPY', 'USD')),
  acquired_date TEXT,
  notes TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (symbol_id) REFERENCES symbols(id)
);

-- シグナル履歴
CREATE TABLE IF NOT EXISTS signal_history (
  id TEXT PRIMARY KEY,
  symbol_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL', 'HOLD', 'WATCH')),
  confidence REAL,
  horizon TEXT,
  reasons TEXT,
  warnings TEXT,
  l1_data TEXT,
  l2_data TEXT,
  l3_data TEXT,
  l4_data TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (symbol_id) REFERENCES symbols(id)
);

-- 通知ログ
CREATE TABLE IF NOT EXISTS notification_logs (
  id TEXT PRIMARY KEY,
  symbol_id TEXT,
  action TEXT,
  message TEXT NOT NULL,
  sent_at TEXT DEFAULT (datetime('now')),
  success INTEGER DEFAULT 1,
  error_message TEXT
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_prices_daily_date ON prices_daily(date);
CREATE INDEX IF NOT EXISTS idx_prices_daily_symbol ON prices_daily(symbol_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_signal_history_symbol ON signal_history(symbol_id);
CREATE INDEX IF NOT EXISTS idx_signal_history_created ON signal_history(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent ON notification_logs(sent_at);
