-- Fix users RLS SELECT policy to allow viewing project members
-- Issue: Directors and users cannot see other members' info in the same project
-- Fix: Allow users to see info of members in the same projects they belong to

DROP POLICY IF EXISTS "ユーザーは自分の情報を閲覧可能" ON users;

CREATE POLICY "ユーザーは自分の情報を閲覧可能"
ON users FOR SELECT
USING (
  -- User's own information
  auth.uid() = id
  OR
  -- User is an owner (can see all users)
  is_owner()
  OR
  -- User is in the same project as this user
  EXISTS (
    SELECT 1
    FROM project_members pm1
    INNER JOIN project_members pm2 ON pm1.project_id = pm2.project_id
    WHERE pm1.user_id = auth.uid()
    AND pm2.user_id = users.id
  )
);
