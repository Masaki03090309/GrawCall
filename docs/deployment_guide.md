# デプロイメントガイド

**バージョン**: 1.0.0
**作成日**: 2025-01-15

---

## デプロイ環境

### 本番環境

- **フロントエンド**: Vercel
- **バックエンド**: Google Cloud Run
- **データベース**: Supabase (Production)
- **ストレージ**: Google Cloud Storage
- **ドメイン**: app.yourapp.com

### ステージング環境

- **フロントエンド**: Vercel (Preview)
- **バックエンド**: Cloud Run (staging)
- **データベース**: Supabase (Staging)
- **ドメイン**: staging.yourapp.com

---

## 事前準備

### 1. Google Cloud設定

```bash
# GCP CLIインストール
curl https://sdk.cloud.google.com | bash

# 認証
gcloud auth login

# プロジェクト設定
gcloud config set project YOUR_PROJECT_ID

# 必要なAPIを有効化
gcloud services enable \
  run.googleapis.com \
  storage.googleapis.com \
  pubsub.googleapis.com
```

### 2. Supabaseプロジェクト作成

1. https://supabase.com でプロジェクト作成
2. Database PasswordとProject URLをメモ
3. SQL EditorでマイグレーションSQL実行

### 3. 環境変数設定

#### Vercel

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add OPENAI_API_KEY
```

#### Cloud Run

```bash
# Secret Managerに保存
gcloud secrets create openai-api-key --data-file=- <<< "sk-..."
gcloud secrets create supabase-service-role-key --data-file=- <<< "eyJ..."
```

---

## デプロイ手順

### フロントエンド（Next.js → Vercel）

```bash
# 1. Vercel CLIインストール
pnpm install -g vercel

# 2. プロジェクトリンク
cd frontend
vercel link

# 3. ビルド確認
vercel build

# 4. 本番デプロイ
vercel --prod
```

### バックエンド（Cloud Run）

```bash
cd backend

# 1. Dockerイメージビルド
docker build -t gcr.io/YOUR_PROJECT_ID/backend-processor:latest .

# 2. Container Registryにプッシュ
docker push gcr.io/YOUR_PROJECT_ID/backend-processor:latest

# 3. Cloud Runデプロイ
gcloud run deploy backend-processor \
  --image gcr.io/YOUR_PROJECT_ID/backend-processor:latest \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars "SUPABASE_URL=https://xxx.supabase.co" \
  --set-secrets "OPENAI_API_KEY=openai-api-key:latest" \
  --cpu 2 \
  --memory 4Gi \
  --timeout 300 \
  --max-instances 100
```

### データベースマイグレーション

```bash
# Supabase CLIでマイグレーション
supabase db push --db-url "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
```

### GCS設定

```bash
# 1. バケット作成
gsutil mb -l asia-northeast1 gs://zoom-phone-feedback-prod

# 2. Lifecycleポリシー設定
cat > lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [{
      "action": {"type": "Delete"},
      "condition": {"age": 180, "matchesPrefix": ["calls/"]}
    }]
  }
}
EOF

gsutil lifecycle set lifecycle.json gs://zoom-phone-feedback-prod

# 3. CORS設定
cat > cors.json << EOF
[{
  "origin": ["https://app.yourapp.com"],
  "method": ["GET", "HEAD"],
  "responseHeader": ["Content-Type"],
  "maxAgeSeconds": 3600
}]
EOF

gsutil cors set cors.json gs://zoom-phone-feedback-prod
```

---

## CI/CD設定

### GitHub Actions

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Cloud SDK
        uses: google-github-actions/setup-gcloud@v0
        with:
          service_account_key: ${{ secrets.GCP_SA_KEY }}
          project_id: ${{ secrets.GCP_PROJECT_ID }}

      - name: Build and Push
        run: |
          docker build -t gcr.io/${{ secrets.GCP_PROJECT_ID }}/backend:${{ github.sha }} .
          docker push gcr.io/${{ secrets.GCP_PROJECT_ID }}/backend:${{ github.sha }}

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy backend-processor \
            --image gcr.io/${{ secrets.GCP_PROJECT_ID }}/backend:${{ github.sha }} \
            --platform managed \
            --region asia-northeast1
```

---

## ロールバック手順

### Vercel

```bash
# デプロイ履歴確認
vercel ls

# 特定のデプロイに戻す
vercel rollback [DEPLOYMENT_URL]
```

### Cloud Run

```bash
# リビジョン一覧
gcloud run revisions list --service backend-processor

# 特定のリビジョンにロールバック
gcloud run services update-traffic backend-processor \
  --to-revisions [REVISION_NAME]=100
```

---

## モニタリング設定

### Cloud Monitoring

```bash
# アラート作成
gcloud alpha monitoring policies create \
  --notification-channels=[CHANNEL_ID] \
  --display-name="High Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05
```

### Sentry設定

```typescript
// frontend/sentry.config.ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
})
```

---

## ヘルスチェック

### エンドポイント

- `GET /health` - アプリケーションヘルスチェック
- `GET /health/db` - データベース接続確認

### 監視項目

- **レスポンスタイム**: p95 < 500ms
- **エラーレート**: < 1%
- **CPU使用率**: < 80%
- **メモリ使用率**: < 80%

---

**以上**
