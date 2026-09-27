-- カテゴリをコードのハードコードからDB管理に移す。
-- これによりアプリ内からカテゴリの追加・変更・削除ができるようになる。

CREATE TABLE IF NOT EXISTS public.categories (
  name        TEXT PRIMARY KEY,
  sort_order  INTEGER NOT NULL DEFAULT 999,
  color_key   TEXT NOT NULL DEFAULT 'gray-600',
  definition  TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 既存のハードコード値をそのまま投入する（表示順・色・AI分類用の定義）
INSERT INTO public.categories (name, sort_order, color_key, definition) VALUES
  ('AI｜社会・未来', 10, 'sky-700', 'AIが社会・経済・未来に与える影響の考察'),
  ('AI｜働き方・変革', 20, 'sky-800', 'AIによる仕事・働き方の変化'),
  ('AI｜ツール・実践', 30, 'blue-700', 'AI活用の具体的な方法・ツール紹介'),
  ('AI｜モデル・動向', 40, 'indigo-700', 'AIモデルの技術解説・業界動向'),
  ('AI｜ニュース（TBS）', 50, 'cyan-700', 'TBS CROSS DIGによるAIニュース'),
  ('AI｜ニュース（いけとも）', 60, 'cyan-800', 'いけともによるAIニュース'),
  ('AI｜1人起業', 70, 'orange-600', 'AIを使った個人起業・副業'),
  ('フィジカルAI', 80, 'indigo-800', 'ロボット・自律システム・AIの物理世界への応用'),
  ('Claude｜全般', 90, 'orange-700', 'Claudeの概要・使い方全般'),
  ('Claude｜アプリ開発', 100, 'amber-800', 'Claudeを使ったアプリ・システム開発'),
  ('Claude｜デザイン', 110, 'yellow-700', 'ClaudeのUI/UXデザイン活用'),
  ('科学', 120, 'slate-700', '科学・技術・プログラミング・ソフトウェア開発全般'),
  ('育成｜組織・マネジメント', 130, 'purple-700', 'チーム・組織の育成・マネジメント'),
  ('育成｜個人成長', 140, 'violet-700', '個人のスキル・能力開発'),
  ('キャリア・自己啓発', 150, 'amber-700', 'キャリア形成・自己成長'),
  ('リーダーシップ・マネジメント', 160, 'purple-600', 'リーダーシップ・経営管理'),
  ('業務プロセス変革', 170, 'blue-600', '業務効率化・DX・プロセス改善'),
  ('教養・リベラルアーツ', 180, 'teal-700', '歴史・哲学・古典・知識教養'),
  ('芸術', 190, 'fuchsia-700', '美術・音楽・映画・文学・建築など、作品や表現そのものの紹介・鑑賞・制作'),
  ('人生観・メンタル', 200, 'rose-600', '人生哲学・メンタル・生き方'),
  ('時事ネタ', 210, 'gray-600', '社会・政治・経済の時事トピック'),
  ('投資', 220, 'green-700', '株・不動産・資産運用など、自分の資産をどう増やすかの実践'),
  ('金融', 230, 'emerald-700', '金利・為替・中央銀行・金融政策・金融業界など、お金の仕組みや市場環境の解説'),
  ('災害', 240, 'red-700', '防災・災害情報'),
  ('英会話', 250, 'pink-700', '英語学習・英会話・TOEIC等'),
  ('宇宙', 260, 'violet-800', '宇宙科学・天文・宇宙開発・宇宙ビジネス'),
  ('その他', 270, 'gray-500', '上記に当てはまらないもの')
ON CONFLICT (name) DO NOTHING;

-- videos に入っているがカテゴリ表に無い値を救済する。
-- 外部キーを張る前に実施しないと、想定外の値が残っていた場合に失敗する。
INSERT INTO public.categories (name, sort_order, color_key, definition)
SELECT DISTINCT v.category, 999, 'gray-600', ''
FROM public.videos v
WHERE v.category IS NOT NULL
  AND v.category <> ''
  AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.name = v.category)
ON CONFLICT (name) DO NOTHING;

-- 空文字は NULL に寄せておく（外部キーの対象外にするため）
UPDATE public.videos SET category = NULL WHERE category = '';

-- 改名時に videos 側へ自動反映させる。削除は RPC 経由に限定したいので RESTRICT。
ALTER TABLE public.videos
  DROP CONSTRAINT IF EXISTS videos_category_fkey;
ALTER TABLE public.videos
  ADD CONSTRAINT videos_category_fkey
  FOREIGN KEY (category) REFERENCES public.categories(name)
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- RLS: 他テーブルと同じく認証済みユーザーのみ
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read categories" ON public.categories;
CREATE POLICY "Authenticated read categories" ON public.categories
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert categories" ON public.categories;
CREATE POLICY "Authenticated insert categories" ON public.categories
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update categories" ON public.categories;
CREATE POLICY "Authenticated update categories" ON public.categories
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated delete categories" ON public.categories;
CREATE POLICY "Authenticated delete categories" ON public.categories
  FOR DELETE TO authenticated USING (true);

-- カテゴリ削除。使用中の動画は指定カテゴリ（既定は「その他」）へ退避してから削除する。
-- 外部キーが RESTRICT なので、この経路以外では使用中カテゴリを消せない。
CREATE OR REPLACE FUNCTION public.delete_category(
  p_name     TEXT,
  p_fallback TEXT DEFAULT 'その他'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_moved INTEGER := 0;
BEGIN
  IF p_name = p_fallback THEN
    RAISE EXCEPTION '退避先と同じカテゴリは削除できません: %', p_name;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE name = p_fallback) THEN
    RAISE EXCEPTION '退避先のカテゴリが存在しません: %', p_fallback;
  END IF;

  UPDATE public.videos SET category = p_fallback WHERE category = p_name;
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  DELETE FROM public.categories WHERE name = p_name;

  RETURN v_moved;
END;
$$;
