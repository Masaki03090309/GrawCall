# 開発環境構築手順書

**バージョン**: 1.0.0
**作成日**: 2025-01-15

---

## 必要な環境

### ソフトウェア要件

- **Node.js**: 20.x以上
- **pnpm**: 8.x以上
- **Git**: 2.x以上
- **Docker**: 24.x以上（ローカルSupabase用）
- **エディタ**: VS Code推奨

---

## セットアップ手順

### 1. リポジトリクローン

```bash
git clone https://github.com/your-org/zoom-phone-feedback.git
cd zoom-phone-feedback
```

### 2. 依存関係インストール

```bash
# フロントエンド
cd frontend
pnpm install

# バックエンド
cd ../backend
pnpm install
```

### 3. 環境変数設定

```bash
# frontend/.env.local
cp .env.example .env.local
```

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# OpenAI
OPENAI_API_KEY=sk-...

# Google Cloud
GCS_BUCKET_NAME=zoom-phone-feedback-dev
GCP_PROJECT_ID=your-project-id
```

### 4. ローカルSupabase起動

```bash
# Supabase CLIインストール
pnpm install -g supabase

# Supabase起動
supabase start

# マイグレーション実行
supabase db push
```

### 5. 開発サーバー起動

```bash
# フロントエンド
cd frontend
pnpm dev

# バックエンド（別ターミナル）
cd backend
pnpm dev
```

アクセス:

- フロントエンド: http://localhost:3000
- Supabase Studio: http://localhost:54323

---

## デバッグ設定

### VS Code設定

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm dev"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    }
  ]
}
```

---

## テスト実行

```bash
# ユニットテスト
pnpm test

# E2Eテスト
pnpm test:e2e

# カバレッジ
pnpm test:coverage
```

---

**以上**
