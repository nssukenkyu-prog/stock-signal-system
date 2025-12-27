# Stock Signal Bot 運用手順書

## 1. 初回デプロイ

### 1.1 前提条件
- Node.js 18以上
- Cloudflareアカウント（無料プラン可）
- LINE Developersアカウント（Messaging API設定済み）

### 1.2 セットアップ手順

```bash
# リポジトリのクローン
git clone <your-repo-url>
cd stock-signal-bot

# 依存関係インストール
npm install

# Cloudflareにログイン
npx wrangler login

# リソース作成とデプロイ
chmod +x scripts/deploy.sh
./scripts/deploy.sh

# シークレット設定
chmod +x scripts/setup-secrets.sh
./scripts/setup-secrets.sh

# デプロイ
npm run deploy
```

### 1.3 wrangler.toml の更新

KVとD1のIDを実際の値に更新：

```toml
[[kv_namespaces]]
binding = "STATE"
id = "実際のKV ID"

[[d1_databases]]
binding = "DB"
database_name = "stock-signals"
database_id = "実際のD1 ID"
```

---

## 2. 動作確認

### 2.1 テスト通知の送信

```bash
# ローカルで開発サーバー起動
npm run dev

# 別ターミナルでテスト通知送信
curl -X POST http://localhost:8787/test/notify
```

### 2.2 本番環境でのテスト

```bash
# デプロイ
npm run deploy

# テスト通知（URLはデプロイ時に表示される）
curl -X POST https://stock-signal-bot.<your-subdomain>.workers.dev/test/notify
```

---

## 3. 保有銘柄の管理

### 3.1 保有銘柄の追加

```bash
# D1に直接追加
wrangler d1 execute stock-signals --remote --command="
INSERT INTO holdings (id, symbol_id, name, account_type, quantity, avg_cost, currency)
VALUES ('h_new', 'TSLA', 'テスラ', 'specific', 10, 250.00, 'USD');
"

# シンボルも追加
wrangler d1 execute stock-signals --remote --command="
INSERT INTO symbols (id, name, market, is_active)
VALUES ('TSLA', 'テスラ', 'US', 1);
"
```

### 3.2 保有銘柄の削除

```bash
wrangler d1 execute stock-signals --remote --command="
DELETE FROM holdings WHERE symbol_id = 'TSLA';
"
```

### 3.3 保有銘柄の確認

```bash
wrangler d1 execute stock-signals --remote --command="
SELECT * FROM holdings ORDER BY market_value DESC;
"
```

---

## 4. 閾値調整

### 4.1 通知閾値の変更

```bash
# KVに閾値を設定
wrangler kv:key put --namespace-id=<KV_ID> "config:thresholds" '{
  "l1MinProbability": 0.65,
  "l2MinProbability": 0.65,
  "l3MinSharpe": 0.6,
  "cooldownHours": 12,
  "hysteresisBuffer": 0.05
}'
```

### 4.2 デフォルト値
| パラメータ | デフォルト値 | 説明 |
|-----------|-------------|------|
| `l1MinProbability` | 0.6 | BUY判定の確率閾値 |
| `l2MinProbability` | 0.6 | SELL判定の確率閾値 |
| `l3MinSharpe` | 0.5 | シャープレシオ閾値 |
| `cooldownHours` | 24 | 同一銘柄の通知間隔 |
| `hysteresisBuffer` | 0.05 | シグナル反転時のバッファ |

---

## 5. 障害対応

### 5.1 通知が来ない場合

1. **ログ確認**
   ```bash
   wrangler tail
   ```

2. **緊急停止フラグの確認**
   ```bash
   wrangler kv:key get --namespace-id=<KV_ID> "system:emergency_stop"
   ```

3. **緊急停止のリセット**
   ```bash
   curl -X POST https://stock-signal-bot.*.workers.dev/admin/reset-stop
   ```

### 5.2 過剰通知の場合

緊急停止が自動的に発動（1日50件超過時）。手動停止も可能：

```bash
wrangler kv:key put --namespace-id=<KV_ID> "system:emergency_stop" "true"
```

### 5.3 データ破損の場合

```bash
# テーブル再作成
wrangler d1 execute stock-signals --remote --file=./migrations/0001_init.sql
wrangler d1 execute stock-signals --remote --file=./migrations/0002_seed.sql
```

---

## 6. 監視とメンテナンス

### 6.1 日次チェック項目
- [ ] LINE通知が正常に受信できているか
- [ ] Cloudflareダッシュボードでエラー率確認
- [ ] 価格データが更新されているか

### 6.2 週次チェック項目
- [ ] シグナル履歴の確認
- [ ] 閾値調整の検討
- [ ] バックテストの再実行

### 6.3 ログの確認

```bash
# リアルタイムログ
wrangler tail

# 通知ログ確認
wrangler d1 execute stock-signals --remote --command="
SELECT * FROM notification_logs ORDER BY sent_at DESC LIMIT 20;
"
```

---

## 7. バックテストの実行

```bash
cd backtest

# 依存関係インストール
pip install pandas numpy yfinance matplotlib

# 保有銘柄でバックテスト
python run.py --symbols NVDA CRWD 7203.T 9023.T --walk-forward

# レポート確認
open reports/backtest_report_*.html
```

---

## 8. コスト管理

### Cloudflare無料枠の制限
| リソース | 無料枠 | 想定使用量 |
|----------|--------|-----------|
| Workers Requests | 100,000/日 | ~10,000/日 |
| KV Reads | 100,000/日 | ~5,000/日 |
| KV Writes | 1,000/日 | ~200/日 |
| D1 Reads | 5M/日 | ~50,000/日 |
| D1 Writes | 100K/日 | ~1,000/日 |

**⚠️ 超過の兆候があれば、監視頻度を調整してください。**

---

## 9. よくある質問

### Q: 投資信託のシグナルは出ますか？
A: 現在、投資信託は価格監視のみで、シグナル生成は株式・ETFに限定されています。

### Q: 日本市場の休場日は考慮されますか？
A: 現在は曜日のみ判定しています。祝日対応は将来の課題です。

### Q: シグナルの精度はどのくらいですか？
A: バックテストで勝率55-60%、プロフィットファクター1.2-1.5を目標としています。相場環境により変動します。
