# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**Zoom Phone フィードバックシステム 拡張版** - An AI-powered feedback system for Zoom Phone call recordings that provides:

1. **トークスクリプト一致率分析** - Semantic matching analysis of actual calls against predefined talk scripts using GPT-5
2. **因果関係を考慮した統合フィードバック** - Causal relationship-based feedback combining talk script analysis, RAG search, NG reason trends, and transcripts
3. **RAG検索による学習資料参照** - Retrieval Augmented Generation using pgvector and OpenAI Embeddings
4. **NG理由永久保存とトレンド分析** - Permanent storage of rejection reasons for long-term trend analysis

**Current Status**: Phase 1 COMPLETED + M2.1 COMPLETED + M2.2 COMPLETED + M2.4 COMPLETED - M1.1 (開発環境構築 + CI/CD設定), M1.2 (データベース構築), M1.3 (認証機能実装), M1.4 (GCS・Cloud Run構築), M1.5 (基本的な通話処理フロー - 統合テスト完了 2025-11-04), M1.6 (プロジェクト・ユーザー管理 + Zoom User ID機能 + 通話一覧/詳細UI + JST表示対応), M2.1 (プロンプト管理UI), M2.2 (プロンプトバージョン管理 + 復元機能 - 完了 2025-01-05), and M2.4 (フィードバック生成実装) all completed. **統合テスト成功**: Zoom Webhook → Cloud Run Proxy → Pub/Sub → Cloud Run Processor → Whisper API → GPT-4o-mini (Status Detection + Feedback Generation) → Supabase保存フロー全て動作確認済み。**CI/CD構築完了**: GitHub Actions自動テスト・デプロイパイプライン実装済み。**Zoom User ID自動紐付け機能追加完了** (2025-11-04)。Development server running on port 7000. Full feedback system operational with AI-powered analysis using GPT-4o-mini. Call list and detail pages with JST timezone support. Prompt version history with restore functionality. Next: M2.3 (AIプロンプトアシスタント) or Phase 3 (トークスクリプト管理).

---

## Documentation Structure

All project documentation is in `docs/`:

- `requirements_specification_v2.md` - Complete requirements (v2.2.0)
- `database_schema.md` - 11-table PostgreSQL schema with RLS policies
- `api_specification.md` - REST API endpoints and formats
- `architecture.md` - System architecture (Next.js + Cloud Run + Supabase)
- `implementation_plan.md` - 7-phase development roadmap (7-10 months)
- `task_breakdown.md` - 200+ detailed tasks with priorities (P0-P3) and estimates (S/M/L/XL/XXL)
- `technical_guidelines.md` - Coding standards and implementation patterns
- `development_setup.md` - Environment setup instructions
- `security_design.md` - OWASP Top 10 countermeasures and RLS policies
- `deployment_guide.md` - Deployment procedures for Vercel/Cloud Run/Supabase
- `testing_strategy.md` - Test pyramid and coverage goals
- `ui_ux_design.md` - Design system and wireframes

**Always consult these documents before implementing features.**

---

## Technology Stack

### Frontend

- Next.js 14 App Router
- TypeScript
- shadcn/ui + Tailwind CSS
- TanStack Query (React Query)
- Zustand (state management)

### Backend

- Cloud Run (Node.js/TypeScript)
- Express.js
- Supabase (PostgreSQL + Auth + Realtime)
- pgvector (RAG implementation)

### AI/ML

- OpenAI Whisper (transcription)
- OpenAI GPT-5 (talk script analysis, RAG-enhanced feedback)
- OpenAI GPT-5-mini (status detection, basic feedback, NG reason classification)
- OpenAI text-embedding-3-small (RAG embeddings)

### Infrastructure

- Google Cloud Storage (audio files, 6-month auto-deletion)
- Cloud Pub/Sub (async processing)
- Vercel (frontend deployment)

---

## Critical GPT-5 Implementation Note

**IMPORTANT**: GPT-5 推論モデルは以下のサンプリングパラメータを**サポートしていません**:

```typescript
// ❌ これらのパラメータは使用不可（400 Bad Request エラー）
temperature: 0.7
top_p: 1.0
presence_penalty: 0.0
frequency_penalty: 0.0
logprobs: true
logit_bias: {...}

// ✅ GPT-5/GPT-5-mini 正しい呼び出し
const completion = await openai.chat.completions.create({
  model: 'gpt-5', // または 'gpt-5-mini'
  messages: [...],
  // temperature等のパラメータは完全に省略
  // オプション: verbosity, reasoning_effort は使用可能
})
```

**理由**: GPT-5は内部で複数ラウンドの推論・検証を実行するため、外部からのサンプリングパラメータは不要。

