-- ============================================
-- RLS無限再帰エラー修正スクリプト
-- ============================================
--
-- 実行方法:
-- 1. Supabase Dashboard を開く
-- 2. SQL Editor を選択
-- 3. このファイルの内容をコピー&ペースト
-- 4. Run ボタンをクリック
--
-- ============================================

-- Step 1: 既存の問題のあるポリシーを削除
DROP POLICY IF EXISTS "オーナーは全ユーザーを閲覧・編集可能" ON public.users;
DROP POLICY IF EXISTS "ユーザーは自分の情報を閲覧可能" ON public.users;

-- Step 2: 既存の関数があれば削除
DROP FUNCTION IF EXISTS public.is_owner();

-- Step 3: SECURITY DEFINERを使用した関数を作成（無限再帰を回避）
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- 現在のユーザーのロールを取得
  SELECT role INTO user_role
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;

  -- ownerかどうかを返す
  RETURN COALESCE(user_role = 'owner', FALSE);
END;
$$;

-- Step 4: 新しいポリシーを作成
-- ユーザーは自分の情報を閲覧可能、またはオーナーは全員閲覧可能
CREATE POLICY "ユーザーは自分の情報を閲覧可能"
ON public.users
FOR SELECT
USING (
  auth.uid() = id
  OR
  public.is_owner()
);

-- オーナーは全ユーザーを編集・削除可能
CREATE POLICY "オーナーは全ユーザーを編集可能"
ON public.users
FOR UPDATE
USING (public.is_owner());

CREATE POLICY "オーナーは全ユーザーを削除可能"
ON public.users
FOR DELETE
USING (public.is_owner());

CREATE POLICY "オーナーは新規ユーザーを作成可能"
ON public.users
FOR INSERT
WITH CHECK (public.is_owner());

-- Step 5: 関数の実行権限を付与
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner() TO anon;

-- Step 6: 確認用クエリ（結果を確認してください）
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- 関数が正しく作成されたか確認
SELECT
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'is_owner';

-- 完了メッセージ
SELECT 'RLSポリシー修正完了！ページをリロードしてください。' AS message;
