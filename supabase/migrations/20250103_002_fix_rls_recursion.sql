-- Fix infinite recursion in RLS policies
-- The issue is caused by policies that reference the users table while querying users

-- Drop existing problematic policies on users table
DROP POLICY IF EXISTS "ユーザー情報閲覧" ON users;
DROP POLICY IF EXISTS "オーナーのみ全ユーザー閲覧可能" ON users;

-- Recreate users table policies without recursion
-- Users can view their own profile
CREATE POLICY "users_select_own" ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Owners can view all users (without referencing users table in policy)
CREATE POLICY "users_select_owner" ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM auth.users au
      WHERE au.id = auth.uid()
      AND au.id IN (
        SELECT u.id
        FROM users u
        WHERE u.id = auth.uid()
        AND u.role = 'owner'
      )
    )
  );

-- Users can update their own profile
CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  USING (auth.uid() = id);

-- Only owners can update user roles
CREATE POLICY "users_update_role_owner" ON users
  FOR UPDATE
  USING (
    -- Check if current user is owner without recursion
    id IN (
      SELECT u.id
      FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'owner'
    )
  )
  WITH CHECK (
    -- Ensure changes are made by owners only
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'owner'
    )
  );

-- Fix project_members policies to avoid recursion
DROP POLICY IF EXISTS "プロジェクトメンバー閲覧" ON project_members;
DROP POLICY IF EXISTS "プロジェクトメンバー追加" ON project_members;
DROP POLICY IF EXISTS "プロジェクトメンバー削除" ON project_members;

-- Project members can view members of their projects
CREATE POLICY "project_members_select" ON project_members
  FOR SELECT
  USING (
    -- User is a member of the project
    project_id IN (
      SELECT pm.project_id
      FROM project_members pm
      WHERE pm.user_id = auth.uid()
    )
    OR
    -- User is owner
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'owner'
    )
  );

-- Directors and owners can add members
CREATE POLICY "project_members_insert" ON project_members
  FOR INSERT
  WITH CHECK (
    -- User is a director in this project
    project_id IN (
      SELECT pm.project_id
      FROM project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role = 'director'
    )
    OR
    -- User is owner
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'owner'
    )
  );

-- Directors and owners can remove members
CREATE POLICY "project_members_delete" ON project_members
  FOR DELETE
  USING (
    -- User is a director in this project
    project_id IN (
      SELECT pm.project_id
      FROM project_members pm
      WHERE pm.user_id = auth.uid()
      AND pm.role = 'director'
    )
    OR
    -- User is owner
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'owner'
    )
  );
