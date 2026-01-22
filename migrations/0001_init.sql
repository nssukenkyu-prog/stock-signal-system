
-- Initial Schema

CREATE TABLE IF NOT EXISTS symbols (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  market TEXT NOT NULL,
  asset_type TEXT DEFAULT 'stock', -- stock, mutual_fund, etf
  sector TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS holdings (
  id TEXT PRIMARY KEY,
  symbol_id TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT,
  quantity REAL NOT NULL,
  avg_cost REAL NOT NULL,
  current_price REAL,
  market_value REAL,
  unrealized_pnl REAL,
  currency TEXT DEFAULT 'JPY',
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (symbol_id) REFERENCES symbols(id)
);

CREATE TABLE IF NOT EXISTS prices_daily (
  symbol_id TEXT NOT NULL,
  date TEXT NOT NULL,
  open REAL,
  high REAL,
  low REAL,
  close REAL,
  volume INTEGER,
  adj_close REAL,
  PRIMARY KEY (symbol_id, date)
);

CREATE TABLE IF NOT EXISTS prices_intraday (
  symbol_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  price REAL NOT NULL,
  volume INTEGER,
  PRIMARY KEY (symbol_id, timestamp)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  symbol_id TEXT,
  event_type TEXT NOT NULL,
  event_date TEXT NOT NULL,
  description TEXT,
  importance INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS signal_history (
  id TEXT PRIMARY KEY,
  symbol_id TEXT NOT NULL,
  action TEXT NOT NULL,
  confidence REAL,
  horizon TEXT,
  reasons TEXT, -- JSON
  warnings TEXT, -- JSON
  l1_data TEXT, -- JSON
  l2_data TEXT, -- JSON
  l3_data TEXT, -- JSON
  l4_data TEXT, -- JSON
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id TEXT PRIMARY KEY,
  symbol_id TEXT,
  action TEXT,
  message TEXT,
  success INTEGER,
  error_message TEXT,
  sent_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prices_daily_symbol ON prices_daily(symbol_id);
CREATE INDEX IF NOT EXISTS idx_prices_daily_date ON prices_daily(date);
CREATE INDEX IF NOT EXISTS idx_signal_history_symbol ON signal_history(symbol_id);
CREATE INDEX IF NOT EXISTS idx_signal_history_created ON signal_history(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent ON notification_logs(sent_at);

-- Portfolio Snapshots (Added later)
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  total_value REAL NOT NULL,
  daily_pnl REAL,
  monthly_start_value REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_date ON portfolio_snapshots(date);
