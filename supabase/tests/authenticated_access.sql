-- CI用: アプリが実際に投げるクエリを authenticated ロールで実行し、
-- 権限（GRANT）と RLS が揃っているかを検証する。
--
-- スーパーユーザーは権限チェックも RLS も素通りするため、
-- マイグレーションを流せたことだけでは「アプリから使える」証明にならない。
-- ここでは必ず SET ROLE authenticated してから確認する。

\set ON_ERROR_STOP on
SET client_min_messages = NOTICE;  -- CI のログに検証項目を出す

CREATE OR REPLACE FUNCTION pg_temp.expect(cond BOOLEAN, label TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF cond THEN
    RAISE NOTICE 'ok   %', label;
  ELSE
    RAISE EXCEPTION 'FAIL %', label;
  END IF;
END $$;

-- 動作確認用の動画を1本用意しておく（RLS の影響を受けない権限で）
INSERT INTO public.videos (youtube_id, title, category, rating)
VALUES ('citestciteA', 'CI用の動画', 'その他', 8)
ON CONFLICT (youtube_id) DO NOTHING;

SET ROLE authenticated;

-- ── 読み取り: App.jsx / CategoryManagerModal が投げるクエリ ──
SELECT pg_temp.expect(
  (SELECT count(*) FROM public.categories) > 0,
  'authenticated がカテゴリを読める');

SELECT pg_temp.expect(
  (SELECT count(*) FROM (
     SELECT name, sort_order, color_key, definition
     FROM public.categories ORDER BY sort_order, name) x) > 0,
  'App.jsx のカテゴリ取得クエリが通る');

SELECT pg_temp.expect(
  (SELECT count(*) FROM (
     SELECT id, sort_order, title, body
     FROM public.category_rules ORDER BY sort_order, id) x) > 0,
  'App.jsx の判断ルール取得クエリが通る');

SELECT pg_temp.expect(
  (SELECT count(*) FROM public.videos) > 0,
  'authenticated が動画を読める');

-- ── 書き込み: カテゴリ管理画面の操作 ──
INSERT INTO public.categories (name, sort_order, color_key, definition)
VALUES ('CIテスト', 9000, 'gray-600', 'CI用');
SELECT pg_temp.expect(
  EXISTS (SELECT 1 FROM public.categories WHERE name = 'CIテスト'),
  'カテゴリを追加できる');

UPDATE public.categories SET color_key = 'sky-700' WHERE name = 'CIテスト';
SELECT pg_temp.expect(
  (SELECT color_key FROM public.categories WHERE name = 'CIテスト') = 'sky-700',
  'カテゴリの色を変更できる');

-- 改名が videos に波及すること（外部キーの ON UPDATE CASCADE）
UPDATE public.videos SET category = 'CIテスト' WHERE youtube_id = 'citestciteA';
UPDATE public.categories SET name = 'CIテスト改' WHERE name = 'CIテスト';
SELECT pg_temp.expect(
  (SELECT category FROM public.videos WHERE youtube_id = 'citestciteA') = 'CIテスト改',
  '改名が動画側にカスケードする');

-- ── 削除: delete_category RPC ──
SELECT pg_temp.expect(
  public.delete_category('CIテスト改', 'その他') = 1,
  'delete_category が退避件数を返す');
SELECT pg_temp.expect(
  (SELECT category FROM public.videos WHERE youtube_id = 'citestciteA') = 'その他',
  '削除時に動画が「その他」へ退避される');
SELECT pg_temp.expect(
  NOT EXISTS (SELECT 1 FROM public.categories WHERE name = 'CIテスト改'),
  'カテゴリが削除される');

-- ── 判断ルールの編集 ──
INSERT INTO public.category_rules (sort_order, title, body)
VALUES (9000, 'CI / テスト', 'CI用のルール');
UPDATE public.category_rules SET body = '更新後' WHERE title = 'CI / テスト';
SELECT pg_temp.expect(
  (SELECT body FROM public.category_rules WHERE title = 'CI / テスト') = '更新後',
  'ルールを追加・編集できる');
DELETE FROM public.category_rules WHERE title = 'CI / テスト';
SELECT pg_temp.expect(
  NOT EXISTS (SELECT 1 FROM public.category_rules WHERE title = 'CI / テスト'),
  'ルールを削除できる');

-- ── 動画の更新（おすすめ度・カテゴリ変更） ──
UPDATE public.videos SET rating = 9 WHERE youtube_id = 'citestciteA';
SELECT pg_temp.expect(
  (SELECT rating FROM public.videos WHERE youtube_id = 'citestciteA') = 9,
  'おすすめ度を変更できる');

-- ── 検索 RPC ──
SELECT pg_temp.expect(
  (SELECT count(*) FROM public.search_videos(ARRAY['CI用'], 20)) >= 0,
  'search_videos を呼べる');

RESET ROLE;

-- 後片付け
DELETE FROM public.videos WHERE youtube_id = 'citestciteA';
