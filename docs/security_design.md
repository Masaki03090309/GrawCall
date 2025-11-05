# セキュリティ設計書

**バージョン**: 1.0.0
**作成日**: 2025-01-15

---

## セキュリティ要件

### OWASP Top 10対策

| 脅威                                 | 対策                                   |
| ------------------------------------ | -------------------------------------- |
| **Injection**                        | パラメータ化クエリ、Zod バリデーション |
| **認証の不備**                       | Supabase Auth、JWT、MFA対応            |
| **データ漏洩**                       | RLS、暗号化、Signed URLs               |
| **XXE**                              | XML処理なし                            |
| **アクセス制御の不備**               | RLS、ロールベース制御                  |
| **セキュリティ設定ミス**             | 環境変数管理、最小権限原則             |
| **XSS**                              | React自動エスケープ、CSP               |
| **安全でないデシリアライゼーション** | JSON.parse検証                         |
| **既知の脆弱性**                     | Dependabot、定期更新                   |
| **ログ不足**                         | Sentry、Cloud Logging                  |

---

## 認証・認可

### 認証フロー

```
1. ユーザーがログイン
   ↓
2. Supabase Auth検証
   ↓
3. JWT発行（有効期限: 1時間）
   ↓
4. Refresh Token発行（有効期限: 7日）
   ↓
5. クライアントにトークン返却
```

### Row Level Security (RLS)

```sql
-- 通話データのアクセス制御
CREATE POLICY "通話アクセス制御"
ON calls FOR SELECT
USING (
  -- 自分の通話
  auth.uid() = user_id
  OR
  -- ディレクターは担当プロジェクトのメンバーの通話
  EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = calls.project_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'director'
  )
  OR
  -- オーナーは全通話
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid() AND u.role = 'owner'
  )
);
```

---

## データ暗号化

### 転送中の暗号化

- **TLS 1.3**: すべての通信
- **HSTS**: HTTP Strict Transport Security有効
- **証明書**: Let's Encrypt自動更新

### 保存時の暗号化

- **Supabase**: AES-256暗号化
- **GCS**: Google-managed encryption keys
- **機密データ**: 追加でアプリケーション層暗号化

---

## APIセキュリティ

### レート制限

```typescript
// Express Rate Limiter
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1分
  max: 100, // 100リクエスト
  message: 'レート制限を超過しました',
})

app.use('/api/', limiter)
```

### CORS設定

```typescript
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS.split(','),
  credentials: true,
  optionsSuccessStatus: 200,
}

app.use(cors(corsOptions))
```

---

## 脆弱性スキャン

### 定期スキャン

```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  schedule:
    - cron: '0 0 * * *' # 毎日

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Snyk
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

---

## 監査ログ

### 記録対象

- **ユーザーアクション**: ログイン、ログアウト、権限変更
- **データ操作**: 作成、更新、削除
- **アクセス**: 機密データへのアクセス

### ログフォーマット

```json
{
  "timestamp": "2025-01-15T10:00:00Z",
  "user_id": "uuid",
  "action": "UPDATE",
  "resource": "projects/uuid",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0..."
}
```

---

**以上**
