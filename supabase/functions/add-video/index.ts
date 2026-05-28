const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
        body: JSON.stringify(previewData),
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

    // Fetch top-3 high-rated examples per category for few-shot prompting (include channel)
    const examplesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/videos?select=title,channel,category&category=not.is.null&order=rating.desc&limit=200`,
      { headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'apikey': SUPABASE_SERVICE_ROLE_KEY } }
    )
    const examplesData: { title: string; channel: string; category: string }[] = await examplesRes.json()

    // Pick up to 3 highest-rated examples per category
    const categoryCount = new Map<string, number>()
    const examples = examplesData.filter(v => {
      const count = categoryCount.get(v.category) ?? 0
      if (count >= 3) return false
      categoryCount.set(v.category, count + 1)
      return true
    })

    const examplesBlock = examples.length > 0
      ? `\n\n## 分類済み動画の実例（参考にしてください）:\n${examples.map(v => `- 「${v.title}」（${v.channel}）→ ${v.category}`).join('\n')}`
      : ''

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

    const groqPrompt = `あなたはYouTube動画の分類専門家です。以下の動画を分析し、最も適切なカテゴリを選んでください。

## 分類対象の動画
タイトル: ${snippet.title}
チャンネル: ${snippet.channelTitle}
説明: ${snippet.description?.substring(0, 1000) || ''}${examplesBlock}

## カテゴリ定義
- AI｜社会・未来: AIが社会・経済・未来に与える影響の考察
- AI｜働き方・変革: AIによる仕事・働き方の変化
- AI｜ツール・実践: AI活用の具体的な方法・ツール紹介
- AI｜モデル・動向: AIモデルの技術解説・業界動向
- AI｜ニュース（TBS）: TBS CROSS DIGによるAIニュース
- AI｜ニュース（いけとも）: いけともによるAIニュース
- AI｜1人起業: AIを使った個人起業・副業
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
- 災害: 防災・災害情報
- その他: 上記に当てはまらないもの

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
    const rawText = groqData.choices[0].message.content.trim()
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch![0])

    const analyzed = {
      youtube_id: youtubeId,
      title: snippet.title,
      channel: snippet.channelTitle,
      thumbnail_url: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
      description: snippet.description,
      published_at: snippet.publishedAt,
      tags: snippet.tags || [],
      category: parsed.category,
      summary: parsed.summary,
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
