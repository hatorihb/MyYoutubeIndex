-- Replace single keyword search with multi-keyword natural language search
drop function if exists public.search_videos(text, int);

create or replace function public.search_videos(
  search_queries text[],
  match_count int default 20
)
returns table (
  id uuid,
  youtube_id text,
  title text,
  channel text,
  thumbnail_url text,
  category text,
  summary text,
  created_at timestamptz,
  similarity float
)
language sql stable
as $$
  select distinct
    id, youtube_id, title, channel, thumbnail_url, category, summary, created_at,
    1.0::float as similarity
  from public.videos
  where exists (
    select 1 from unnest(search_queries) as q
    where
      title ilike '%' || q || '%'
      or summary ilike '%' || q || '%'
      or category ilike '%' || q || '%'
      or channel ilike '%' || q || '%'
      or q = any(tags)
  )
  order by created_at desc
  limit match_count;
$$;
