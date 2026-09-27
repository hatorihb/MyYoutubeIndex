-- CI用: Supabase が本番環境で用意しているものを、素の PostgreSQL 上に最小限だけ再現する。
-- これがないと init.sql などが参照する storage スキーマやロールが無く、
-- マイグレーションを通して流せない。

-- PostgREST が使うロール
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS storage;

-- Supabase は search_path に extensions を含めている。これがないと
-- pgvector の演算子（<=> など）が解決できず init.sql が失敗する。
DO $$ BEGIN
  EXECUTE format('ALTER DATABASE %I SET search_path TO public, extensions', current_database());
END $$;

GRANT USAGE ON SCHEMA public     TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA storage    TO anon, authenticated, service_role;

-- Supabase Storage のテーブル（マイグレーションが参照する列のみ）
CREATE TABLE IF NOT EXISTS storage.buckets (
  id     TEXT PRIMARY KEY,
  name   TEXT NOT NULL,
  public BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bucket_id TEXT REFERENCES storage.buckets(id),
  name      TEXT
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 重要: Supabase は public スキーマの新規テーブルに対して
-- デフォルト権限を設定している。CI でこれを再現してしまうと、
-- 今回のような GRANT 漏れを検出できなくなるため**あえて設定しない**。