**参照**: `docs/requirements_specification_v2.md` Section 3.2.2, `docs/technical_guidelines.md` OpenAI API連携ガイド

---

## Architecture Highlights

### Data Flow (通話処理フロー)

```
Zoom Webhook → Cloud Run (Proxy) → Cloud Pub/Sub → Cloud Run (Processor)
  ↓
1. Audio Download → GCS
2. Whisper API → Transcription → GCS
3. Parallel Processing:
   - GPT-5-mini: Status Detection (connected/reception/no_conversation)
   - Audio Analysis: Emotion/frequency analysis
   - RAG Search: pgvector similarity search
   - NG Reason Trends: Aggregate past 1 month
   - GPT-5: Talk Script Semantic Matching
4. Feedback Generation:
   - IF connected AND duration >= 60s:
     - WITH RAG results: GPT-5 (4-factor integrated feedback)
     - WITHOUT RAG: GPT-5-mini (3-factor feedback)
   - ELSE: No feedback (Slack notification only)
5. Save to Supabase + Slack Notification
```

### Database Key Design Patterns

**11 Tables with RLS**:

- `users`, `projects`, `project_members` - User/project management
- `prompts`, `talk_scripts`, `talk_script_hearing_items` - Content management with versioning
- `learning_materials`, `learning_material_embeddings` - RAG implementation
- `calls` - Call data with JSONB fields: `phase_match_rates`, `hearing_item_coverage`
- `ng_reasons`, `ng_reason_logs` - NG reason master + permanent logs (`ON DELETE SET NULL`)

**RLS Pattern**:

```sql
-- Users can only see their own calls, or:
-- Directors see all calls in their projects, or:
-- Owners see all calls
CREATE POLICY "通話アクセス制御" ON calls FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM project_members WHERE ...)
  OR EXISTS (SELECT 1 FROM users WHERE role = 'owner' ...)
);
```

### トークスクリプト因果関係ロジック

**Pattern A: ヒアリング不足が根本原因**

```
IF hearing < 60% AND (proposal < 30% OR closing < 30%)
THEN 根本原因: ヒアリング不足
→ フィードバック重点: ヒアリング力強化、未カバー項目指摘
```

**Pattern B: 提案力不足**

```
IF hearing >= 60% AND proposal < 50%
THEN 根本原因: 提案力不足
→ フィードバック重点: 学習資料活用、価値提案明確化
```

**Pattern C: クロージング不足**

```
IF hearing >= 60% AND proposal >= 60% AND closing < 50%
THEN 根本原因: クロージング不足
→ フィードバック重点: アポイント打診、次回アクション提示
```

**参照**: `docs/requirements_specification_v2.md` Section 4.12

---

## Implementation Phases (7-10 months)

**Phase 1: 基盤構築** (1-2 months) - Infrastructure, auth, basic call processing
**Phase 2: プロンプト管理** (1 month) - Prompt UI, versioning, AI assistant
**Phase 3: トークスクリプト管理** (1 month) - Talk script UI, matching analysis, causal logic
**Phase 4: 学習資料・RAG** (1-2 months) - File upload, embedding, RAG search
**Phase 5: KPI・ダッシュボード** (1 month) - KPI aggregation, charts, NG reason analysis
**Phase 6: 音声感情分析** (1-2 months) - Frequency analysis, emotion graphs
**Phase 7: テスト・改善** (1 month) - E2E tests, performance tuning, production release

**Start Here**: `docs/implementation_plan.md` for detailed milestones, `docs/task_breakdown.md` for 200+ specific tasks.

---

## Development Workflow

### When Implementing Features

1. **Read Requirements**: `docs/requirements_specification_v2.md` for the feature spec
2. **Check Database Schema**: `docs/database_schema.md` for table structure and RLS
3. **Review API Spec**: `docs/api_specification.md` for endpoint design
4. **Follow Coding Standards**: `docs/technical_guidelines.md` for TypeScript/Next.js patterns
5. **Reference Task Breakdown**: `docs/task_breakdown.md` for P0-P3 prioritization and dependencies

### Task Tracking Workflow

**IMPORTANT**: Whenever you complete a task, milestone, or phase, you MUST update the task checklists in the documentation files.

1. **After Completing Each Task**:
   - Open `docs/implementation_plan.md`
   - Find the corresponding task in the checklist
   - Change `- [ ]` to `- [x]` to mark it as completed
   - Commit the documentation update

2. **After Completing a Milestone**:
   - Review all tasks in the milestone section
   - Ensure all completed tasks are marked with `[x]`
   - Update the milestone completion date if tracking
   - Update `docs/task_breakdown.md` if applicable

