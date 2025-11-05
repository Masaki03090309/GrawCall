# 技術実装ガイドライン

**バージョン**: 1.0.0
**作成日**: 2025-01-15
**対象システム**: Zoom Phone フィードバックシステム 拡張版

---

## 目次

1. [コーディング規約](#コーディング規約)
2. [TypeScript実装ガイド](#typescript実装ガイド)
3. [Next.js実装パターン](#nextjs実装パターン)
4. [Supabase連携ガイド](#supabase連携ガイド)
5. [OpenAI API連携ガイド](#openai-api連携ガイド)
6. [GCS連携ガイド](#gcs連携ガイド)
7. [エラーハンドリング](#エラーハンドリング)
8. [セキュリティベストプラクティス](#セキュリティベストプラクティス)
9. [テスト戦略](#テスト戦略)
10. [パフォーマンス最適化](#パフォーマンス最適化)

---

## コーディング規約

### 命名規則

```typescript
// ファイル名: kebab-case
// talk-script-analysis.ts
// user-management.tsx

// コンポーネント: PascalCase
function CallDetailPage() {}
const TalkScriptEditor = () => {}

// 関数・変数: camelCase
const getUserProjects = async () => {}
let isAuthenticated = false

// 定数: UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const OPENAI_MODEL = 'gpt-5'

// 型・インターフェース: PascalCase
interface User {
  id: string
  email: string
}

type CallStatus = 'connected' | 'reception' | 'no_conversation'

// プライベートメソッド: _camelCase
class CallProcessor {
  private _validateInput() {}
}
```

### インポート順序

```typescript
// 1. React関連
import React, { useState, useEffect } from 'react'

// 2. Next.js関連
import { useRouter } from 'next/navigation'
import Image from 'next/image'

// 3. 外部ライブラリ
import { z } from 'zod'
import { useForm } from 'react-hook-form'

// 4. 内部モジュール（絶対パス）
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'

// 5. 相対パス
import { CallList } from './call-list'
import type { Call } from './types'

// 6. スタイル
import './styles.css'
```

### コメント規約

````typescript
/**
 * 通話データを処理する関数
 *
 * @param callId - Zoom Call ID
 * @param audioBuffer - 音声データバッファ
 * @returns 処理結果
 * @throws {Error} 音声ダウンロード失敗時
 *
 * @example
 * ```typescript
 * const result = await processCall('zoom123', audioBuffer)
 * console.log(result.feedback)
 * ```
 */
async function processCall(callId: string, audioBuffer: Buffer) {
  // TODO: エラーハンドリング改善
  // FIXME: リトライロジック追加
  // NOTE: Whisper APIのレート制限に注意
}
````

---

## TypeScript実装ガイド

### 型安全性の徹底

```typescript
// ❌ 悪い例
function getCall(id: any): any {
  return calls.find(c => c.id === id)
}

// ✅ 良い例
interface Call {
  id: string
  project_id: string
  status: CallStatus
  duration_seconds: number
  feedback_text?: string
}

function getCall(id: string): Call | undefined {
  return calls.find(c => c.id === id)
}
```

### Zod バリデーション

```typescript
import { z } from 'zod'

// スキーマ定義
const CreateProjectSchema = z.object({
  name: z.string().min(1, '必須項目です').max(255, '255文字以内で入力してください'),
  slack_webhook_url: z.string().url('有効なURLを入力してください').optional(),
})

// 型抽出
type CreateProjectInput = z.infer<typeof CreateProjectSchema>

// バリデーション実行
async function createProject(input: unknown) {
  const validatedInput = CreateProjectSchema.parse(input)
  // validatedInput は CreateProjectInput 型として安全に使用可能
}
```

### Utility Types活用

```typescript
// Partial: すべてのプロパティをオプション化
type UpdateUserInput = Partial<User>

// Pick: 特定のプロパティのみ抽出
type UserCredentials = Pick<User, 'email' | 'password'>

// Omit: 特定のプロパティを除外
type UserWithoutPassword = Omit<User, 'password'>

// Required: すべてのプロパティを必須化
type CompleteCall = Required<Call>

// Record: キーと値の型を指定
type PhaseMatchRates = Record<'opening' | 'hearing' | 'proposal' | 'closing', number>
```

---

## Next.js実装パターン

### App Router構造

```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   └── layout.tsx
├── dashboard/
│   └── page.tsx
├── projects/
│   ├── page.tsx
│   └── [id]/
│       ├── page.tsx
│       ├── prompts/
│       │   └── page.tsx
│       ├── talk-scripts/
│       │   └── page.tsx
│       └── learning-materials/
│           └── page.tsx
├── calls/
│   ├── page.tsx
│   └── [id]/
│       └── page.tsx
├── api/
│   ├── auth/
│   ├── projects/
│   ├── prompts/
│   ├── talk-scripts/
│   ├── learning-materials/
│   └── calls/
├── layout.tsx
└── page.tsx
```

### Server Components vs Client Components

```typescript
// ✅ Server Component（デフォルト）
// - データフェッチ
// - サーバーサイドロジック
// - 環境変数へのアクセス
async function ProjectListPage() {
  const projects = await getProjects() // サーバーサイドで実行

  return (
    <div>
      {projects.map(p => <ProjectCard key={p.id} project={p} />)}
    </div>
  )
}

// ✅ Client Component
// - インタラクティブUI
// - useState, useEffect等のHooks使用
// - イベントハンドラー
'use client'

import { useState } from 'react'

function ProjectCreateForm() {
  const [name, setName] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // ...
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

### API Routes実装パターン

```typescript
// app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  slack_webhook_url: z.string().url().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // 1. 認証チェック
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '認証が必要です' } },
        { status: 401 }
      )
    }

    // 2. リクエストボディ取得・バリデーション
    const body = await request.json()
    const validatedData = CreateProjectSchema.parse(body)

    // 3. ビジネスロジック実行
    const { data, error } = await supabase.from('projects').insert(validatedData).select().single()

    if (error) {
      return NextResponse.json(
        { success: false, error: { code: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      )
    }

    // 4. 成功レスポンス
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    // 5. エラーハンドリング
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'バリデーションエラー',
            details: error.errors,
          },
        },
        { status: 422 }
      )
    }

    console.error('Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '内部エラーが発生しました' } },
      { status: 500 }
    )
  }
}
```

### データフェッチパターン

```typescript
// ✅ Server Component でデータフェッチ
async function CallDetailPage({ params }: { params: { id: string } }) {
  const call = await getCall(params.id)

  if (!call) {
    notFound() // Next.js の notFound() を使用
  }

  return <CallDetail call={call} />
}

// ✅ Client Component で TanStack Query 使用
'use client'

import { useQuery } from '@tanstack/react-query'

function CallDetailClient({ id }: { id: string }) {
  const { data: call, isLoading, error } = useQuery({
    queryKey: ['call', id],
    queryFn: () => fetchCall(id)
  })

  if (isLoading) return <LoadingSkeleton />
  if (error) return <ErrorMessage error={error} />
  if (!call) return <NotFound />

  return <CallDetail call={call} />
}
```

---

## Supabase連携ガイド

### クライアント初期化

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}

// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### RLS確認済みクエリパターン

```typescript
// ✅ RLSポリシーが適用される
const { data, error } = await supabase
  .from('calls')
  .select('*')
  .eq('project_id', projectId)
  .order('call_time', { ascending: false })
  .range(0, 19) // ページネーション

// ✅ JOIN時もRLSが適用される
const { data, error } = await supabase
  .from('calls')
  .select(
    `
    *,
    user:users(id, name, email),
    project:projects(id, name)
  `
  )
  .eq('id', callId)
  .single()

// ✅ 集計クエリ
const { count, error } = await supabase
  .from('calls')
  .select('*', { count: 'exact', head: true })
  .eq('project_id', projectId)
  .eq('status', 'connected')
```

### Realtime Subscription

```typescript
'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

function Dashboard() {
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('calls_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calls'
        },
        (payload) => {
          console.log('New call:', payload.new)
          // KPI再計算、UI更新等
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return <div>...</div>
}
```

---

## OpenAI API連携ガイド

### 初期化

```typescript
// lib/openai.ts
import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})
```

### Whisper API（文字起こし）

```typescript
import { openai } from '@/lib/openai'
import fs from 'fs'

async function transcribeAudio(audioPath: string) {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      language: 'ja',
      response_format: 'srt', // または 'json', 'text', 'verbose_json', 'vtt'
    })

    return transcription
  } catch (error) {
    console.error('Whisper API error:', error)
    throw error
  }
}
```

### GPT-5 / GPT-5-mini 連携

```typescript
import { openai } from '@/lib/openai'

