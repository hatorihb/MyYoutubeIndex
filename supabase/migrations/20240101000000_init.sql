-- Enable pgvector
create extension if not exists vector with schema extensions;

-- Videos table
create table if not exists public.videos (
  id uuid default gen_random_uuid() primary key,
  youtube_id text not null unique,
  title text not null,
  channel text,
  thumbnail_url text,
  description text,
  published_at timestamptz,
  tags text[] default '{}',
  category text,
  summary text,
  embedding extensions.vector(768),
  created_at timestamptz default now()
);

-- Files table (NotebookLM outputs)
create table if not exists public.files (
  id uuid default gen_random_uuid() primary key,
  video_id uuid references public.videos(id) on delete cascade,
  name text not null,
  file_type text,
  storage_path text not null,
  created_at timestamptz default now()
);

-- RLS
alter table public.videos enable row level security;
alter table public.files enable row level security;

create policy "Public read videos" on public.videos for select using (true);
create policy "Public read files" on public.files for select using (true);
create policy "Public insert files" on public.files for insert with check (true);

-- Storage bucket for NotebookLM files
insert into storage.buckets (id, name, public)
values ('notebooks', 'notebooks', true)
on conflict (id) do nothing;

create policy "Public upload notebooks" on storage.objects
  for insert with check (bucket_id = 'notebooks');

create policy "Public read notebooks" on storage.objects
  for select using (bucket_id = 'notebooks');

-- Vector similarity search function
create or replace function public.search_videos(
  query_embedding extensions.vector(768),
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
    1 - (embedding <=> query_embedding) as similarity
  from public.videos
  where embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;
