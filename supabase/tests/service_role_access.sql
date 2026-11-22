-- CI用: Edge Function（add-video）が実際に投げるクエリを service_role で実行し、
-- テーブル権限が揃っているかを検証する。
--
-- service_role は RLS を素通りするが、テーブルの GRANT は別途必要。
-- authenticated_access.sql だけでは画面側の権限しか見ておらず、
-- Edge Function が categories を読めない状態（画面で追加したカテゴリが
-- 保存時に「その他」になる不具合）を見逃していた。

\set ON_ERROR_STOP on
SET client_min_messages = NOTICE;

CREATE OR REPLACE FUNCTION pg_temp.expect(cond BOOLEAN, label TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF cond THEN
    RAISE NOTICE 'ok   %', label;
  ELSE
    RAISE EXCEPTION 'FAIL %', label;
  END IF;
END $$;

-- 画面から追加したカテゴリを想定（コード内の FALLBACK_CATEGORIES には無いもの）
INSERT INTO public.categories (name, sort_order, color_key, definition)
VALUES ('CI画面追加カテゴリ', 9500, 'gray-600', 'CI用')
ON CONFLICT (name) DO NOTHING;

SET ROLE service_role;

-- ── add-video の fetchCategories / fetchRules と同じクエリ ──
SELECT pg_temp.expect(
  EXISTS (SELECT 1 FROM public.categories WHERE name = 'CI画面追加カテゴリ'),
  'service_role が画面で追加したカテゴリを読める');

SELECT pg_temp.expect(
  (SELECT count(*) FROM (
     SELECT name, definition FROM public.categories ORDER BY sort_order) x) > 0,
  'add-video のカテゴリ取得クエリが通る');

SELECT pg_temp.expect(
  (SELECT count(*) FROM (
     SELECT title, body FROM public.category_rules ORDER BY sort_order) x) >= 0,
  'add-video の判断ルール取得クエリが通る');

-- ── 重複チェックと few-shot 例の取得 ──
SELECT pg_temp.expect(
  (SELECT count(*) FROM public.videos) >= 0,
  'service_role が動画を読める');

-- ── 保存: 画面で追加したカテゴリで動画を登録できる ──
INSERT INTO public.videos (youtube_id, title, category, rating)
VALUES ('citestsvcrA', 'CI用(service_role)', 'CI画面追加カテゴリ', 7);
SELECT pg_temp.expect(
  (SELECT category FROM public.videos WHERE youtube_id = 'citestsvcrA') = 'CI画面追加カテゴリ',
  '画面で追加したカテゴリのまま動画を保存できる');

-- 存在しないカテゴリは外部キーが弾く（Edge Function が一覧を取れなかったときの安全網）
DO $$
BEGIN
  INSERT INTO public.videos (youtube_id, title, category)
  VALUES ('citestsvcrB', 'CI用(不正カテゴリ)', '存在しないカテゴリ');
  RAISE EXCEPTION 'FAIL 存在しないカテゴリが保存できてしまった';
EXCEPTION WHEN foreign_key_violation THEN
  RAISE NOTICE 'ok   存在しないカテゴリは外部キーで拒否される';
END $$;

RESET ROLE;

-- 後片付け
DELETE FROM public.videos WHERE youtube_id IN ('citestsvcrA', 'citestsvcrB');
DELETE FROM public.categories WHERE name = 'CI画面追加カテゴリ';