/**
 * 重要: GPT-5では temperature, top_p 等のサンプリングパラメータは使用不可
 */
async function analyzeCallStatus(transcript: string) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini', // または 'gpt-5'
      messages: [
        {
          role: 'system',
          content: `通話内容を分析し、以下のいずれかに分類してください:
- connected: 担当者と会話できた
- reception: 受付で止まった
- no_conversation: 留守番電話または応答なし`,
        },
        {
          role: 'user',
          content: transcript,
        },
      ],
      // ❌ temperature: 0.7, // 使用不可！
      // ❌ top_p: 1.0,       // 使用不可！
      // ✅ verbosity: 'low', // GPT-5の新パラメータ（オプション）
      // ✅ reasoning_effort: 'minimal', // GPT-5の新パラメータ（オプション）
    })

    const result = completion.choices[0].message.content
    return result
  } catch (error) {
    if (error.response?.status === 400) {
      console.error('400 Bad Request: temperatureパラメータを使用していないか確認してください')
    }
    throw error
  }
}
```

### Structured Output（JSON Mode）

```typescript
async function analyzeTalkScript(transcript: string, talkScript: TalkScript) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-5',
    messages: [
      {
        role: 'system',
        content: `トークスクリプトと実際の通話内容を比較し、JSON形式で評価してください。`,
      },
      {
        role: 'user',
        content: JSON.stringify({ transcript, talkScript }),
      },
    ],
    response_format: { type: 'json_object' },
  })

  const result = JSON.parse(completion.choices[0].message.content)

  return {
    overall_match_rate: result.overall_match_rate,
    phase_match_rates: result.phase_match_rates,
    hearing_item_coverage: result.hearing_item_coverage,
  }
}
```

### Embedding API（RAG）

```typescript
async function createEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    encoding_format: 'float', // または 'base64'
  })

  return response.data[0].embedding // number[]
}

