# Zoom User ID ベースのアーキテクチャ設計

## 概要

このドキュメントでは、Zoom User ID を基本的な識別子として使用する通話管理システムのアーキテクチャを説明します。

## 設計思想

### 背景

従来の `user_id` ベースの通話管理では、以下の課題がありました：

1. **通話履歴の引き継ぎが困難**
   - ユーザーアカウントが変わると、過去の通話履歴にアクセスできない
   - 新入社員への通話履歴の引き継ぎができない

2. **複数のユーザーが同じ通話を見れる混乱**
   - `user_id` と `zoom_user_id` の両方で判定すると、2人のユーザーが同じ通話を見れる

3. **柔軟な権限管理ができない**
   - 通話の所有権を動的に変更できない

### 解決策

**Zoom User ID を唯一の識別子として使用**

- 通話は `zoom_user_id` で識別される
- `user_id` は参考情報として残すが、アクセス制御には使わない
- Zoom ID の持ち主が変わると、通話の表示も即座に変わる

## データモデル

### calls テーブル

```sql
CREATE TABLE calls (
  id UUID PRIMARY KEY,

  -- 識別子
  zoom_call_id TEXT NOT NULL UNIQUE,
  zoom_recording_id TEXT,
  zoom_user_id TEXT,  -- ★ 主要な識別子（Zoom webhook の user_id）

  -- 参考情報（アクセス制御には使わない）
  user_id UUID REFERENCES users(id),
  project_id UUID REFERENCES projects(id),

  -- 通話データ
  call_time TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER NOT NULL,
  caller_number TEXT,
  callee_number TEXT,
  direction TEXT NOT NULL,
  status TEXT NOT NULL,

  -- 音声・文字起こし
  audio_url TEXT,
  transcript_url TEXT,
  transcript_segments JSONB,

  -- フィードバック
  feedback_text TEXT,
  prompt_version_id UUID,

  -- タイムスタンプ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_calls_zoom_user_id ON calls(zoom_user_id);
CREATE INDEX idx_calls_user_id ON calls(user_id);
CREATE INDEX idx_calls_project_id ON calls(project_id);
```

### users テーブル

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',  -- 'owner', 'director', 'user'
  zoom_user_id TEXT UNIQUE,  -- ★ Zoom User ID（一意制約）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## データフロー

### 1. 通話の記録

```
┌─────────────────────────────────────────────────────────┐
│ Zoom Phone Webhook                                       │
│ {                                                        │
│   user_id: "so7ga6TcSH6gOLafTgMmRA",  ← Zoom User ID   │
│   call_log_id: "...",                                   │
│   recording: { download_url: "..." }                    │
│ }                                                        │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Backend Processor                                        │
│ 1. lookupUserByZoomId(webhook.user_id)                  │
│    → userId (参考情報として保存)                         │
│ 2. getUserProject(userId)                               │
│    → projectId (参考情報として保存)                      │
│ 3. Download & Transcribe                                │
│ 4. Insert call:                                         │
│    - zoom_user_id: webhook.user_id  ★ 主要識別子       │
│    - user_id: userId (参考)                             │
│    - project_id: projectId (参考)                       │
└─────────────────────────────────────────────────────────┘
```

### 2. 通話の閲覧

```
┌─────────────────────────────────────────────────────────┐
│ GET /api/calls?project_id=xxx                           │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ API Route                                                │
│ 1. Get project members                                  │
│    SELECT user_id, users.zoom_user_id                   │
│    FROM project_members                                 │
│    WHERE project_id = xxx                               │
│                                                          │
│ 2. Extract Zoom IDs                                     │
│    memberZoomIds = ["so7ga6TcSH6g...", ...]            │
│                                                          │
│ 3. Query calls by Zoom IDs                             │
│    SELECT * FROM calls                                  │
│    WHERE zoom_user_id IN (memberZoomIds)               │
│                                                          │
│ 4. Dynamic user lookup (for display)                   │
│    For each call:                                       │
│      SELECT id, name, email                             │
│      FROM users                                         │
│      WHERE zoom_user_id = call.zoom_user_id            │
└─────────────────────────────────────────────────────────┘
```

### 3. Zoom ID の付け替え

```
┌─────────────────────────────────────────────────────────┐
│ reassign-zoom-id.js                                      │
│ oldUser: fukasemasaki@fukasemasaki.com                  │
│ newUser: yamada@example.com                             │
│ zoomId: MTW5tkiRRqSnoMfy_n9HJw                          │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 1: Remove from old user                            │
│ UPDATE users                                             │
│ SET zoom_user_id = NULL                                 │
│ WHERE email = 'fukasemasaki@fukasemasaki.com'           │
│                                                          │
│ Step 2: Assign to new user                              │
│ UPDATE users                                             │
│ SET zoom_user_id = 'MTW5tkiRRqSnoMfy_n9HJw'            │
│ WHERE email = 'yamada@example.com'                      │
│                                                          │
│ ★ calls テーブルは変更不要（zoom_user_id は固定）        │
└─────────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Result (immediate)                                       │
│ - Old user: 0 calls visible                             │
│ - New user: 115 calls visible (instantly!)              │
└─────────────────────────────────────────────────────────┘
```

