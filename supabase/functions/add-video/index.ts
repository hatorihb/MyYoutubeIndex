const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_CATEGORIES = [
  'AI｜社会・未来', 'AI｜働き方・変革', 'AI｜ツール・実践', 'AI｜モデル・動向',
  'AI｜ニュース（TBS）', 'AI｜ニュース（いけとも）', 'AI｜1人起業', 'フィジカルAI',
  'Claude｜全般', 'Claude｜アプリ開発', 'Claude｜デザイン',
  '科学',
  '育成｜組織・マネジメント', '育成｜個人成長',
  'キャリア・自己啓発', 'リーダーシップ・マネジメント', '業務プロセス変革',
  '教養・リベラルアーツ', '人生観・メンタル',
  '時事ネタ', '投資', '災害', '英会話', '宇宙', 'その他',
]

// Tolerate common notation drift (half/full width bars and parens, stray spaces)
const normalizeCategory = (s: string) =>
  s.trim()
    .replace(/[|｜]/g, '｜')
    .replace(/[(（]/g, '（')
    .replace(/[)）]/g, '）')
    .replace(/\s+/g, '')

const CATEGORY_LOOKUP = new Map(ALLOWED_CATEGORIES.map(c => [normalizeCategory(c), c]))

// Never trust the model's raw output: anything off-list becomes その他 so that
// phantom categories cannot leak into the DB and pollute future few-shot examples.
const resolveCategory = (raw: unknown): string =>
  (typeof raw === 'string' ? CATEGORY_LOOKUP.get(normalizeCategory(raw)) : undefined) ?? 'その他'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url, preview, previewData } = await req.json()

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Step 2: previewData provided → skip analysis, just save
    if (previewData) {
      const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/videos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Prefer': 'return=representation,resolution=merge-duplicates',
        },
        body: JSON.stringify({ ...previewData, category: resolveCategory(previewData.category) }),
      })
      const saved = await dbRes.json()
      return new Response(JSON.stringify(Array.isArray(saved) ? saved[0] : saved), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step 1: analyze (with or without preview flag)
    const youtubeId = extractYoutubeId(url)

    // Duplicate check before expensive API calls
    const dupRes = await fetch(
      `${SUPABASE_URL}/rest/v1/videos?youtube_id=eq.${youtubeId}&select=id&limit=1`,
      { headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'apikey': SUPABASE_SERVICE_ROLE_KEY } }
    )
    const dupData = await dupRes.json()
    if (Array.isArray(dupData) && dupData.length > 0) {
      return new Response(JSON.stringify({ error: 'この動画はすでに登録されています' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY')!
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!

    const ytRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${youtubeId}&part=snippet,contentDetails&key=${YOUTUBE_API_KEY}`
    )
    const ytData = await ytRes.json()

    if (!ytData.items?.length) {
      return new Response(JSON.stringify({ error: '動画が見つかりませんでした' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const snippet = ytData.items[0].snippet
    const dbHeaders = { 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'apikey': SUPABASE_SERVICE_ROLE_KEY }

    // Few-shot examples across categories + this channel's own history, fetched together
    const [examplesRes, channelRes] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/videos?select=title,channel,category&category=not.is.null&order=rating.desc.nullslast&limit=300`,
        { headers: dbHeaders }
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/videos?select=title,category&channel=eq.${encodeURIComponent(snippet.channelTitle)}&category=not.is.null&order=created_at.desc&limit=50`,
        { headers: dbHeaders }
      ),
    ])

    const examplesData: { title: string; channel: string; category: string }[] = await examplesRes.json()
    const channelData: { title: string; category: string }[] = await channelRes.json()

    // Pick up to 3 highest-rated examples per category. Rows whose category is not
    // on the list are dropped so that pre-existing bad data cannot teach the model.
    const categoryCount = new Map<string, number>()
    const examples = (Array.isArray(examplesData) ? examplesData : []).filter(v => {
      if (!CATEGORY_LOOKUP.has(normalizeCategory(v.category ?? ''))) return false
      const count = categoryCount.get(v.category) ?? 0
      if (count >= 3) return false
      categoryCount.set(v.category, count + 1)
      return true
    })

    const examplesBlock = examples.length > 0
      ? `\n\n## 分類済み動画の実例（参考にしてください）:\n${examples.map(v => `- 「${v.title}」（${v.channel}）→ ${v.category}`).join('\n')}`
      : ''

    // Channel prior: some categories (news channels in particular) are decided by
    // the channel alone, so past videos from the same channel are the strongest signal.
    const channelHistory = (Array.isArray(channelData) ? channelData : [])
      .filter(v => CATEGORY_LOOKUP.has(normalizeCategory(v.category)))
    const channelTally = new Map<string, number>()
    for (const v of channelHistory) {
      const cat = resolveCategory(v.category)
      channelTally.set(cat, (channelTally.get(cat) ?? 0) + 1)
    }
    const [dominantCategory, dominantCount] = [...channelTally.entries()]
      .sort((a, b) => b[1] - a[1])[0] ?? [null, 0]
    const channelIsConsistent =
      dominantCategory !== null && channelHistory.length >= 3 && dominantCount / channelHistory.length >= 0.8
    // Unanimous history is treated as a hard rule; 80-99% only nudges the prompt,
    // because such a channel demonstrably posts across more than one category.
    const channelIsUnanimous =
      dominantCategory !== null && channelHistory.length >= 3 && dominantCount === channelHistory.length

    const channelBlock = channelHistory.length > 0
      ? `\n\n## このチャンネル（${snippet.channelTitle}）の過去動画の分類:\n${
          channelHistory.slice(0, 8).map(v => `- 「${v.title}」→ ${resolveCategory(v.category)}`).join('\n')
        }${
          channelIsConsistent
            ? `\n\n→ このチャンネルは過去${channelHistory.length}本中${dominantCount}本が「${dominantCategory}」です。明確に内容が異なる場合を除き「${dominantCategory}」を選んでください。`
            : ''
        }`
      : ''

    const tagsLine = snippet.tags?.length
      ? `\nタグ: ${snippet.tags.slice(0, 20).join(', ')}`
      : ''

    const groqPrompt = `あなたはYouTube動画の分類専門家です。以下の動画を分析し、最も適切なカテゴリを選んでください。

## 分類対象の動画
タイトル: ${snippet.title}
チャンネル: ${snippet.channelTitle}${tagsLine}
説明: ${snippet.description?.substring(0, 1000) || ''}${channelBlock}${examplesBlock}

## カテゴリ定義
- AI｜社会・未来: AIが社会・経済・未来に与える影響の考察
- AI｜働き方・変革: AIによる仕事・働き方の変化
- AI｜ツール・実践: AI活用の具体的な方法・ツール紹介
- AI｜モデル・動向: AIモデルの技術解説・業界動向
- AI｜ニュース（TBS）: TBS CROSS DIGによるAIニュース
- AI｜ニュース（いけとも）: いけともによるAIニュース
- AI｜1人起業: AIを使った個人起業・副業
- フィジカルAI: ロボット・自律システム・AIの物理世界への応用
- Claude｜全般: Claudeの概要・使い方全般
- Claude｜アプリ開発: Claudeを使ったアプリ・システム開発
- Claude｜デザイン: ClaudeのUI/UXデザイン活用
- 科学: 科学・技術・プログラミング・ソフトウェア開発全般
- 育成｜組織・マネジメント: チーム・組織の育成・マネジメント
- 育成｜個人成長: 個人のスキル・能力開発
- キャリア・自己啓発: キャリア形成・自己成長
- リーダーシップ・マネジメント: リーダーシップ・経営管理
- 業務プロセス変革: 業務効率化・DX・プロセス改善
- 教養・リベラルアーツ: 歴史・哲学・古典・知識教養
- 人生観・メンタル: 人生哲学・メンタル・生き方
- 時事ネタ: 社会・政治・経済の時事トピック
- 投資: 株・不動産・資産運用・投資全般
- 災害: 防災・災害情報
- 英会話: 英語学習・英会話・TOEIC等
- 宇宙: 宇宙科学・天文・宇宙開発・宇宙ビジネス
- その他: 上記に当てはまらないもの

## 迷いやすい組み合わせの判断ルール
- AI｜社会・未来 / AI｜働き方・変革 / 業務プロセス変革:
  社会・経済全体の話なら「AI｜社会・未来」、働き手や職種への影響なら「AI｜働き方・変革」、
  具体的な業務フローの改善・DX事例なら「業務プロセス変革」。
- AI｜ツール・実践 / AI｜モデル・動向:
  「使い方・やってみた」なら「AI｜ツール・実践」、モデルの性能・リリース・業界動向なら「AI｜モデル・動向」。
- Claude系 / AI系:
  Claudeが主題なら必ずClaude系を優先。その中でコード・アプリ制作なら「Claude｜アプリ開発」、
  UI/UX・デザイン生成なら「Claude｜デザイン」、それ以外は「Claude｜全般」。
  Claudeが他ツールと並ぶ一例に過ぎない場合はAI系を選ぶ。
- 育成｜組織・マネジメント / リーダーシップ・マネジメント:
  部下・チームを「育てる」話なら「育成｜組織・マネジメント」、
  意思決定・経営・組織運営そのものなら「リーダーシップ・マネジメント」。
- 育成｜個人成長 / キャリア・自己啓発 / 人生観・メンタル:
  スキル・能力の伸ばし方なら「育成｜個人成長」、転職・キャリア設計・習慣形成なら「キャリア・自己啓発」、
  生き方・価値観・メンタルの話なら「人生観・メンタル」。
- 科学 / フィジカルAI / 宇宙:
  ロボット・自動運転などAIの物理応用なら「フィジカルAI」、宇宙・天文が主題なら「宇宙」、
  それ以外の科学・技術・プログラミングは「科学」。
- 教養・リベラルアーツ / 人生観・メンタル:
  歴史・哲学・古典など知識の獲得が主眼なら「教養・リベラルアーツ」、
  読者自身の生き方への示唆が主眼なら「人生観・メンタル」。

## 制約
- category は上記のカテゴリ名リストから**一字一句そのまま**選ぶこと。新しい名前を作らない。
- どれにも当てはまらない場合のみ「その他」を選ぶこと。

以下のJSON形式のみで回答してください（説明不要）：
{"category":"カテゴリ名","summary":"100文字程度の日本語要約"}`

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: groqPrompt }],
        temperature: 0.1,
      }),
    })
    const groqData = await groqRes.json()
    const rawText: string = groqData.choices?.[0]?.message?.content?.trim() ?? ''
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    let parsed: { category?: unknown; summary?: unknown } = {}
    try {
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
    } catch {
      // Fall through with an empty result; category resolution below handles it.
    }

    let category = resolveCategory(parsed.category)

    // Channel override: a channel whose entire history sits in one category
    // (news channels above all) is decided by the channel, not by the model.
    if (channelIsUnanimous && category !== dominantCategory) {
      category = dominantCategory!
    } else if (category === 'その他' && dominantCategory) {
      category = dominantCategory
    }

    const analyzed = {
      youtube_id: youtubeId,
      title: snippet.title,
      channel: snippet.channelTitle,
      thumbnail_url: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
      description: snippet.description,
      published_at: snippet.publishedAt,
      tags: snippet.tags || [],
      category,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    }

    // preview: true → return without saving
    if (preview) {
      return new Response(JSON.stringify(analyzed), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Normal: analyze and save in one step (fallback)
    const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Prefer': 'return=representation,resolution=merge-duplicates',
      },
      body: JSON.stringify(analyzed),
    })
    const saved = await dbRes.json()
    return new Response(JSON.stringify(Array.isArray(saved) ? saved[0] : saved), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function extractYoutubeId(url: string): string {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /embed\/([a-zA-Z0-9_-]{11})/,
    /shorts\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  throw new Error('YouTubeのURLが正しくありません')
}
