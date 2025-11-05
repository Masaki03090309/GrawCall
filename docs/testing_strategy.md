# テスト戦略書

**バージョン**: 1.0.0
**作成日**: 2025-01-15

---

## テスト方針

### テストピラミッド

```
        ┌─────────┐
        │   E2E   │  10%
        ├─────────┤
        │Integration│  20%
        ├─────────┤
        │   Unit   │  70%
        └─────────┘
```

---

## ユニットテスト

### フロントエンド

**ツール**: Jest + React Testing Library

```typescript
// __tests__/components/CallList.test.tsx
import { render, screen } from '@testing-library/react';
import { CallList } from '@/components/CallList';

describe('CallList', () => {
  it('通話一覧を表示する', () => {
    const calls = [
      { id: '1', caller_number: '090-1234-5678', status: 'connected' }
    ];

    render(<CallList calls={calls} />);

    expect(screen.getByText('090-1234-5678')).toBeInTheDocument();
    expect(screen.getByText('connected')).toBeInTheDocument();
  });

  it('空の場合メッセージを表示する', () => {
    render(<CallList calls={[]} />);

    expect(screen.getByText('通話データがありません')).toBeInTheDocument();
  });
});
```

### バックエンド

**ツール**: Jest + Supertest

```typescript
// __tests__/api/calls.test.ts
import request from 'supertest'
import app from '@/app'

describe('GET /api/calls', () => {
  it('認証されたユーザーの通話一覧を返す', async () => {
    const response = await request(app)
      .get('/api/calls')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200)

    expect(response.body.success).toBe(true)
    expect(Array.isArray(response.body.data.items)).toBe(true)
  })

  it('未認証の場合401を返す', async () => {
    await request(app).get('/api/calls').expect(401)
  })
})
```

---

## 統合テスト

### API統合テスト

```typescript
// __tests__/integration/call-processing.test.ts
describe('通話処理フロー', () => {
  it('Zoom Webhook受信から通知までの一連の流れ', async () => {
    // 1. Webhook受信
    const webhookResponse = await request(app)
      .post('/webhook/zoom')
      .send(mockZoomWebhookPayload)
      .expect(200)

    // 2. 通話データ保存確認
    const call = await supabase
      .from('calls')
      .select('*')
      .eq('zoom_call_id', mockZoomWebhookPayload.payload.object.uuid)
      .single()

    expect(call.data).toBeDefined()

    // 3. フィードバック生成確認
    expect(call.data.feedback_text).toBeDefined()

    // 4. Slack通知確認（モック）
    expect(mockSlackWebhook).toHaveBeenCalledTimes(1)
  })
})
```

---

## E2Eテスト

**ツール**: Playwright

```typescript
// e2e/call-details.spec.ts
import { test, expect } from '@playwright/test'

test('通話詳細ページの表示と操作', async ({ page }) => {
  // 1. ログイン
  await page.goto('/login')
  await page.fill('input[name="email"]', 'test@example.com')
  await page.fill('input[name="password"]', 'password')
  await page.click('button[type="submit"]')

  // 2. 通話一覧へ移動
  await page.click('a[href="/calls"]')
  await expect(page).toHaveURL('/calls')

  // 3. 通話詳細ページへ
  await page.click('tr:first-child a')
  await expect(page.locator('h1')).toContainText('通話詳細')

  // 4. 音声再生ボタン確認
  const playButton = page.locator('button[aria-label="再生"]')
  await expect(playButton).toBeVisible()

  // 5. トークスクリプト分析確認
  await expect(page.locator('text=総合一致率')).toBeVisible()

  // 6. フィードバック確認
  await expect(page.locator('[data-testid="feedback"]')).toBeVisible()
})
```

---

## パフォーマンステスト

**ツール**: k6

```javascript
// performance/load-test.js
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '1m', target: 10 }, // Ramp up
    { duration: '3m', target: 100 }, // Stay at 100 users
    { duration: '1m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95%のリクエストが500ms以内
    http_req_failed: ['rate<0.01'], // エラー率1%未満
  },
}

export default function () {
  const url = 'https://api.yourapp.com/api/calls'
  const params = {
    headers: {
      Authorization: `Bearer ${__ENV.API_TOKEN}`,
    },
  }

  const response = http.get(url, params)

  check(response, {
    'status is 200': r => r.status === 200,
    'response time < 500ms': r => r.timings.duration < 500,
  })

  sleep(1)
}
```

実行:

```bash
k6 run --vus 100 --duration 5m performance/load-test.js
```

---

## セキュリティテスト

### 脆弱性スキャン

```bash
# 依存関係スキャン
pnpm audit

# OWASP ZAP
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://app.yourapp.com
```

### ペネトレーションテスト

- **実施頻度**: 四半期ごと
- **対象**: 本番環境（事前通知あり）
- **スコープ**: OWASP Top 10

---

## テストカバレッジ目標

| レイヤー       | カバレッジ目標       |
| -------------- | -------------------- |
| ユニットテスト | 80%以上              |
| 統合テスト     | 主要フロー100%       |
| E2Eテスト      | クリティカルパス100% |

### カバレッジ確認

```bash
# フロントエンド
pnpm test:coverage

# バックエンド
pnpm test:coverage

# レポート生成
open coverage/lcov-report/index.html
```

---

## CI/CDでのテスト実行

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - name: Run unit tests
        run: pnpm test:coverage

  e2e-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run E2E tests
        run: pnpm test:e2e
```

---

## テストデータ管理

### Fixtures

```typescript
// __tests__/fixtures/calls.ts
export const mockCall = {
  id: 'test-call-1',
  zoom_call_id: 'zoom123',
  direction: 'outbound',
  duration_seconds: 245,
  status: 'connected',
  overall_match_rate: 76.5,
  // ...
}

export const mockCalls = [mockCall /* ... */]
```

### テストデータベース

```bash
# テスト用Supabaseローカル起動
supabase start

# テストデータ投入
psql $DATABASE_URL -f __tests__/fixtures/seed.sql
```

---

**以上**
