-- Replace vector search with text search
drop function if exists public.search_videos(extensions.vector, int);

create or replace function public.search_videos(
  search_query text,
  match_count int default 12
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
  select
    id, youtube_id, title, channel, thumbnail_url, category, summary, created_at,
    1.0::float as similarity
  from public.videos
  where
    title ilike '%' || search_query || '%'
    or summary ilike '%' || search_query || '%'
    or category ilike '%' || search_query || '%'
    or channel ilike '%' || search_query || '%'
    or description ilike '%' || search_query || '%'
    or search_query = any(tags)
  order by created_at desc
  limit match_count;
$$;
