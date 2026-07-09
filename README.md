# Uchi-no-Zaiko 📦（iPhoneアップロード用フラット構成）

家の食材・日用品の在庫を「消費ペース学習」で自動管理するPWA。

## 構成
- ルート直下：index.html / main.jsx / App.jsx / package.json / vite.config.js
- `api/suggest.js`：Vercelサーバーレス関数（GitHub上で「Create new file」から作成）
- AIキーはVercelの環境変数 `ANTHROPIC_API_KEY` のみに保存（クライアント非公開）

## デプロイ
1. このリポジトリをVercelでImport（Vite自動検出）→ Deploy
2. Settings → Environment Variables に `ANTHROPIC_API_KEY` を追加 → Redeploy
3. SafariでURLを開き「ホーム画面に追加」

詳しい設計・改善記録は会話ログ参照。
