-- Fix infinite recursion in users table RLS policies
-- Problem: The policy references users table from within users table policy
-- Solution: Use security definer function to break the recursion

-- Drop existing policies
DROP POLICY IF EXISTS "オーナーは全ユーザーを閲覧・編集可能" ON users;
DROP POLICY IF EXISTS "ユーザーは自分の情報を閲覧可能" ON users;

-- Create a security definer function to check if user is owner
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM users
  WHERE id = auth.uid()
  LIMIT 1;

  RETURN user_role = 'owner';
END;
$$;

-- Recreate policies using the security definer function
CREATE POLICY "ユーザーは自分の情報を閲覧可能"
ON users FOR SELECT
USING (auth.uid() = id OR is_owner());

CREATE POLICY "オーナーは全ユーザーを閲覧・編集可能"
ON users FOR ALL
USING (is_owner());

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner() TO anon;

COMMENT ON FUNCTION public.is_owner IS 'Security definer function to check if current user is an owner. Used to prevent infinite recursion in RLS policies.';
