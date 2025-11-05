-- Add zoom_user_id column to users table for Zoom Phone integration
-- This allows automatic user identification from Zoom webhook data

ALTER TABLE users
ADD COLUMN zoom_user_id VARCHAR(255) UNIQUE;

-- Add index for fast lookup
CREATE INDEX idx_users_zoom_user_id ON users(zoom_user_id);

-- Add comment
COMMENT ON COLUMN users.zoom_user_id IS 'Zoom User ID for automatic call assignment';
