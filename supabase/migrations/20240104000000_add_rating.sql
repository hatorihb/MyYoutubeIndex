-- Add rating column (1-10, default 8 for existing records)
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 8;
UPDATE public.videos SET rating = 8 WHERE rating IS NULL;

-- Update search_videos to include rating in results
DROP FUNCTION IF EXISTS public.search_videos(text[], int);

CREATE OR REPLACE FUNCTION public.search_videos(
  search_queries text[],
  match_count int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  youtube_id text,
  title text,
  channel text,
  thumbnail_url text,
  category text,
  summary text,
  rating integer,
  created_at timestamptz,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT
    id, youtube_id, title, channel, thumbnail_url, category, summary, rating, created_at,
    1.0::float AS similarity
  FROM public.videos
  WHERE EXISTS (
    SELECT 1 FROM unnest(search_queries) AS q
    WHERE
      title ILIKE '%' || q || '%'
      OR summary ILIKE '%' || q || '%'
      OR category ILIKE '%' || q || '%'
      OR channel ILIKE '%' || q || '%'
      OR q = ANY(tags)
  )
  ORDER BY created_at DESC
  LIMIT match_count;
$$;
