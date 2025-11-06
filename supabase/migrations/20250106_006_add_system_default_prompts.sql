-- Add system-wide default prompts feature
-- Allow prompts.project_id to be NULL for system-wide defaults
-- Owner can manage system default prompts from admin screen

-- Step 1: Make project_id nullable
ALTER TABLE prompts ALTER COLUMN project_id DROP NOT NULL;

-- Step 2: Add comment to clarify NULL behavior
COMMENT ON COLUMN prompts.project_id IS 'Project ID. NULL = system-wide default prompt (owner only). Non-NULL = project-specific prompt.';

-- Step 3: Update RLS policies to allow owner to manage system defaults
DROP POLICY IF EXISTS "プロンプト作成（ディレクター以上）" ON prompts;
DROP POLICY IF EXISTS "プロンプト更新（ディレクター以上）" ON prompts;
DROP POLICY IF EXISTS "プロンプト削除（ディレクター以上）" ON prompts;

-- Create: Directors can create project prompts, Owners can create system defaults
CREATE POLICY "プロンプト作成（ディレクター以上）"
ON prompts FOR INSERT
WITH CHECK (
  -- Owner can create system defaults (project_id = NULL)
  (project_id IS NULL AND is_owner())
  OR
  -- Director/Owner can create project-specific prompts
  (project_id IS NOT NULL AND (is_director(project_id) OR is_owner()))
);

-- Update: Directors can update project prompts, Owners can update system defaults
CREATE POLICY "プロンプト更新（ディレクター以上）"
ON prompts FOR UPDATE
USING (
  -- Owner can update system defaults
  (project_id IS NULL AND is_owner())
  OR
  -- Director/Owner can update project-specific prompts
  (project_id IS NOT NULL AND (is_director(project_id) OR is_owner()))
);

-- Delete: Directors can delete project prompts, Owners can delete system defaults
CREATE POLICY "プロンプト削除（ディレクター以上）"
ON prompts FOR DELETE
USING (
  -- Owner can delete system defaults
  (project_id IS NULL AND is_owner())
  OR
  -- Director/Owner can delete project-specific prompts
  (project_id IS NOT NULL AND (is_director(project_id) OR is_owner()))
);

-- Step 4: Update SELECT policy to allow viewing system defaults
DROP POLICY IF EXISTS "プロンプト閲覧（メンバー以上）" ON prompts;

CREATE POLICY "プロンプト閲覧（メンバー以上）"
ON prompts FOR SELECT
USING (
  -- System defaults visible to all authenticated users
  project_id IS NULL
  OR
  -- Project-specific prompts visible to project members
  auth.uid() IN (
    SELECT user_id
    FROM project_members
    WHERE project_id = prompts.project_id
  )
  OR
  -- Owners can see all prompts
  is_owner()
);

-- Step 5: Create initial system default prompts (if not exists)
-- These will serve as fallback when projects don't have custom prompts

-- System default for connected calls (60+ seconds)
INSERT INTO prompts (project_id, prompt_type, content, is_active, created_by, change_comment)
SELECT
  NULL,
  'connected',
  '# 営業通話フィードバック

## 目的
この通話の文字起こしを分析し、営業担当者が改善できるポイントを具体的にフィードバックしてください。

## 分析観点

### 1. ヒアリング力
- 顧客のニーズや課題を十分に引き出せているか
- 適切な質問ができているか
- 顧客の話を遮らず、傾聴できているか

### 2. 提案力
- 顧客の課題に対して適切なソリューションを提案できているか
- 具体的な価値提案ができているか
- 商品・サービスの説明が分かりやすいか

### 3. クロージング力
- 次のアクションを明確にできているか
- アポイント取得に向けた働きかけができているか
- 顧客の関心度を高められているか

## フィードバック形式

以下の形式で出力してください:

**良かった点**
- （具体的な良かった点を2-3個）

**改善点**
- （具体的な改善提案を2-3個、なぜ改善が必要か理由も含める）

**次回に向けたアクション**
- （次の通話で実践すべき具体的なアクション1-2個）',
  true,
  (SELECT id FROM auth.users WHERE email = 'owner@example.com' LIMIT 1),
  'システムデフォルトプロンプトの初期作成'
WHERE NOT EXISTS (
  SELECT 1 FROM prompts WHERE project_id IS NULL AND prompt_type = 'connected'
);

-- System default for reception calls (stopped at reception)
INSERT INTO prompts (project_id, prompt_type, content, is_active, created_by, change_comment)
SELECT
  NULL,
  'reception',
  '# 受付対応フィードバック

## 目的
受付で止まった通話を分析し、突破率を向上させるためのフィードバックを提供してください。

## 分析観点

### 1. オープニング
- 最初の挨拶や名乗りが適切か
- 用件を簡潔に伝えられているか
- 受付担当者の警戒心を和らげる工夫があるか

### 2. ゲートキーパー対応
- 受付の質問に適切に答えられているか
- 決裁者へのつなぎを依頼できているか
- 緊急性や重要性を伝えられているか

### 3. トーク構成
- 論理的で分かりやすい説明ができているか
- 不要な情報で時間を取られていないか

## フィードバック形式

以下の形式で出力してください:

**受付突破のポイント**
- （受付を突破するための具体的なアドバイス2-3個）

**改善すべきトーク**
- （改善が必要な発言や表現、より良い言い換え例）

**次回に向けた戦略**
- （次の架電で試すべき具体的な戦略1-2個）',
  true,
  (SELECT id FROM auth.users WHERE email = 'owner@example.com' LIMIT 1),
  'システムデフォルトプロンプトの初期作成'
WHERE NOT EXISTS (
  SELECT 1 FROM prompts WHERE project_id IS NULL AND prompt_type = 'reception'
);