// バッチ処理
async function createBatchEmbeddings(texts: string[]) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts, // 最大2048個まで
  })

  return response.data.map(d => d.embedding)
}
```

### レート制限対応

```typescript
import pRetry from 'p-retry'

async function callOpenAIWithRetry<T>(
  fn: () => Promise<T>,
  options = { retries: 3 }
): Promise<T> {
  return pRetry(async () => {
    try {
      return await fn()
    } catch (error) {
      if (error.response?.status === 429) {
        // レート制限エラー: リトライ
        throw error
      }
      if (error.response?.status >= 500) {
        // サーバーエラー: リトライ
        throw error
      }
      // その他のエラー: リトライしない
      throw new pRetry.AbortError(error)
    }
  }, options)
}

// 使用例
const result = await callOpenAIWithRetry(() =>
  openai.chat.completions.create({...})
)
```

---

## GCS連携ガイド

### 初期化

```typescript
// lib/gcs.ts
import { Storage } from '@google-cloud/storage'

export const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GCP_KEY_FILE, // または credentials オブジェクト
})

export const bucket = storage.bucket(process.env.GCS_BUCKET_NAME!)
```

### ファイルアップロード

```typescript
import { bucket } from '@/lib/gcs'

async function uploadAudioToGCS(audioBuffer: Buffer, callId: string): Promise<string> {
  const filePath = `calls/${callId}/audio.mp3`
  const file = bucket.file(filePath)

  await file.save(audioBuffer, {
    metadata: {
      contentType: 'audio/mpeg',
      metadata: {
        callId,
        uploadedAt: new Date().toISOString(),
      },
    },
  })

  // 公開URLまたは署名URL返却
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`
  return publicUrl
}
```

### 署名URL生成

```typescript
async function getSignedUrl(filePath: string): Promise<string> {
  const file = bucket.file(filePath)

  const [signedUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000, // 1時間
  })

  return signedUrl
}
```

### ストリームアップロード（大容量対応）

```typescript
import { Readable } from 'stream'

async function uploadStreamToGCS(stream: Readable, filePath: string): Promise<void> {
  const file = bucket.file(filePath)

  return new Promise((resolve, reject) => {
    stream
      .pipe(
        file.createWriteStream({
          metadata: {
            contentType: 'audio/mpeg',
          },
        })
      )
      .on('error', reject)
      .on('finish', resolve)
  })
}
```

---

## エラーハンドリング

### カスタムエラークラス

```typescript
// lib/errors.ts

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, 422, details)
    this.name = 'ValidationError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = '認証が必要です') {
    super('UNAUTHORIZED', message, 401)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message = '権限がありません') {
    super('FORBIDDEN', message, 403)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'リソースが見つかりません') {
    super('NOT_FOUND', message, 404)
    this.name = 'NotFoundError'
  }
}
```

### エラーハンドリングパターン

```typescript
// API Route
export async function POST(request: NextRequest) {
  try {
    // ビジネスロジック
  } catch (error) {
    // カスタムエラー
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
        { status: error.statusCode }
      )
    }

    // Zodバリデーションエラー
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'バリデーションエラー',
            details: error.errors,
          },
        },
        { status: 422 }
      )
    }

    // 予期しないエラー
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '内部エラーが発生しました',
        },
      },
      { status: 500 }
    )
  }
}
```

### クライアントサイドエラーハンドリング

```typescript
'use client'

import { toast } from 'sonner'

async function handleCreateProject(data: CreateProjectInput) {
  try {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    const result = await response.json()

    if (!result.success) {
      // エラー処理
      toast.error(result.error.message)

      if (result.error.code === 'VALIDATION_ERROR') {
        // バリデーションエラー表示
        setFieldErrors(result.error.details)
      }

      return
    }

    // 成功処理
    toast.success('プロジェクトを作成しました')
    router.push(`/projects/${result.data.id}`)
  } catch (error) {
    console.error('Network error:', error)
    toast.error('ネットワークエラーが発生しました')
  }
}
```

---

## セキュリティベストプラクティス

### 環境変数管理

```typescript
// ✅ 環境変数の型安全な取得
function getEnvVar(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`環境変数 ${key} が設定されていません`)
  }
  return value
}

const SUPABASE_URL = getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
const OPENAI_API_KEY = getEnvVar('OPENAI_API_KEY')

// ❌ クライアント側で機密情報を使わない
// NEXT_PUBLIC_ プレフィックスはクライアントに公開される
const API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY // ❌ 危険！
```

### SQL Injection対策

```typescript
// ✅ Supabaseのパラメータ化クエリ（安全）
const { data } = await supabase.from('calls').select('*').eq('user_id', userId) // 自動的にエスケープされる

// ❌ 生SQL（使用しない）
const { data } = await supabase.rpc('raw_query', {
  query: `SELECT * FROM calls WHERE user_id = '${userId}'`, // ❌ SQL Injection の危険性
})
```

### XSS対策

```typescript
// ✅ React は自動的にエスケープ
function UserName({ name }: { name: string }) {
  return <div>{name}</div> // 自動エスケープ
}

// ❌ dangerouslySetInnerHTML（必要な場合のみ使用）
function RichText({ html }: { html: string }) {
  // XSS対策: DOMPurifyでサニタイズ
  const sanitizedHtml = DOMPurify.sanitize(html)

  return <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
}
```

### CSRF対策

```typescript
// Next.js API Routes は自動的にCSRF対策
// ただし、外部からのリクエストを受ける場合は明示的に検証

import { headers } from 'next/headers'

export async function POST(request: NextRequest) {
  const headersList = headers()
  const origin = headersList.get('origin')

  // オリジン検証
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  }

  // ...
}
```

---

## テスト戦略

### ユニットテスト（Jest）

```typescript
// __tests__/lib/talk-script-analysis.test.ts
import { calculateOverallMatchRate } from '@/lib/talk-script-analysis'

describe('calculateOverallMatchRate', () => {
  it('4フェーズの平均値を計算する', () => {
    const phaseRates = {
      opening: 85,
      hearing: 68,
      proposal: 78,
      closing: 73,
    }

    const result = calculateOverallMatchRate(phaseRates)

    expect(result).toBe(76)
  })

  it('0%のフェーズがあっても正しく計算する', () => {
    const phaseRates = {
      opening: 100,
      hearing: 0,
      proposal: 50,
      closing: 50,
    }

    const result = calculateOverallMatchRate(phaseRates)

    expect(result).toBe(50)
  })
})
```

### 統合テスト（API Route）

```typescript
// __tests__/api/projects.test.ts
import { createMocks } from 'node-mocks-http'
import { POST } from '@/app/api/projects/route'

describe('/api/projects POST', () => {
  it('プロジェクトを作成できる', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      json: async () => ({
        name: 'テストプロジェクト',
        slack_webhook_url: 'https://hooks.slack.com/test',
      }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.name).toBe('テストプロジェクト')
  })

  it('バリデーションエラーを返す', async () => {
    const { req } = createMocks({
      method: 'POST',
      json: async () => ({ name: '' }), // 空文字
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(422)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('VALIDATION_ERROR')
  })
})
```

### E2Eテスト（Playwright）

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

## パフォーマンス最適化

### 画像最適化

```typescript
import Image from 'next/image'

function UserAvatar({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={40}
      height={40}
      className="rounded-full"
      loading="lazy" // 遅延読み込み
      placeholder="blur" // ぼかしプレースホルダー
      blurDataURL="data:image/..." // Base64エンコードされた小さな画像
    />
  )
}
```

### 動的インポート

```typescript
// ✅ 大きなコンポーネントを動的にインポート
import dynamic from 'next/dynamic'

const ChartComponent = dynamic(() => import('@/components/chart'), {
  loading: () => <ChartSkeleton />,
  ssr: false // クライアントサイドのみでレンダリング
})

function Dashboard() {
  return (
    <div>
      <ChartComponent data={data} />
    </div>
  )
}
```

### メモ化

```typescript
'use client'

import { useMemo, useCallback } from 'react'

function CallList({ calls }: { calls: Call[] }) {
  // 高コストな計算をメモ化
  const filteredCalls = useMemo(() => {
    return calls.filter(c => c.status === 'connected')
  }, [calls])

  // コールバックをメモ化
  const handleCallClick = useCallback((callId: string) => {
    router.push(`/calls/${callId}`)
  }, [router])

  return (
    <div>
      {filteredCalls.map(call => (
        <CallCard
          key={call.id}
          call={call}
          onClick={() => handleCallClick(call.id)}
        />
      ))}
    </div>
  )
}
```

### データベースクエリ最適化

```typescript
// ❌ N+1問題
const calls = await supabase.from('calls').select('*')
for (const call of calls.data) {
  const user = await supabase.from('users').select('*').eq('id', call.user_id).single()
  // ...
}

// ✅ JOIN で一度に取得
const { data: calls } = await supabase.from('calls').select(`
    *,
    user:users(id, name, email)
  `)

// ✅ 必要なカラムのみ取得
const { data: calls } = await supabase
  .from('calls')
  .select('id, call_time, status, duration_seconds')
  .eq('project_id', projectId)
```

---

## デバッグツール

### Supabaseデバッグ

```typescript
// デバッグモード有効化
const { data, error } = await supabase.from('calls').select('*').eq('id', callId)

console.log('Query:', supabase.from('calls').select('*').eq('id', callId).toString())
console.log('Data:', data)
console.log('Error:', error)
```

### OpenAI APIデバッグ

```typescript
const completion = await openai.chat.completions.create({
  model: 'gpt-5',
  messages: [...],
  stream: true // ストリーミング有効化
})

for await (const chunk of completion) {
  console.log('Chunk:', chunk.choices[0]?.delta?.content)
}
```

---

**以上**
