-- AI分類プロンプトの「迷いやすい組み合わせの判断ルール」もDB管理に移す。
-- カテゴリ本体と同じく、アプリ内から編集できるようにするため。

CREATE TABLE IF NOT EXISTS public.category_rules (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 999,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 初回のみ投入する（既に何か入っていれば触らない）
INSERT INTO public.category_rules (sort_order, title, body)
SELECT * FROM (VALUES
  (10, 'AI｜社会・未来 / AI｜働き方・変革 / 業務プロセス変革', '社会・経済全体の話なら「AI｜社会・未来」、働き手や職種への影響なら「AI｜働き方・変革」、具体的な業務フローの改善・DX事例なら「業務プロセス変革」。'),
  (20, 'AI｜ツール・実践 / AI｜モデル・動向', '「使い方・やってみた」なら「AI｜ツール・実践」、モデルの性能・リリース・業界動向なら「AI｜モデル・動向」。'),
  (30, 'Claude系 / AI系', 'Claudeが主題なら必ずClaude系を優先。その中でコード・アプリ制作なら「Claude｜アプリ開発」、UI/UX・デザイン生成なら「Claude｜デザイン」、それ以外は「Claude｜全般」。Claudeが他ツールと並ぶ一例に過ぎない場合はAI系を選ぶ。'),
  (40, '育成｜組織・マネジメント / リーダーシップ・マネジメント', '部下・チームを「育てる」話なら「育成｜組織・マネジメント」、意思決定・経営・組織運営そのものなら「リーダーシップ・マネジメント」。'),
  (50, '育成｜個人成長 / キャリア・自己啓発 / 人生観・メンタル', 'スキル・能力の伸ばし方なら「育成｜個人成長」、転職・キャリア設計・習慣形成なら「キャリア・自己啓発」、生き方・価値観・メンタルの話なら「人生観・メンタル」。'),
  (60, '科学 / フィジカルAI / 宇宙', 'ロボット・自動運転などAIの物理応用なら「フィジカルAI」、宇宙・天文が主題なら「宇宙」、それ以外の科学・技術・プログラミングは「科学」。'),
  (70, '投資 / 金融 / 時事ネタ', '視聴者自身の資産運用の判断材料（銘柄・買い方・ポートフォリオ・新NISA等）なら「投資」、金利・為替・インフレ・金融政策・銀行や証券などの業界構造の解説なら「金融」、経済ニュースの速報・出来事の紹介にとどまるなら「時事ネタ」。迷ったら「自分のお金をどう動かすか」の話は「投資」、「世の中のお金の仕組み」の話は「金融」。'),
  (80, '教養・リベラルアーツ / 人生観・メンタル', '歴史・哲学・古典など知識の獲得が主眼なら「教養・リベラルアーツ」、読者自身の生き方への示唆が主眼なら「人生観・メンタル」。'),
  (90, '芸術 / 教養・リベラルアーツ / Claude｜デザイン', '絵画・音楽・映画・文学などの作品、作家、表現技法、鑑賞・制作が主題なら「芸術」、美術史・芸術理論を歴史や思想の文脈で学ぶ内容なら「教養・リベラルアーツ」、ClaudeでUI/UXやグラフィックを作る話なら「Claude｜デザイン」。迷ったら「作品や表現そのもの」の話は「芸術」、「知識体系としての学び」は「教養・リベラルアーツ」。')
) AS seed(sort_order, title, body)
WHERE NOT EXISTS (SELECT 1 FROM public.category_rules);

ALTER TABLE public.category_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read category_rules" ON public.category_rules;
CREATE POLICY "Authenticated read category_rules" ON public.category_rules
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert category_rules" ON public.category_rules;
CREATE POLICY "Authenticated insert category_rules" ON public.category_rules
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update category_rules" ON public.category_rules;
CREATE POLICY "Authenticated update category_rules" ON public.category_rules
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated delete category_rules" ON public.category_rules;
CREATE POLICY "Authenticated delete category_rules" ON public.category_rules
  FOR DELETE TO authenticated USING (true);
