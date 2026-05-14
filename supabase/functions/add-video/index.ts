const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url, category: manualCategory } = await req.json()
    const youtubeId = extractYoutubeId(url)

    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY')!
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

    const groqPrompt = manualCategory
      ? `以下のYouTube動画を日本語で分析してください。\nタイトル: ${snippet.title}\n説明: ${snippet.description?.substring(0, 800) || ''}\n\n以下のJSON形式のみで回答してください（他のテキスト不要）：\n{"summary":"100文字程度の日本語要約"}`
      : `以下のYouTube動画を日本語で分析してください。\nタイトル: ${snippet.title}\n説明: ${snippet.description?.substring(0, 800) || ''}\n\n以下のJSON形式のみで回答してください（他のテキスト不要）：\n{"category":"カテゴリ（AI｜社会・未来/AI｜働き方・変革/AI｜ツール・実践/AI｜モデル・動向/AI｜ニュース（TBS）/AI｜ニュース（いけとも）/AI｜1人起業/Claude｜全般/Claude｜アプリ開発/Claude｜デザイン/技術・開発/育成｜組織・マネジメント/育成｜個人成長/キャリア・自己啓発/リーダーシップ・マネジメント/業務プロセス変革/教養・リベラルアーツ/人生観・メンタル/時事ネタ/その他）","summary":"100文字程度の日本語要約"}`

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: groqPrompt }],
        temperature: 0.3,
      }),
    })
    const groqData = await groqRes.json()
    const rawText = groqData.choices[0].message.content.trim()
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch![0])
    const category = manualCategory || parsed.category
    const summary = parsed.summary

    const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Prefer': 'return=representation,resolution=merge-duplicates',
      },
      body: JSON.stringify({
        youtube_id: youtubeId,
        title: snippet.title,
        channel: snippet.channelTitle,
        thumbnail_url: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
        description: snippet.description,
        published_at: snippet.publishedAt,
        tags: snippet.tags || [],
        category,
        summary,
      }),
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
