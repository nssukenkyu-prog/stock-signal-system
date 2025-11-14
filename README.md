# 🤖 Bot Projects Portfolio Manager v3

Yuzu bot と Kedo bot のプロジェクトを管理するポートフォリオシステム（カテゴリーカスタマイズ対応版）

## ✨ 主な機能

- 🍊 **Yuzu bot** と 🎯 **Kedo bot** の2つの独立したポートフォリオ
- 📁 **カテゴリーカスタマイズ** - 自由にカテゴリーを追加・編集・削除
- 🎨 **カテゴリーカラー設定** - 各カテゴリーに独自の色を設定可能
- 📸 **Google Drive画像対応** - サムネイルをGoogle Driveから直接表示
- ✏️ **サムネイル編集機能** - 登録済みプロジェクトのサムネイルも編集可能
- 🔗 **編集画面リンク** - GASやCloudflareの管理画面に直接アクセス
- 🎨 **モダンなデザイン** - グラデーション、アニメーション、レスポンシブ対応
- 🔐 **簡易認証システム** - 各botごとに独立した管理画面
- 💾 **LocalStorage使用** - サーバー不要、GitHub Pagesで動作

## 🆕 v3の新機能

### 1. カテゴリー管理システム
- カテゴリーの追加・編集・削除が可能
- カテゴリーごとに色を設定
- GAS、GitHub、Cloudflare、Genspark、Vercel など自由に設定

### 2. 編集画面リンク機能
- 各プロジェクトに「編集画面URL」を設定可能
- GASスクリプトエディタやCloudflare Dashboardへ直接アクセス
- プロジェクト一覧と管理画面の両方に表示

## 🚀 使い方

### 1. GitHub Pagesへのデプロイ

```bash
# リポジトリを作成
git init
git add .
git commit -m "Initial commit"

# GitHubにプッシュ
git remote add origin https://github.com/your-username/portfolio.git
git push -u origin main

# GitHub Pagesを有効化
# Settings → Pages → Source を "main" ブランチに設定
```

### 2. カテゴリーの設定

1. ポートフォリオページの「📁 カテゴリー管理」をクリック
2. 新しいカテゴリーを追加:
   - カテゴリー名: 表示名（例: Cloudflare）
   - ID: 半角英数字のID（例: Cloudflare）
   - カテゴリーカラー: バッジの色を選択
3. 既存のカテゴリーも編集・削除可能

### 3. プロジェクトの追加

1. 管理画面にアクセス（パスワード: yuzu2024 / kedo2024）
2. 新しいプロジェクトを追加:
   - **タイトル**: プロジェクト名
   - **カテゴリー**: 作成したカテゴリーから選択
   - **説明**: プロジェクトの説明
   - **公開URL**: ユーザーがアクセスするURL
   - **編集画面URL**: 🆕 管理者用の編集画面URL（GASスクリプトエディタなど）
   - **サムネイル**: Google Driveの共有リンク
   - **タグ**: カンマ区切りのタグ

### 4. 編集画面URLの例

#### GASプロジェクト
```
https://script.google.com/home/projects/YOUR_PROJECT_ID/edit
```

#### Cloudflareダッシュボード
```
https://dash.cloudflare.com/YOUR_ACCOUNT_ID/pages/view/YOUR_PROJECT
```

#### GitHub リポジトリ
```
https://github.com/username/repository
```

#### Vercel プロジェクト
```
https://vercel.com/username/project-name
```

### 5. Google Drive画像の準備

1. Google Driveに画像をアップロード
2. 画像を右クリック → 「共有」
3. 「リンクを知っている全員」に変更
4. リンクをコピー（例: `https://drive.google.com/file/d/1abc...xyz/view`）
5. 管理画面のサムネイル欄に貼り付け ✅

## 📁 ファイル構成

```
portfolio-v3/
├── index.html          # ホーム画面（ポートフォリオ選択）
├── portfolio.html      # プロジェクト一覧表示
├── categories.html     # 🆕 カテゴリー管理画面
├── categories.js       # 🆕 カテゴリー管理ロジック
├── admin.html          # 管理画面
├── admin.js            # 管理画面ロジック
├── styles.css          # スタイルシート
└── README.md           # このファイル
```

## 🎨 デザイン特徴

- **グラデーション背景** with アニメーション
- **カードホバーエフェクト** - 浮き上がるような動き
- **カテゴリーカラー対応** - 各カテゴリーに独自の色
- **編集リンクアイコン** - 直感的な操作
- **スムーズなトランジション**
- **モバイル完全対応**
- **視認性の高い配色**

## 🔧 カスタマイズ

### パスワード変更

`admin.js` の以下の部分を編集：

```javascript
const PASSWORDS = {
    'yuzu': 'your-new-password',
    'kedo': 'your-new-password'
};
```

### デフォルトカテゴリーの変更

`categories.js` と `admin.js` の以下の部分を編集：

```javascript
categories = [
    { id: 'GAS', name: 'GAS', color: '#34A853' },
    { id: 'GitHub', name: 'GitHub', color: '#24292e' },
    { id: 'Cloudflare', name: 'Cloudflare', color: '#F38020' },
    // お好みのカテゴリーを追加
];
```

### カラーテーマ変更

`styles.css` の `:root` 変数を編集：

```css
:root {
    --primary-color: #6366f1; /* お好みの色に変更 */
    --secondary-color: #ec4899;
    /* ... */
}
```

## 💡 使用例

### GASプロジェクトの登録例

- **タイトル**: お問い合わせフォーム
- **カテゴリー**: GAS
- **説明**: Googleフォームからのお問い合わせを自動処理
- **公開URL**: https://script.google.com/macros/s/abc123/exec
- **編集画面URL**: https://script.google.com/home/projects/xyz789/edit
- **サムネイル**: Google Driveの画像リンク
- **タグ**: GAS, Form, Automation

これで、プロジェクト一覧から「編集画面」ボタンをクリックすると、直接GASスクリプトエディタが開きます！

## 🌟 v2からの変更点

- ✅ カテゴリー管理画面の追加
- ✅ カテゴリーカラーのカスタマイズ
- ✅ 編集画面URLフィールドの追加
- ✅ プロジェクトカードに編集リンクを表示
- ✅ 管理画面にも編集リンクを表示
- ✅ カテゴリーの動的読み込み

## 📝 ライセンス

MIT License

## 🤝 サポート

質問やバグ報告は、GitHubのIssuesでお願いします！

---

Made with ❤️ for Yuzu bot & Kedo bot | Version 3.0
