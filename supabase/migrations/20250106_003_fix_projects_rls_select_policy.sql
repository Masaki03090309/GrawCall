-- Fix projects RLS SELECT policy
-- Issue: Was comparing project_members.project_id with project_members.id (wrong column)
-- Fix: Compare with projects.id instead

DROP POLICY IF EXISTS "projects_select" ON projects;

CREATE POLICY "projects_select"
ON projects FOR SELECT
USING (
  -- User is a member of this project
  auth.uid() IN (
    SELECT user_id
    FROM project_members
    WHERE project_id = projects.id
  )
  OR
  -- User is an owner (can see all projects)
  is_owner()
);
