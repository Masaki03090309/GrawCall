-- Fix project_members RLS SELECT policy
-- Issue: Users could only see their own membership, not other members in the same project
-- Fix: Allow users to see all members in projects they belong to

DROP POLICY IF EXISTS "project_members_select" ON project_members;

CREATE POLICY "project_members_select"
ON project_members FOR SELECT
USING (
  -- User's own membership
  auth.uid() = user_id
  OR
  -- User is a member of the same project (can see other members)
  EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = project_members.project_id
    AND pm.user_id = auth.uid()
  )
  OR
  -- User is a director of this project
  is_director(project_id)
  OR
  -- User is an owner
  is_owner()
);
