-- Remove user_id condition from calls RLS policy
-- Only use zoom_user_id for access control
-- This allows calls to be transferred when zoom_user_id is reassigned

-- Drop existing policy
DROP POLICY IF EXISTS "calls_select" ON calls;

-- Create new policy with ONLY zoom_user_id (no user_id check)
CREATE POLICY "calls_select"
ON calls FOR SELECT
USING (
  -- User can see calls with their zoom_user_id
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.zoom_user_id = calls.zoom_user_id
      AND calls.zoom_user_id IS NOT NULL
  )
  OR
  -- Directors can see calls from their project members (by zoom_user_id)
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
  -- Owners can see all calls
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- Also update the UPDATE policy (remove user_id condition)
DROP POLICY IF EXISTS "calls_update_own" ON calls;

CREATE POLICY "calls_update_own"
ON calls FOR UPDATE
USING (
  -- User can update calls with their zoom_user_id
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.zoom_user_id = calls.zoom_user_id
      AND calls.zoom_user_id IS NOT NULL
  )
  OR
  -- Directors can update calls from their project members
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
  -- Owners can update all calls
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'owner'
  )
);

-- Add comment explaining the design decision
COMMENT ON POLICY "calls_select" ON calls IS
'Access based ONLY on zoom_user_id, not user_id. This allows calls to be transferred when zoom_user_id is reassigned to a different user. Directors can see calls from their project members zoom_user_ids.';
