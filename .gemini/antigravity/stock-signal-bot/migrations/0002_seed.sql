-- =====================================================
-- Seed Data: User's Holdings (2025-12-22)
-- =====================================================

-- Insert symbols first
INSERT OR REPLACE INTO symbols (id, name, market, asset_type, is_active) VALUES
-- 国内株式
('3197.T', 'すかいらーくHD', 'JP', 'stock', 1),
('4596.T', '窪田製薬HLDGS', 'JP', 'stock', 1),
('4755.T', '楽天グループ', 'JP', 'stock', 1),
('9023.T', '東京地下鉄', 'JP', 'stock', 1),
-- 米国株式
('CRWD', 'クラウドストライク', 'US', 'stock', 1),
('NVDA', 'エヌビディア', 'US', 'stock', 1),
-- 投資信託（主要なもののみ監視対象）
('EMAXIS_SP500', 'eMAXIS Slim 米国株式(S&P500)', 'US', 'mutual_fund', 1),
('EMAXIS_WORLD', 'eMAXIS Slim 全世界株式(オルカン)', 'US', 'mutual_fund', 1),
('RAKUTEN_VTI', '楽天・全米株式インデックス(楽天・VTI)', 'US', 'mutual_fund', 1),
('RAKUTEN_VT', '楽天・全世界株式インデックス(楽天・VT)', 'US', 'mutual_fund', 1);

-- Insert holdings
INSERT OR REPLACE INTO holdings (id, symbol_id, name, account_type, quantity, avg_cost, current_price, market_value, unrealized_pnl, currency) VALUES
-- 国内株式
('h001', '3197.T', 'すかいらーくHD', 'specific', 100, 2922.75, 3485.0, 348500, 56225, 'JPY'),
('h002', '4596.T', '窪田製薬HLDGS', 'specific', 1100, 139.10, 43.0, 47300, -105714, 'JPY'),
('h003', '4755.T', '楽天グループ', 'general', 100, 989.89, 953.5, 95350, -3639, 'JPY'),
('h004', '9023.T', '東京地下鉄', 'general', 200, 1721.37, 1560.0, 312000, -32275, 'JPY'),
-- 米国株式
('h005', 'CRWD', 'クラウドストライク', 'specific', 3, 509.5066, 481.28, 227679, 4013, 'USD'),
('h006', 'NVDA', 'エヌビディア', 'specific', 9, 158.78, 180.99, 256862, 47754, 'USD'),
-- 投資信託（評価額が大きいもの上位）
('h007', 'EMAXIS_SP500', 'eMAXIS Slim 米国株式(S&P500) NISA成長', 'nisa_growth', 210568, 27350.74, 38603, 812856, 236937, 'JPY'),
('h008', 'RAKUTEN_VTI', '楽天・全米株式(楽天・VTI) NISA成長', 'nisa_growth', 152606, 29487.70, 38959, 594538, 144538, 'JPY'),
('h009', 'EMAXIS_SP500', 'eMAXIS Slim 米国株式(S&P500) NISAつみたて', 'nisa_tsumitate', 100103, 32266.77, 38603, 386428, 63428, 'JPY'),
('h010', 'RAKUTEN_VT', '楽天・全世界株式(楽天・VT)', 'nisa_tsumitate', 125350, 25767.85, 31049, 389199, 66199, 'JPY'),
('h011', 'EMAXIS_WORLD', 'eMAXIS Slim 全世界株式(オルカン)', 'nisa_tsumitate', 112684, 26978.10, 32594, 367282, 63282, 'JPY');

-- 主要インデックス・為替もシンボルとして登録
INSERT OR REPLACE INTO symbols (id, name, market, asset_type, is_active) VALUES
('^N225', '日経225', 'JP', 'etf', 1),
('^GSPC', 'S&P500', 'US', 'etf', 1),
('^DJI', 'NYダウ', 'US', 'etf', 1),
('USDJPY=X', 'ドル円', 'US', 'etf', 1);
