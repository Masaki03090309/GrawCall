-- Fix prompts RLS policies to avoid infinite recursion
-- Issue: is_director() function queries project_members, causing circular dependency
-- Fix: Replace is_director() calls with direct EXISTS queries using SECURITY DEFINER bypass

-- Drop existing policies
DROP POLICY IF EXISTS "プロンプト作成（ディレクター以上）" ON prompts;
DROP POLICY IF EXISTS "プロンプト更新（ディレクター以上）" ON prompts;
DROP POLICY IF EXISTS "プロンプト削除（ディレクター以上）" ON prompts;
DROP POLICY IF EXISTS "プロンプト閲覧（メンバー以上）" ON prompts;

-- Create: Directors can create project prompts, Owners can create system defaults
CREATE POLICY "プロンプト作成（ディレクター以上）"
ON prompts FOR INSERT
WITH CHECK (
  -- Owner can create system defaults (project_id = NULL)
  (project_id IS NULL AND is_owner())
  OR
  -- Director/Owner can create project-specific prompts
  -- Use direct query instead of is_director() to avoid recursion
  (project_id IS NOT NULL AND (
    is_owner()
    OR
    EXISTS (
      SELECT 1
      FROM project_members pm
      WHERE pm.project_id = prompts.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'director'
    )
  ))
);

-- Update: Directors can update project prompts, Owners can update system defaults
CREATE POLICY "プロンプト更新（ディレクター以上）"
ON prompts FOR UPDATE
USING (
  -- Owner can update system defaults
  (project_id IS NULL AND is_owner())
  OR
  -- Director/Owner can update project-specific prompts
  (project_id IS NOT NULL AND (
    is_owner()
    OR
    EXISTS (
      SELECT 1
      FROM project_members pm
      WHERE pm.project_id = prompts.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'director'
    )
  ))
);

-- Delete: Directors can delete project prompts, Owners can delete system defaults
CREATE POLICY "プロンプト削除（ディレクター以上）"
ON prompts FOR DELETE
USING (
  -- Owner can delete system defaults
  (project_id IS NULL AND is_owner())
  OR
  -- Director/Owner can delete project-specific prompts
  (project_id IS NOT NULL AND (
    is_owner()
    OR
    EXISTS (
      SELECT 1
      FROM project_members pm
      WHERE pm.project_id = prompts.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'director'
    )
  ))
);

-- SELECT: Allow viewing system defaults and project prompts
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
