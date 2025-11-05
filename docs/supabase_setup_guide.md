# Supabaseプロジェクト作成手順書

**作成日**: 2025-01-15
**対象システム**: Zoom Phone フィードバックシステム 拡張版

---

## 目次

1. [Supabaseアカウント作成](#1-supabaseアカウント作成)
2. [プロジェクト作成](#2-プロジェクト作成)
3. [データベース構築](#3-データベース構築)
4. [環境変数の取得と設定](#4-環境変数の取得と設定)
5. [認証設定](#5-認証設定)
6. [動作確認](#6-動作確認)

---

## 1. Supabaseアカウント作成

### 手順

1. **Supabase公式サイトにアクセス**
   - URL: https://supabase.com

2. **サインアップ**
   - 右上の「Start your project」または「Sign Up」をクリック
   - 以下のいずれかの方法でサインアップ:
     - **GitHub アカウント**（推奨）
     - **Google アカウント**
     - **メールアドレス + パスワード**

3. **メール認証**
   - メールアドレスでサインアップした場合、届いた認証メールのリンクをクリック

### 完了確認

✅ Supabaseダッシュボードにログインできる

---

## 2. プロジェクト作成

### 手順

1. **ダッシュボードにアクセス**
   - ログイン後、「New Project」ボタンをクリック

2. **Organization（組織）の作成**（初回のみ）
   - Organization Name: `zoom-phone-feedback`（任意の名前）
   - 「Create Organization」をクリック

3. **プロジェクトの設定**
   - **Name**: `zoom-phone-feedback-prod`（本番環境用）
   - **Database Password**:
     - 強力なパスワードを設定（**必ず保存してください**）
     - 例: 自動生成されたパスワードを使用（推奨）
   - **Region**: `Northeast Asia (Tokyo)`（日本のユーザー向け）
   - **Pricing Plan**: `Free`（開発・テスト用）または`Pro`（本番用）

4. **プロジェクト作成実行**
   - 「Create new project」をクリック
   - プロジェクトの作成には **約2分** かかります
   - 進捗バーが表示されるので、完了まで待機

### 完了確認

✅ プロジェクトダッシュボードが表示される
✅ 左サイドバーに「Table Editor」「SQL Editor」などのメニューが表示される

---

## 3. データベース構築

### 手順

1. **SQL Editorを開く**
   - 左サイドバーの **「SQL Editor」** をクリック
   - または、左サイドバーの **「Database」** → **「SQL Editor」**

2. **新しいクエリを作成**
   - 「+ New query」ボタンをクリック
   - または既存のクエリエディタを使用

3. **マイグレーションSQLを実行**
   - プロジェクトの `supabase/migrations/20250103_001_initial_schema.sql` ファイルを開く
   - ファイルの内容を**すべてコピー**
   - SQL Editorのエディタに**ペースト**

4. **SQLを実行**
   - 右下の **「Run」** ボタンをクリック
   - または `Ctrl + Enter`（Windows）/ `Cmd + Enter`（Mac）

5. **実行結果の確認**
   - 「Success. No rows returned」と表示されればOK
   - エラーが表示された場合:
     - エラーメッセージを確認
     - SQL文の構文エラーがないかチェック
     - すでにテーブルが存在する場合は、DROP文で削除してから再実行

### SQLの内容確認（参考）

実行されるSQL内容:

- ✅ 拡張機能の有効化（uuid-ossp, pg_cron, vector）
- ✅ 11テーブルの作成
  - users, projects, project_members
  - prompts, talk_scripts, talk_script_hearing_items
  - learning_materials, learning_material_embeddings
  - calls, ng_reasons, ng_reason_logs
- ✅ インデックスの作成
- ✅ RLS（Row Level Security）ポリシーの設定
- ✅ トリガーの作成
- ✅ Cron Job（6ヶ月後の自動削除）の設定

### 完了確認

1. **Table Editorで確認**
   - 左サイドバーの **「Table Editor」** をクリック
   - 以下の11テーブルが表示されていることを確認:
     - users
     - projects
     - project_members
     - prompts
     - talk_scripts
     - talk_script_hearing_items
     - learning_materials
     - learning_material_embeddings
     - calls
     - ng_reasons
     - ng_reason_logs

2. **pgvector拡張機能の確認**
   - SQL Editorで以下を実行:
     ```sql
     SELECT * FROM pg_extension WHERE extname = 'vector';
     ```
   - 1行が返ってくればOK

✅ 11テーブルが正常に作成されている
✅ pgvector拡張機能が有効化されている

---

## 4. 環境変数の取得と設定

### 手順

1. **プロジェクト設定を開く**
   - 左サイドバーの **⚙️ アイコン（Settings）** をクリック
   - **「API」** メニューを選択

2. **必要な情報を取得**

   以下の3つの値をコピーしてメモ帳などに保存:

   #### a) Project URL
   - 「Project URL」の欄に表示
   - 例: `https://abcdefghijklmnop.supabase.co`
   - → `.env.local` の `NEXT_PUBLIC_SUPABASE_URL` に設定

   #### b) anon/public key
   - 「Project API keys」セクション
   - 「anon」「public」と表示されているキー
   - 例: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - → `.env.local` の `NEXT_PUBLIC_SUPABASE_ANON_KEY` に設定

   #### c) service_role key
   - 「Project API keys」セクション
   - 「service_role」「secret」と表示されているキー
   - ⚠️ **機密情報**: クライアント側で絶対に使用しないこと
   - 例: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`（anonキーより長い）
   - → `.env.local` の `SUPABASE_SERVICE_ROLE_KEY` に設定

3. **`.env.local` ファイルを作成**

   プロジェクトルートで `.env.example` をコピー:

   ```bash
   cp .env.example .env.local
   ```

4. **`.env.local` を編集**

   テキストエディタで `.env.local` を開き、以下を設定:

   ```env
   # Next.js
   NEXT_PUBLIC_APP_URL=http://localhost:7000

   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...（service_roleキー）

   # OpenAI（後で設定）
   OPENAI_API_KEY=your-openai-api-key

   # GCP（後で設定）
   GCP_PROJECT_ID=your-gcp-project-id
   GCP_KEY_FILE=path/to/service-account-key.json
   GCS_BUCKET_NAME=your-gcs-bucket-name

   # Zoom（後で設定）
   ZOOM_CLIENT_ID=your-zoom-client-id
   ZOOM_CLIENT_SECRET=your-zoom-client-secret
   ZOOM_WEBHOOK_SECRET_TOKEN=your-zoom-webhook-secret
   ```

   ⚠️ **注意**: `.env.local` は `.gitignore` に含まれているため、Gitにコミットされません

### 完了確認

✅ `.env.local` ファイルが作成されている
✅ Supabaseの3つの環境変数が正しく設定されている

---

## 5. 認証設定

### 手順

1. **Authentication設定を開く**
   - 左サイドバーの **🔐 Authentication** をクリック
   - **「Settings」** タブを選択

2. **Site URL の設定**
   - 「Site URL」欄に以下を入力:
     ```
     http://localhost:7000
     ```
   - 本番環境では実際のドメイン（例: `https://yourapp.com`）に変更

3. **Redirect URLs の設定**
   - 「Redirect URLs」欄に以下を追加:
     ```
     http://localhost:7000/**
     ```
   - これにより、ローカルホストの全てのパスへのリダイレクトが許可されます

4. **Email Auth Providerの有効化**（デフォルトで有効）
   - 「Providers」タブを選択
   - 「Email」が有効になっていることを確認（デフォルトでON）

5. **Google OAuth Providerの設定**（推奨）

   #### a) Google Cloud Consoleで認証情報を作成
   1. https://console.cloud.google.com/ にアクセス
   2. プロジェクトを選択または作成
   3. 「APIとサービス」 → 「認証情報」
   4. 「認証情報を作成」 → 「OAuthクライアントID」
   5. アプリケーションの種類: 「ウェブアプリケーション」
   6. 承認済みのリダイレクトURIに追加:
      ```
      https://abcdefghijklmnop.supabase.co/auth/v1/callback
      ```
      （Supabaseプロジェクトの「Authentication」→「Providers」→「Google」に表示されるCallback URL）
   7. 「作成」をクリック
   8. **Client ID** と **Client Secret** をコピー

   #### b) SupabaseにGoogle OAuth設定
   1. Supabase「Authentication」→「Providers」
   2. 「Google」を選択
   3. 「Enable Sign in with Google」をON
   4. Client ID と Client Secret を入力
   5. 「Save」をクリック

### 完了確認

✅ Site URLが `http://localhost:7000` に設定されている
✅ Email認証が有効になっている
✅ Google OAuth認証が有効になっている（オプション）

---

## 6. 動作確認

### 手順

1. **開発サーバーを再起動**（環境変数を読み込むため）

   ```bash
   # サーバーを停止（Ctrl+C）
   # 再起動
   npm run dev
   ```

2. **Supabase接続テスト**

   プロジェクトルートで以下のテストスクリプトを作成:

   **`test-supabase.js`**:

   ```javascript
   require('dotenv').config({ path: '.env.local' })
   const { createClient } = require('@supabase/supabase-js')

   const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
   )

   async function test() {
     console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
     console.log('Testing connection...')

     // Test: Select from users table
     const { data, error } = await supabase.from('users').select('*').limit(1)

     if (error) {
       console.error('❌ Error:', error.message)
     } else {
       console.log('✅ Connection successful!')
       console.log('Users table exists (empty is OK):', data)
     }
   }

   test()
   ```

   実行:

   ```bash
   node test-supabase.js
   ```

   期待される出力:

   ```
   Supabase URL: https://abcdefghijklmnop.supabase.co
   Testing connection...
   ✅ Connection successful!
   Users table exists (empty is OK): []
   ```

3. **テーブルデータの確認**

   Supabase Dashboard → Table Editor で各テーブルを確認:
   - 全てのテーブルが表示されている
   - データは空（初期状態）

### 完了確認

✅ Supabase接続テストが成功
✅ エラーなく users テーブルにアクセスできる
✅ Table Editorで全てのテーブルが表示される

---

## トラブルシューティング

### 問題1: SQL実行時にエラーが出る

**エラー例**:

```
Error: relation "users" already exists
```

**解決方法**:

- テーブルが既に存在する場合、SQL Editorで以下を実行して削除:
  ```sql
  DROP TABLE IF EXISTS ng_reason_logs CASCADE;
  DROP TABLE IF EXISTS ng_reasons CASCADE;
  DROP TABLE IF EXISTS calls CASCADE;
  DROP TABLE IF EXISTS learning_material_embeddings CASCADE;
  DROP TABLE IF EXISTS learning_materials CASCADE;
  DROP TABLE IF EXISTS talk_script_hearing_items CASCADE;
  DROP TABLE IF EXISTS talk_scripts CASCADE;
  DROP TABLE IF EXISTS prompts CASCADE;
  DROP TABLE IF EXISTS project_members CASCADE;
  DROP TABLE IF EXISTS projects CASCADE;
  DROP TABLE IF EXISTS users CASCADE;
  ```
- その後、マイグレーションSQLを再実行

### 問題2: pgvector拡張機能が有効化されない

**エラー例**:

```
Error: type "vector" does not exist
```

**解決方法**:

- SQL Editorで以下を実行:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```
- 再度マイグレーションSQLを実行

### 問題3: 環境変数が読み込まれない

**症状**:

- `undefined` が表示される
- 接続エラーが発生

**解決方法**:

1. `.env.local` ファイルがプロジェクトルートに存在するか確認
2. ファイル名が正確に `.env.local` であることを確認（`.env`ではない）
3. 開発サーバーを再起動（環境変数は起動時に読み込まれる）
4. `.env.local` の値に余分なスペースや改行がないか確認

### 問題4: RLSポリシーで403エラー

**症状**:

- データの取得・更新時に `new row violates row-level security policy` エラー

**解決方法**:

- 開発中は一時的にRLSを無効化してテスト:
  ```sql
  ALTER TABLE users DISABLE ROW LEVEL SECURITY;
  ```
- 本番環境では必ずRLSを有効化すること

---

## 次のステップ

Supabaseの設定が完了したら、以下に進んでください:

1. **認証機能の実装**
   - ログインページ作成
   - Supabase Auth連携
   - 認証Middleware実装

2. **初期ユーザーの作成**
   - オーナーユーザーの手動作成
   - プロジェクトの作成

3. **開発の継続**
   - API Routes実装
   - UIコンポーネント実装

---

## 参考リンク

- **Supabase公式ドキュメント**: https://supabase.com/docs
- **Supabase JavaScript Client**: https://supabase.com/docs/reference/javascript/introduction
- **Row Level Security**: https://supabase.com/docs/guides/auth/row-level-security
- **pgvector**: https://github.com/pgvector/pgvector

---

**以上でSupabaseプロジェクトのセットアップは完了です！**

何か問題が発生した場合は、トラブルシューティングセクションを参照するか、プロジェクトマネージャーに相談してください。
