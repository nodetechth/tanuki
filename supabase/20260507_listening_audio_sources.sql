alter table public.listening_articles
  add column if not exists audio_sources jsonb not null default '{}'::jsonb;
