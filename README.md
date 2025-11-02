# Zoom Phone フィードバックシステム 拡張版

AI-powered feedback system for Zoom Phone call recordings with talk script analysis, RAG-enhanced feedback, and NG reason trend analysis.

## システム概要

Zoom Phone通話録音を自動処理し、営業フィードバック生成、トークスクリプト一致率分析、感情分析、KPI管理を統合したWebアプリケーション。

## 主要機能

- **通話処理フロー**: 音声ダウンロード → 文字起こし (Whisper API) → AI分析 → フィードバック生成
- **トークスクリプト一致率分析**: GPT-5によるセマンティック評価
- **因果関係を考慮した統合フィードバック**: トークスクリプト + RAG検索 + NG理由トレンド
- **学習資料管理 (RAG)**: PDF/CSVからの知識ベース構築とpgvector検索
- **KPI・ダッシュボード**: 架電数、接続率、アポイント数、NG理由分析
- **音声感情分析**: 周波数解析による感情スコア可視化

## 技術スタック

### Frontend
- Next.js 14 (App Router)
- TypeScript
- shadcn/ui + Tailwind CSS
- TanStack Query (React Query)
- Zustand

### Backend
- Cloud Run (Node.js/TypeScript)
- Express.js
- Supabase (PostgreSQL + Auth + pgvector)

### AI/ML
- OpenAI Whisper (transcription)
- OpenAI GPT-5 (talk script analysis, RAG-enhanced feedback)
- OpenAI GPT-5-mini (status detection, basic feedback, NG reason classification)
- OpenAI text-embedding-3-small (RAG embeddings)

### Infrastructure
- Google Cloud Storage (audio files)
- Cloud Pub/Sub (async processing)
- Vercel (frontend deployment)

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` を `.env.local` にコピーして、必要な値を設定:

```bash
cp .env.example .env.local
```

### 3. Supabaseプロジェクトのセットアップ

1. [Supabase](https://supabase.com) でプロジェクトを作成
2. `supabase/migrations/` 内のSQLファイルを実行してデータベースを構築
3. `.env.local` に Supabase の URL と API Key を設定

### 4. GCPプロジェクトのセットアップ

1. GCPコンソールでプロジェクトを作成
2. 必要なAPI (Cloud Run, GCS, Pub/Sub) を有効化
3. サービスアカウントを作成し、認証情報をダウンロード
4. `.env.local` に GCP の設定を追加

### 5. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:7000](http://localhost:7000) を開く

## プロジェクト構造

```
.
├── app/                    # Next.js App Router
│   ├── (auth)/            # 認証関連ページ
│   ├── api/               # API Routes
│   ├── dashboard/         # ダッシュボード
│   ├── calls/             # 通話一覧・詳細
│   └── projects/          # プロジェクト管理
├── components/            # Reactコンポーネント
│   ├── ui/               # shadcn/ui components
│   └── ...               # カスタムコンポーネント
├── lib/                   # ユーティリティ
│   ├── supabase/         # Supabase クライアント
│   ├── openai.ts         # OpenAI SDK
│   └── gcs.ts            # Google Cloud Storage
├── types/                 # TypeScript型定義
├── backend/               # Cloud Run サービス
│   ├── zoom-proxy/       # Zoom Webhook受信
│   └── processor/        # 通話処理ロジック
├── supabase/
│   └── migrations/        # データベースマイグレーション
└── docs/                  # ドキュメント
```

## スクリプト

- `npm run dev` - 開発サーバー起動
- `npm run build` - プロダクションビルド
- `npm run start` - プロダクションサーバー起動
- `npm run lint` - ESLint実行
- `npm run lint:fix` - ESLint自動修正
- `npm run format` - Prettier実行
- `npm run type-check` - TypeScript型チェック
- `npm run test` - Jest単体テスト
- `npm run e2e` - Playwright E2Eテスト

## ドキュメント

詳細なドキュメントは `docs/` ディレクトリを参照:

- [要件定義書](./docs/requirements_specification_v2.md)
- [データベース設計書](./docs/database_schema.md)
- [API仕様書](./docs/api_specification.md)
- [アーキテクチャ設計書](./docs/architecture.md)
- [実装計画書](./docs/implementation_plan.md)
- [タスクブレイクダウン](./docs/task_breakdown.md)
- [技術実装ガイドライン](./docs/technical_guidelines.md)

## 重要な実装ノート

### GPT-5 推論モデルの注意点

GPT-5/GPT-5-mini では以下のサンプリングパラメータは**サポートされていません**:
- `temperature`
- `top_p`
- `presence_penalty`
- `frequency_penalty`
- `logprobs`
- `logit_bias`

これらのパラメータを指定すると `400 Bad Request` エラーが発生します。

✅ 正しい呼び出し:
```typescript
const completion = await openai.chat.completions.create({
  model: 'gpt-5',
  messages: [...],
  // temperature等のパラメータは完全に省略
})
```

詳細は [技術実装ガイドライン](./docs/technical_guidelines.md) を参照。

## ライセンス

Proprietary

## お問い合わせ

- プロジェクトマネージャー: [連絡先]
- 技術的な質問: [連絡先]
