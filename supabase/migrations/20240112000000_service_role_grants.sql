-- Edge Function（add-video）が使う service_role にテーブル権限を付与する。
--
-- service_role は RLS を素通りできる（BYPASSRLS）が、テーブルそのものの
-- GRANT は別途必要。categories / category_rules を作成した際に付与しておらず、
-- Edge Function はカテゴリ一覧と判断ルールを一度も読めていなかった。
-- その結果、画面で追加したカテゴリ（例: 通信業界）を選んでも、保存時に
-- コード内の古い一覧と照合されて「その他」に書き換えられていた。
--
-- videos / files は本番では既に権限が付いているが、マイグレーションだけで
-- 同じ状態を再現できるよう明示する（20240111 と同じ方針）。
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories     TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_rules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos         TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.files          TO service_role;

GRANT EXECUTE ON FUNCTION public.delete_category(TEXT, TEXT)  TO service_role;
GRANT EXECUTE ON FUNCTION public.search_videos(text[], int)   TO service_role;

NOTIFY pgrst, 'reload schema';