3. **After Completing a Phase**:
   - Mark all phase completion criteria as `[x]`
   - Update the "Current Status" in CLAUDE.md (line 16)
   - Create a summary of what was accomplished
   - Note any deviations from the original plan

4. **Example of Task Update**:

   ```markdown
   # Before

   - [ ] Next.js 14プロジェクト初期化

   # After

   - [x] Next.js 14プロジェクト初期化
   ```

5. **Documentation Files to Update**:
   - `docs/implementation_plan.md` - Main task checklist (7 phases)
   - `docs/task_breakdown.md` - Detailed 200+ tasks
   - `CLAUDE.md` - Current status (line 16)

**Always keep documentation in sync with actual implementation progress.**

### TypeScript Patterns

**Always use Zod for validation**:

```typescript
import { z } from 'zod'

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  slack_webhook_url: z.string().url().optional(),
})

type CreateProjectInput = z.infer<typeof CreateProjectSchema>
```

**API Route Pattern**:

```typescript
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({...}, { status: 401 })

    const body = await request.json()
    const validated = CreateProjectSchema.parse(body)
    // ... business logic
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', ... }, { status: 422 })
    }
    // ... error handling
  }
}
```

### Supabase Query Patterns

**Always leverage RLS**:

```typescript
// RLS automatically filters based on auth.uid()
const { data } = await supabase
  .from('calls')
  .select('*, user:users(name), project:projects(name)')
  .eq('project_id', projectId)
  .order('call_time', { ascending: false })
```

**RAG Search with pgvector**:

```typescript
const { data } = await supabase.rpc('match_learning_materials', {
  query_embedding: embedding, // from OpenAI Embedding API
  match_threshold: 0.7,
  match_count: 5,
  project_id: projectId,
})
```

---

## Key Constraints

1. **NG Reason Permanent Storage**: `ng_reason_logs.call_id` uses `ON DELETE SET NULL` to preserve NG reason data even after call deletion (6-month retention). This enables long-term trend analysis.

2. **Data Retention Policy**:
   - **6 months then delete**: `calls` table, GCS audio/transcript files (auto-delete via Lifecycle)
   - **Permanent**: `ng_reason_logs`, `prompts`, `talk_scripts`, `learning_materials`

3. **File Upload Limits**:
   - Learning materials: 2 detail PDFs + 5 case study PDFs/CSVs per project
   - Max file size: 10MB
   - Talk script hearing items: Max 10 items (including default "現在の課題")

4. **Feedback Generation Conditions**:

   ```
   IF status == 'connected' AND duration >= 60 seconds:
     Generate feedback (GPT-5 with RAG OR GPT-5-mini without RAG)
   ELSE IF status == 'connected' AND duration < 60 seconds:
     Slack: "つながっただけ" (No feedback)
   ELSE IF status == 'reception':
     Slack: "受付に当たっただけ" (No feedback)
   ELSE IF status == 'no_conversation':
     No Slack notification
   ```

5. **OpenAI API Rate Limits**: Implement retry logic with exponential backoff. See `docs/technical_guidelines.md` for `callOpenAIWithRetry` pattern.

---

## Security Critical Points

1. **Environment Variables**: Never use `NEXT_PUBLIC_` prefix for secrets (OpenAI API keys, Supabase Service Role Key). Client-exposed vars must be non-sensitive.

2. **RLS Enforcement**: All Supabase queries automatically enforce Row Level Security. Test RLS policies for each role (owner/director/user).

3. **GCS Signed URLs**: Generate with 1-hour expiration for audio file access.

4. **Webhook Verification**: Zoom webhook signatures must be verified in Cloud Run Proxy before processing.

---

## Testing Requirements

**Coverage Goals**:

- Unit tests: 80%+
- Integration tests: 100% of critical flows
- E2E tests: 100% of critical user paths

**Test Stack**:

- Jest + React Testing Library (frontend unit)
- Jest + Supertest (backend unit)
- Playwright (E2E)
- k6 (performance/load)

**Reference**: `docs/testing_strategy.md`

---

## When in Doubt

- **Requirements unclear?** → Read `docs/requirements_specification_v2.md` sections 4.10-4.12 for トークスクリプト and 因果関係ロジック
- **Database design question?** → Check `docs/database_schema.md` for RLS policies and JSONB structures
- **API format question?** → See `docs/api_specification.md` for request/response examples
- **How to implement X?** → Consult `docs/technical_guidelines.md` for code patterns
- **What to build next?** → Follow `docs/implementation_plan.md` phase order and `docs/task_breakdown.md` priorities

**All documentation is in Japanese. Code and comments should be in English.**
