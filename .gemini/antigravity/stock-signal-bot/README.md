# Stock Signal Bot

楽天証券の保有銘柄を含む全銘柄の売り時・買い時を推定し、LINE公式アカウントから通知するシステム

## 🎯 特徴

- **分単位監視**: Cloudflare Workers Cron Triggersで市場時間中に自動監視
- **4種類のシグナル分析**:
  - L1: 上昇到達確率（+X%到達の可能性）
  - L2: 下落到達確率（-Y%到達の可能性）
  - L3: リスク調整済み期待リターン
  - L4: トレンド継続/反転検出
- **LINE通知**: BUY/SELL/WATCH判定時に即座に通知
- **安全機構**: クールダウン、ヒステリシス、緊急停止
- **無料運用**: Cloudflare無料枠内で動作

## 📦 クイックスタート

```bash
# クローン
git clone <repo-url>
cd stock-signal-bot

# 依存関係インストール
npm install

# セットアップ
./scripts/deploy.sh
./scripts/setup-secrets.sh

# デプロイ
npm run deploy
```

## 📊 バックテスト

```bash
cd backtest
pip install pandas numpy yfinance matplotlib
python run.py --walk-forward
```

## 📁 構成

```
stock-signal-bot/
├── src/
│   ├── index.ts          # エントリーポイント
│   ├── workers/          # Worker モジュール
│   ├── models/           # シグナル生成
│   ├── data/             # データ取得
│   ├── storage/          # KV/D1操作
│   └── utils/            # ユーティリティ
├── backtest/             # バックテスト
├── migrations/           # D1スキーマ
├── scripts/              # デプロイスクリプト
└── docs/                 # ドキュメント
```

## ⚠️ 免責事項

本システムは投資助言ではありません。投資判断はご自身の責任で行ってください。
詳細は [DISCLAIMER.md](docs/DISCLAIMER.md) を参照してください。

## 📄 ライセンス

MIT