## アクセス制御（RLS）

### RLS ポリシー設計

```sql
CREATE POLICY "calls_select"
ON calls FOR SELECT
USING (
  -- 条件1: 自分の zoom_user_id の通話
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.zoom_user_id = calls.zoom_user_id
      AND calls.zoom_user_id IS NOT NULL
  )
  OR
  -- 条件2: ディレクターはプロジェクトメンバーの通話
  EXISTS (
    SELECT 1 FROM project_members pm_self
    WHERE pm_self.user_id = auth.uid()
      AND pm_self.role IN ('director', 'owner')
      AND EXISTS (
        SELECT 1 FROM project_members pm_other
        INNER JOIN users u ON u.id = pm_other.user_id
        WHERE pm_other.project_id = pm_self.project_id
          AND u.zoom_user_id = calls.zoom_user_id
          AND calls.zoom_user_id IS NOT NULL
      )
  )
  OR
  -- 条件3: オーナーは全通話
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  )
);
```

### アクセス権限マトリクス

| ロール       | 自分の通話 | プロジェクトメンバーの通話 | 全通話 |
| ------------ | ---------- | -------------------------- | ------ |
| **Owner**    | ✅         | ✅                         | ✅     |
| **Director** | ✅         | ✅（所属プロジェクトのみ） | ❌     |
| **User**     | ✅         | ❌                         | ❌     |

**注意**: 「自分の通話」= `users.zoom_user_id = calls.zoom_user_id`

## メリット

### 1. 通話履歴の完全な引き継ぎ

```
【シナリオ】
退職する社員 A の通話履歴を新入社員 B に引き継ぐ

【操作】
node reassign-zoom-id.js A@example.com B@example.com <zoom_id>

【結果】
✅ 社員 B が社員 A の過去の通話履歴をすべて閲覧可能
✅ データベースの通話レコードは変更不要
✅ 即座に反映（遅延なし）
```

### 2. 動的な通話の所有権変更

```
【シナリオ】
テストアカウントで録音した通話を本番アカウントに移行

【操作】
1. テストアカウントの zoom_user_id を null に設定
2. 本番アカウントに同じ zoom_user_id を割り当て

【結果】
✅ 本番アカウントで過去のテスト通話を閲覧可能
✅ 通話データは一切変更しない
```

### 3. プロジェクト通話履歴の自動更新

```
【シナリオ】
プロジェクトメンバーの Zoom ID が変わる

【結果】
✅ プロジェクト通話履歴が自動的に更新される
✅ 新しいメンバーの通話が即座に表示される
✅ 古いメンバーの通話は非表示になる
```

## デメリットと制約

### 1. Zoom ID なしのユーザーは通話を見れない

**問題**:

- Zoom ID を持っていないユーザーは、自分の通話を見れない

**対策**:

- Owner 権限で全通話を閲覧可能
- 必要に応じて Zoom ID を割り当てる

### 2. 通話の二重所有ができない

**問題**:

- 1つの Zoom ID は1人のユーザーにしか割り当てられない
- 複数のユーザーが同じ通話を「自分の通話」として見ることはできない

**対策**:

- ディレクターロールを使ってプロジェクトメンバーの通話を閲覧

### 3. 履歴の追跡が複雑になる

**問題**:

- `user_id` と `zoom_user_id` が異なる場合、誰が実際に通話したか分かりにくい

**対策**:

- `user_id` を参考情報として保持
- 必要に応じて監査ログを追加

## ベストプラクティス

### 1. Zoom ID の付け替えは慎重に

```bash
# 必ず確認してから実行
node reassign-zoom-id.js <old> <new> <zoom_id>
```

### 2. プロジェクトメンバーには Zoom ID を設定

```sql
-- Zoom ID がないメンバーの通話は表示されない
-- プロジェクトに追加する前に Zoom ID を設定すること
```

### 3. Owner アカウントは別途管理

```
Owner アカウント:
- 全通話を閲覧可能（特権）
- 自分の zoom_user_id を持つ必要はない
- 管理用アカウントとして使用
```

## 今後の拡張

### 1. 通話の共有機能

```sql
-- 複数のユーザーが同じ通話を閲覧できるようにする
CREATE TABLE call_shares (
  call_id UUID REFERENCES calls(id),
  user_id UUID REFERENCES users(id),
  shared_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (call_id, user_id)
);
```

### 2. Zoom ID の変更履歴

```sql
-- Zoom ID の付け替え履歴を記録
CREATE TABLE zoom_user_id_history (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  zoom_user_id TEXT NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  removed_at TIMESTAMPTZ
);
```

### 3. 通話のアーカイブ機能

```
6ヶ月経過した通話を自動的にアーカイブ:
- アーカイブ後も zoom_user_id は保持
- 必要に応じて復元可能
```

## 関連ドキュメント

- [Changelog](./changelog.md)
- [Database Schema](./database_schema.md)
- [API Specification](./api_specification.md)
- [Security Design](./security_design.md)
