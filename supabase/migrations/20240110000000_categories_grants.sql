-- カテゴリ管理画面に一覧が出ない件への対処。
--
-- RLSポリシーだけではテーブルにアクセスできない。PostgREST が使う
-- authenticated ロールに、テーブルそのものの権限が必要。
-- Supabase では通常デフォルト権限で自動付与されるが、SQL Editor から
-- 作成した場合に付かないことがあるため明示的に与える。
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_rules TO authenticated;

-- 削除用の関数も authenticated から呼べるようにする
GRANT EXECUTE ON FUNCTION public.delete_category(TEXT, TEXT) TO authenticated;

-- PostgREST はスキーマ情報をキャッシュしており、新しいテーブルを
-- SQL で作った直後は「存在しない」と返すことがある。再読み込みさせる。
NOTIFY pgrst, 'reload schema';
