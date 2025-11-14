# 🤖 Bot Projects Portfolio Manager

Yuzu bot と Kedo bot のプロジェクトを管理するポートフォリオシステムです。

## ✨ 主な機能

- 🍊 **Yuzu bot** と 🎯 **Kedo bot** の2つの独立したポートフォリオ
- 📸 **Google Drive画像対応** - サムネイルをGoogle Driveから直接表示
- ✏️ **サムネイル編集機能** - 登録済みプロジェクトのサムネイルも編集可能
- 🎨 **モダンなデザイン** - グラデーション、アニメーション、レスポンシブ対応
- 🔐 **簡易認証システム** - 各botごとに独立した管理画面
- 💾 **LocalStorage使用** - サーバー不要、GitHub Pagesで動作

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

### 2. Google Drive画像の準備

1. Google Driveに画像をアップロード
2. 画像を右クリック → 「共有」
3. 「リンクを知っている全員」に変更
4. リンクをコピー（例: `https://drive.google.com/file/d/1abc...xyz/view`）
5. 管理画面のサムネイル欄に貼り付け ✅

### 3. 管理画面アクセス

- **Yuzu bot管理画面**: パスワード `yuzu2024`
- **Kedo bot管理画面**: パスワード `kedo2024`

※ 本番環境では必ずパスワードを変更してください！

## 📁 ファイル構成

```
portfolio-v2/
├── index.html          # ホーム画面（ポートフォリオ選択）
├── portfolio.html      # プロジェクト一覧表示
├── admin.html          # 管理画面
├── admin.js            # 管理画面ロジック
├── styles.css          # スタイルシート
└── README.md           # このファイル
```

## 🎨 デザイン特徴

- **グラデーション背景** with アニメーション
- **カードホバーエフェクト** - 浮き上がるような動き
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

### プラットフォーム追加

`admin.html` と `portfolio.html` の `<select>` タグに追加：

```html
<option value="NewPlatform">新しいプラットフォーム</option>
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

## 💡 Google Drive画像の仕組み

アプリは自動的にGoogle DriveのURLを最適化します：

- **入力**: `https://drive.google.com/file/d/ABC123/view`
- **変換**: `https://drive.google.com/thumbnail?id=ABC123&sz=w800`

これにより、画像が確実に表示されます！

## 🌟 今後の拡張案

- [ ] 画像アップロード機能
- [ ] プロジェクトの並び替え（ドラッグ&ドロップ）
- [ ] 検索機能
- [ ] エクスポート/インポート機能
- [ ] ダークモード
- [ ] 複数画像ギャラリー

## 📝 ライセンス

MIT License

## 🤝 サポート

質問やバグ報告は、GitHubのIssuesでお願いします！

---

Made with ❤️ for Yuzu bot & Kedo bot
