const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query } = await req.json()

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!

    let keywords: string[] = [query]
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{
            role: 'user',
            content: `以下の検索クエリから、YouTube動画を検索するための日本語キーワードを3～5個抽出してください。動画のタイトル・カテゴリ・要約に含まれそうな単語を選んでください。\nクエリ: ${query}\n\nJSON配列のみで回答してください（他のテキスト不要）: ["キーワード1", "キーワード2", ...]`,
          }],
          temperature: 0.1,
        }),
      })
      const groqData = await groqRes.json()
      const rawText = groqData.choices[0].message.content.trim()
      const jsonMatch = rawText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (Array.isArray(parsed) && parsed.length > 0) {
          keywords = parsed
        }
      }
    } catch {
      // Groq失敗時は元のクエリそのままで検索
    }

    const searchRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        search_queries: keywords,
        match_count: 20,
      }),
    })

    const results = await searchRes.json()

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
