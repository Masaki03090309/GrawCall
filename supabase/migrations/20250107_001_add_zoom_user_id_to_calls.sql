-- Add zoom_user_id column to calls table for dynamic user lookup
-- This allows calls to be associated with Zoom IDs rather than fixed user_ids
-- When a user's zoom_user_id changes, the call history will reflect the new user

ALTER TABLE calls
ADD COLUMN IF NOT EXISTS zoom_user_id TEXT;

-- Add index for performance when filtering by zoom_user_id
CREATE INDEX IF NOT EXISTS idx_calls_zoom_user_id ON calls(zoom_user_id);

-- Add comment explaining the design decision
COMMENT ON COLUMN calls.zoom_user_id IS 'Zoom User ID from webhook payload. Used for dynamic user lookup. When user assignment changes, call history will reflect current user with this Zoom ID.';

-- Update existing calls to populate zoom_user_id from users table
-- This migrates existing data to the new approach
UPDATE calls
SET zoom_user_id = users.zoom_user_id
FROM users
WHERE calls.user_id = users.id
  AND calls.zoom_user_id IS NULL
  AND users.zoom_user_id IS NOT NULL;
