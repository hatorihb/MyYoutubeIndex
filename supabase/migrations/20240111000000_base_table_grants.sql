-- videos / files にも authenticated の権限を明示的に付与する。
--
-- 本番では Supabase のデフォルト権限で既に付いているため、これを流しても
-- 動作は変わらない。ただしマイグレーションだけでは同じ状態を再現できず、
-- CI やプロジェクトを作り直した場合に「権限が無い」状態になってしまうため、
-- スキーマ定義を自己完結させる目的で明示する。
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.files  TO authenticated;

GRANT EXECUTE ON FUNCTION public.search_videos(text[], int) TO authenticated;

NOTIFY pgrst, 'reload schema';
