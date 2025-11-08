# データベース設計書

**バージョン**: 1.0.0
**作成日**: 2025-01-15
**対象システム**: Zoom Phone フィードバックシステム 拡張版

---

## 目次

1. [概要](#概要)
2. [ER図](#er図)
3. [テーブル定義](#テーブル定義)
4. [インデックス設計](#インデックス設計)
5. [制約とトリガー](#制約とトリガー)
6. [データ保持ポリシー](#データ保持ポリシー)

---

## 概要

### データベース管理システム

- **DBMS**: PostgreSQL 14以上（Supabase）
- **拡張機能**:
  - `uuid-ossp`: UUID生成
  - `pgvector`: ベクトル検索（RAG用）

### 設計方針

- **正規化**: 第3正規形を基本とする
- **スケーラビリティ**: パーティショニング可能な設計
- **セキュリティ**: Row Level Security (RLS) による行レベルアクセス制御

---

## ER図

```
┌─────────────┐
│   users     │
└──────┬──────┘
       │
       ├─────────────────────┐
       │                     │
       ↓                     ↓
┌─────────────┐       ┌──────────────┐
│  projects   │←──────│project_members│
└──────┬──────┘       └──────────────┘
       │
       ├──────┬──────┬──────┬──────┐
       │      │      │      │      │
       ↓      ↓      ↓      ↓      ↓
    prompts  talk_  learning ng_  calls
             scripts materials reasons
                ↓        ↓
         hearing_items  embeddings
```

---

## テーブル定義

### 1. users（ユーザー）

**概要**: システムユーザーの基本情報を管理

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'director', 'user')),

  -- Zoom連携（追加: 2025-01-07）
  zoom_user_id TEXT UNIQUE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_zoom_user_id ON users(zoom_user_id);

-- RLS ポリシー
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ユーザーは自分の情報を閲覧可能"
ON users FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "オーナーは全ユーザーを閲覧・編集可能"
ON users FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  )
);
```

**カラム説明**:
| カラム名 | データ型 | NULL | 説明 |
|---------|---------|------|------|
| id | UUID | NOT NULL | ユーザーID（主キー） |
| email | VARCHAR(255) | NOT NULL | メールアドレス（ユニーク） |
| name | VARCHAR(255) | NULL | ユーザー名 |
| role | VARCHAR(50) | NOT NULL | ロール（owner/director/user） |
| zoom_user_id | TEXT | NULL | Zoom User ID（ユニーク、通話の識別子）※追加: 2025-01-07 |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 |

---

### 2. projects（プロジェクト）

**概要**: プロジェクトの基本情報

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slack_webhook_url TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_projects_name ON projects(name);

-- RLS ポリシー
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ユーザーは所属プロジェクトを閲覧可能"
ON projects FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM project_members
    WHERE project_id = projects.id
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  )
);
```

**カラム説明**:
| カラム名 | データ型 | NULL | 説明 |
|---------|---------|------|------|
| id | UUID | NOT NULL | プロジェクトID |
| name | VARCHAR(255) | NOT NULL | プロジェクト名 |
| slack_webhook_url | TEXT | NULL | Slack通知用WebhookURL |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 |

---

### 3. project_members（プロジェクトメンバー）

**概要**: プロジェクトとユーザーの関連

```sql
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('director', 'user')),

  -- Zoom連携情報
  zoom_user_id VARCHAR(255),
  phone_number VARCHAR(50),

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(project_id, user_id)
);

-- インデックス
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_project_members_zoom ON project_members(zoom_user_id);
CREATE INDEX idx_project_members_phone ON project_members(phone_number);
```

**カラム説明**:
| カラム名 | データ型 | NULL | 説明 |
|---------|---------|------|------|
| id | UUID | NOT NULL | メンバーID |
| project_id | UUID | NOT NULL | プロジェクトID |
| user_id | UUID | NOT NULL | ユーザーID |
| role | VARCHAR(50) | NOT NULL | プロジェクト内ロール（director/user） |
| zoom_user_id | VARCHAR(255) | NULL | Zoom User ID |
| phone_number | VARCHAR(50) | NULL | 電話番号 |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

---

### 4. prompts（プロンプト）

**概要**: フィードバック生成用プロンプトの管理

```sql
CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NULL,
  prompt_type VARCHAR(50) NOT NULL CHECK (prompt_type IN ('connected', 'reception')),
  content TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,

  -- バージョン管理
  created_by UUID REFERENCES users(id),
  change_comment TEXT,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(project_id, prompt_type, version)
);

-- インデックス
CREATE INDEX idx_prompts_project ON prompts(project_id);
CREATE INDEX idx_prompts_active ON prompts(project_id, prompt_type, is_active);
```

**カラム説明**:
| カラム名 | データ型 | NULL | 説明 |
|---------|---------|------|------|
| id | UUID | NOT NULL | プロンプトID |
| project_id | UUID | NULL | プロジェクトID（NULLはデフォルトプロンプト） |
| prompt_type | VARCHAR(50) | NOT NULL | プロンプトタイプ（connected/reception） |
| content | TEXT | NOT NULL | プロンプト本文 |
| version | INT | NOT NULL | バージョン番号 |
| created_by | UUID | NULL | 作成者ユーザーID |
| change_comment | TEXT | NULL | 変更コメント |
| is_active | BOOLEAN | NOT NULL | アクティブフラグ（最新版のみTRUE） |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

---

### 5. talk_scripts（トークスクリプト）

**概要**: プロジェクト別トークスクリプトの管理

```sql
CREATE TABLE talk_scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,

  -- 各フェーズのスクリプト本文
  opening_script TEXT,
  proposal_script TEXT,
  closing_script TEXT,

  -- バージョン管理
  created_by UUID REFERENCES users(id),
  change_comment TEXT,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(project_id, version)
);

-- インデックス
CREATE INDEX idx_talk_scripts_project ON talk_scripts(project_id);
CREATE INDEX idx_talk_scripts_active ON talk_scripts(project_id, is_active);
```

**カラム説明**:
| カラム名 | データ型 | NULL | 説明 |
|---------|---------|------|------|
| id | UUID | NOT NULL | トークスクリプトID |
| project_id | UUID | NOT NULL | プロジェクトID |
| version | INT | NOT NULL | バージョン番号 |
| opening_script | TEXT | NULL | オープニングスクリプト |
| proposal_script | TEXT | NULL | 提案スクリプト |
| closing_script | TEXT | NULL | クロージングスクリプト |
| created_by | UUID | NULL | 作成者ユーザーID |
| change_comment | TEXT | NULL | 変更コメント |
| is_active | BOOLEAN | NOT NULL | アクティブフラグ |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

---

### 6. talk_script_hearing_items（ヒアリング項目）

**概要**: トークスクリプトのヒアリングフェーズ項目

```sql
CREATE TABLE talk_script_hearing_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  talk_script_id UUID REFERENCES talk_scripts(id) ON DELETE CASCADE,

  item_name VARCHAR(255) NOT NULL,
  item_script TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  display_order INT NOT NULL,

  created_at TIMESTAMP DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_talk_script_hearing_items_script ON talk_script_hearing_items(talk_script_id);
CREATE INDEX idx_talk_script_hearing_items_order ON talk_script_hearing_items(talk_script_id, display_order);

-- 制約: is_default=TRUE は talk_script_id ごとに最大1件
CREATE UNIQUE INDEX idx_talk_script_hearing_items_default
ON talk_script_hearing_items(talk_script_id)
WHERE is_default = TRUE;
```

**カラム説明**:
| カラム名 | データ型 | NULL | 説明 |
|---------|---------|------|------|
| id | UUID | NOT NULL | ヒアリング項目ID |
| talk_script_id | UUID | NOT NULL | トークスクリプトID |
| item_name | VARCHAR(255) | NOT NULL | 項目名（例: 予算感） |
| item_script | TEXT | NOT NULL | ヒアリング方法・質問例 |
| is_default | BOOLEAN | NOT NULL | デフォルト項目フラグ（現在の課題のみTRUE） |
| display_order | INT | NOT NULL | 表示順序 |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

---

### 7. learning_materials（学習資料）

**概要**: RAG用学習資料のメタデータ

```sql
CREATE TABLE learning_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  material_type VARCHAR(50) NOT NULL CHECK (material_type IN ('detail', 'case_study')),
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('pdf', 'csv')),
  file_url TEXT NOT NULL,
  file_size_mb DECIMAL(10, 2),

  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_learning_materials_project ON learning_materials(project_id);
CREATE INDEX idx_learning_materials_type ON learning_materials(project_id, material_type);
```

**カラム説明**:
| カラム名 | データ型 | NULL | 説明 |
|---------|---------|------|------|
| id | UUID | NOT NULL | 学習資料ID |
| project_id | UUID | NOT NULL | プロジェクトID |
| material_type | VARCHAR(50) | NOT NULL | 資料タイプ（detail/case_study） |
| file_name | VARCHAR(255) | NOT NULL | ファイル名 |
| file_type | VARCHAR(50) | NOT NULL | ファイルタイプ（pdf/csv） |
| file_url | TEXT | NOT NULL | GCS URL |
| file_size_mb | DECIMAL(10, 2) | NULL | ファイルサイズ（MB） |
| uploaded_by | UUID | NULL | アップロード者ユーザーID |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

---

### 8. learning_material_embeddings（学習資料ベクトル）

**概要**: RAG検索用のベクトルデータ

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE learning_material_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID REFERENCES learning_materials(id) ON DELETE CASCADE,

  chunk_text TEXT NOT NULL,
  embedding VECTOR(1536),

  created_at TIMESTAMP DEFAULT NOW()
);

-- ベクトル検索用インデックス
CREATE INDEX idx_learning_material_embeddings_material ON learning_material_embeddings(material_id);
CREATE INDEX idx_learning_material_embeddings_vector
ON learning_material_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**カラム説明**:
| カラム名 | データ型 | NULL | 説明 |
|---------|---------|------|------|
| id | UUID | NOT NULL | EmbeddingID |
| material_id | UUID | NOT NULL | 学習資料ID |
| chunk_text | TEXT | NOT NULL | テキストチャンク |
| embedding | VECTOR(1536) | NULL | OpenAI Embeddingベクトル |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

---

### 9. calls（通話データ）

**概要**: 通話の詳細情報とAI分析結果

```sql
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  user_id UUID REFERENCES users(id),

  -- Zoom情報
  zoom_call_id VARCHAR(255) UNIQUE NOT NULL,
  zoom_recording_id VARCHAR(255) UNIQUE NOT NULL,
  zoom_user_id TEXT, -- ★ 主要な識別子（Zoom webhook の user_id）※追加: 2025-01-07

  -- 通話情報
  direction VARCHAR(50) CHECK (direction IN ('inbound', 'outbound')),
  caller_number VARCHAR(50),
  callee_number VARCHAR(50),
  duration_seconds INT,
  call_time TIMESTAMP,

  -- ファイルURL
  audio_url TEXT,
  transcript_url TEXT,
  transcript_segments JSONB, -- SRT形式用タイムスタンプ付きセグメント (追加: 2025-01-06)

  -- 判定結果
  status VARCHAR(50) CHECK (status IN ('connected', 'reception', 'no_conversation')),
  status_confidence DECIMAL(5, 2),

  -- フィードバック
  feedback_text TEXT,
  prompt_version_id UUID REFERENCES prompts(id),

  -- トークスクリプト分析
  talk_script_version_id UUID REFERENCES talk_scripts(id),
  overall_match_rate DECIMAL(5, 2),
  phase_match_rates JSONB,
  hearing_item_coverage JSONB,

  -- AI判定
  appointment_gained BOOLEAN,
  appointment_confirmed BOOLEAN DEFAULT FALSE,
  valid_lead BOOLEAN,
  valid_lead_confirmed BOOLEAN DEFAULT FALSE,
  ng_reason_id UUID REFERENCES ng_reasons(id),

  -- 感情分析
  emotion_analysis_url TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_calls_project ON calls(project_id);
CREATE INDEX idx_calls_user ON calls(user_id);
CREATE INDEX idx_calls_zoom_user_id ON calls(zoom_user_id); -- 追加: 2025-01-07
CREATE INDEX idx_calls_time ON calls(call_time);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_zoom_call ON calls(zoom_call_id);
CREATE INDEX idx_calls_zoom_recording ON calls(zoom_recording_id);

-- RLS ポリシー（Zoom User ID ベース）※更新: 2025-01-07
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calls_select"
ON calls FOR SELECT
USING (
  -- ユーザーは自分の zoom_user_id の通話を閲覧
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.zoom_user_id = calls.zoom_user_id
      AND calls.zoom_user_id IS NOT NULL
  )
  OR
  -- ディレクターはプロジェクトメンバーの通話を閲覧（zoom_user_id ベース）
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
  -- オーナーは全通話を閲覧
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  )
);

CREATE POLICY "calls_update_own"
ON calls FOR UPDATE
USING (
  -- ユーザーは自分の zoom_user_id の通話を更新
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.zoom_user_id = calls.zoom_user_id
      AND calls.zoom_user_id IS NOT NULL
  )
  OR
  -- ディレクターはプロジェクトメンバーの通話を更新
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
  -- オーナーは全通話を更新
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- パーティショニング用（将来的に月次パーティション可能）
-- CREATE INDEX idx_calls_partition ON calls(call_time, project_id);
```

**カラム説明**:
| カラム名 | データ型 | NULL | 説明 |
|---------|---------|------|------|
| id | UUID | NOT NULL | 通話ID |
| project_id | UUID | NULL | プロジェクトID（参考情報） |
| user_id | UUID | NULL | ユーザーID（営業担当者、参考情報） |
| zoom_call_id | VARCHAR(255) | NOT NULL | Zoom Call ID |
| zoom_recording_id | VARCHAR(255) | NOT NULL | Zoom Recording ID |
| zoom_user_id | TEXT | NULL | **Zoom User ID（主要な識別子）** - Zoom webhookのuser_id。通話アクセス制御に使用。※追加: 2025-01-07 |
| direction | VARCHAR(50) | NULL | 通話方向（inbound/outbound） |
| caller_number | VARCHAR(50) | NULL | 発信者電話番号 |
| callee_number | VARCHAR(50) | NULL | 着信者電話番号 |
| duration_seconds | INT | NULL | 通話時間（秒） |
| call_time | TIMESTAMP | NULL | 通話日時 |
| audio_url | TEXT | NULL | 音声ファイルURL（GCS） |
| transcript_url | TEXT | NULL | 文字起こしファイルURL（GCS） |
| transcript_segments | JSONB | NULL | SRT形式タイムスタンプ付きセグメント（Whisper API取得） |
| status | VARCHAR(50) | NULL | 通話状態（connected/reception/no_conversation） |
| status_confidence | DECIMAL(5, 2) | NULL | 判定信頼度 |
| feedback_text | TEXT | NULL | フィードバック本文 |
| prompt_version_id | UUID | NULL | 使用プロンプトバージョンID |
| talk_script_version_id | UUID | NULL | 使用トークスクリプトバージョンID |
| overall_match_rate | DECIMAL(5, 2) | NULL | トークスクリプト総合一致率 |
| phase_match_rates | JSONB | NULL | フェーズ別一致率（JSON） |
| hearing_item_coverage | JSONB | NULL | ヒアリング項目カバー状況（JSON） |
| appointment_gained | BOOLEAN | NULL | アポイント獲得（AI判定） |
| appointment_confirmed | BOOLEAN | NOT NULL | アポイント獲得（ユーザー確認済み） |
| valid_lead | BOOLEAN | NULL | 有効リード（AI判定） |
| valid_lead_confirmed | BOOLEAN | NOT NULL | 有効リード（ユーザー確認済み） |
| ng_reason_id | UUID | NULL | NG理由ID |
| emotion_analysis_url | TEXT | NULL | 感情分析グラフデータURL（JSON） |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |
| updated_at | TIMESTAMP | NOT NULL | 更新日時 |

**重要**: `zoom_user_id` が主要な識別子として使用されます。`user_id` と `project_id` は参考情報として保存されますが、アクセス制御には使用されません。詳細は [Zoom User ID Architecture](./zoom_user_id_architecture.md) を参照してください。

**JSONB構造例**:

```json
// transcript_segments (SRT形式タイムスタンプ付きセグメント) - 追加: 2025-01-06
[
  {
    "id": 0,
    "start": 0.0,
    "end": 3.5,
    "text": "こんにちは、株式会社ABCの山田と申します。"
  },
  {
    "id": 1,
    "start": 3.5,
    "end": 7.2,
    "text": "本日はお時間いただきありがとうございます。"
  }
]

// phase_match_rates
{
  "opening": 85,
  "hearing": 68,
  "proposal": 78,
  "closing": 73
}

// hearing_item_coverage
{
  "現在の課題": {
    "covered": true,
    "match_rate": 82
  },
  "予算感": {
    "covered": false,
    "match_rate": 0
  }
}
```

---

### 10. ng_reasons（NG理由）

**概要**: NG理由のマスタデータ

```sql
CREATE TABLE ng_reasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) NULL,

  reason_name VARCHAR(255) NOT NULL,

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_ng_reasons_project ON ng_reasons(project_id);
```

**カラム説明**:
| カラム名 | データ型 | NULL | 説明 |
|---------|---------|------|------|
| id | UUID | NOT NULL | NG理由ID |
| project_id | UUID | NULL | プロジェクトID（NULLは全プロジェクト共通） |
| reason_name | VARCHAR(255) | NOT NULL | NG理由名 |
| created_by | UUID | NULL | 作成者ユーザーID |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

---

### 11. ng_reason_logs（NG理由ログ）

**概要**: NG理由の履歴データ（永久保存）

```sql
CREATE TABLE ng_reason_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  ng_reason_id UUID REFERENCES ng_reasons(id),

  -- 通話削除後も参照できるよう情報を保存
  call_date TIMESTAMP NOT NULL,
  project_id UUID REFERENCES projects(id),
  user_id UUID REFERENCES users(id),
  customer_phone VARCHAR(50),

  ai_confidence DECIMAL(5, 2),
  evidence_text TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_ng_reason_logs_call ON ng_reason_logs(call_id);
CREATE INDEX idx_ng_reason_logs_reason ON ng_reason_logs(ng_reason_id);
CREATE INDEX idx_ng_reason_logs_project ON ng_reason_logs(project_id);
CREATE INDEX idx_ng_reason_logs_date ON ng_reason_logs(call_date);
```

**カラム説明**:
| カラム名 | データ型 | NULL | 説明 |
|---------|---------|------|------|
| id | UUID | NOT NULL | NG理由ログID |
| call_id | UUID | NULL | 通話ID（削除時はNULL） |
| ng_reason_id | UUID | NULL | NG理由ID |
| call_date | TIMESTAMP | NOT NULL | 通話日 |
| project_id | UUID | NULL | プロジェクトID |
| user_id | UUID | NULL | ユーザーID |
| customer_phone | VARCHAR(50) | NULL | 顧客電話番号 |
| ai_confidence | DECIMAL(5, 2) | NULL | AI判定信頼度 |
| evidence_text | TEXT | NULL | 判定根拠 |
| created_at | TIMESTAMP | NOT NULL | 作成日時 |

---

## インデックス設計

### パフォーマンス最適化のための複合インデックス

```sql
-- 通話一覧検索の高速化
CREATE INDEX idx_calls_list_search
ON calls(project_id, call_time DESC, status);

-- KPI集計の高速化
CREATE INDEX idx_calls_kpi
ON calls(project_id, call_time, status, appointment_confirmed, valid_lead_confirmed);

-- NG理由トレンド分析の高速化
CREATE INDEX idx_ng_reason_logs_trend
ON ng_reason_logs(project_id, call_date DESC, ng_reason_id);
```

---

## 制約とトリガー

### 1. updated_at 自動更新トリガー

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 各テーブルに適用
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calls_updated_at
BEFORE UPDATE ON calls
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2. プロンプト/トークスクリプトのバージョン管理トリガー

```sql
-- 新規作成時に is_active=TRUE の既存レコードを FALSE に
CREATE OR REPLACE FUNCTION deactivate_old_versions()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = TRUE THEN
    UPDATE prompts
    SET is_active = FALSE
    WHERE project_id = NEW.project_id
      AND prompt_type = NEW.prompt_type
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deactivate_old_prompts
BEFORE INSERT ON prompts
FOR EACH ROW EXECUTE FUNCTION deactivate_old_versions();

-- talk_scripts にも同様のトリガー
CREATE TRIGGER deactivate_old_talk_scripts
BEFORE INSERT ON talk_scripts
FOR EACH ROW EXECUTE FUNCTION deactivate_old_versions();
```

---

## データ保持ポリシー

### 6ヶ月後に削除されるデータ

```sql
-- Supabase Cron Job で実行
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 毎日午前2時に実行
SELECT cron.schedule(
  'delete-old-calls',
  '0 2 * * *',
  $$
    DELETE FROM calls
    WHERE call_time < NOW() - INTERVAL '6 months';
  $$
);
```

### 永久保存されるデータ

- `ng_reason_logs`: 通話削除後も残る（`call_id` は `ON DELETE SET NULL`）
- `prompts`, `talk_scripts`: 全バージョン永久保存
- `users`, `projects`, `learning_materials`: 手動削除のみ

---

## データ移行スクリプト

### 現行システム（GAS + Google Drive）からの移行

```sql
-- 1. ユーザーデータ移行
INSERT INTO users (id, email, name, role)
SELECT
  uuid_generate_v4(),
  email,
  name,
  CASE
    WHEN is_owner THEN 'owner'
    WHEN is_director THEN 'director'
    ELSE 'user'
  END
FROM legacy_users;

-- 2. プロジェクトデータ移行
INSERT INTO projects (id, name, slack_webhook_url)
SELECT
  uuid_generate_v4(),
  project_name,
  slack_webhook
FROM legacy_projects;

-- 3. 過去の通話データ移行（メタデータのみ）
INSERT INTO calls (
  id, project_id, user_id,
  zoom_call_id, zoom_recording_id,
  direction, caller_number, callee_number,
  duration_seconds, call_time,
  audio_url, transcript_url,
  status, feedback_text,
  created_at
)
SELECT
  uuid_generate_v4(),
  (SELECT id FROM projects WHERE name = legacy_calls.project_name),
  (SELECT id FROM users WHERE email = legacy_calls.user_email),
  legacy_calls.call_id,
  legacy_calls.recording_id,
  legacy_calls.direction,
  legacy_calls.caller,
  legacy_calls.callee,
  legacy_calls.duration,
  legacy_calls.call_time,
  -- Google Drive URL → GCS URLに変換
  replace(legacy_calls.drive_audio_url, 'drive.google.com', 'storage.googleapis.com'),
  replace(legacy_calls.drive_transcript_url, 'drive.google.com', 'storage.googleapis.com'),
  legacy_calls.status,
  legacy_calls.feedback,
  legacy_calls.created_at
FROM legacy_calls;
```

---

**以上**
