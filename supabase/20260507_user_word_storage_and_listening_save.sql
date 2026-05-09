-- Requires supabase/20260503_word_dictionary.sql because user_saved_words.word_id
-- references public.words. Apply the word dictionary migration first.

create table if not exists public.user_word_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.user_saved_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid not null references public.user_word_folders(id) on delete cascade,
  word_id uuid references public.words(id) on delete set null,
  word text not null,
  normalized_word text not null,
  level text not null default 'intermediate'
    check (level in ('beginner', 'intermediate', 'advanced')),
  purpose text not null default 'business'
    check (purpose in ('casual', 'business', 'toeic')),
  note text not null default '',
  status text not null default 'unreviewed'
    check (status in ('unreviewed', 'good', 'fair', 'bad')),
  last_reviewed_at timestamptz,
  review_count integer not null default 0 check (review_count >= 0),
  is_archived boolean not null default false,
  saved_at timestamptz not null default now(),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_word)
);

alter table public.user_listening_articles
  add column if not exists saved_at timestamptz,
  add column if not exists offline_saved_at timestamptz,
  add column if not exists preferred_accent text
    check (preferred_accent is null or preferred_accent in ('us', 'uk'));

create index if not exists user_word_folders_user_sort_idx
  on public.user_word_folders(user_id, sort_order, created_at);

create index if not exists user_saved_words_folder_sort_idx
  on public.user_saved_words(folder_id, is_archived, sort_order, saved_at desc);

create index if not exists user_saved_words_user_status_idx
  on public.user_saved_words(user_id, status, last_reviewed_at desc);

create index if not exists user_saved_words_word_id_idx
  on public.user_saved_words(word_id)
  where word_id is not null;

create index if not exists user_listening_articles_saved_idx
  on public.user_listening_articles(user_id, saved_at desc)
  where saved_at is not null;

create index if not exists user_listening_articles_offline_saved_idx
  on public.user_listening_articles(user_id, offline_saved_at desc)
  where offline_saved_at is not null;

alter table public.user_word_folders enable row level security;
alter table public.user_saved_words enable row level security;

create policy "users can read own word folders"
  on public.user_word_folders for select
  using (auth.uid() = user_id);

create policy "users can insert own word folders"
  on public.user_word_folders for insert
  with check (auth.uid() = user_id);

create policy "users can update own word folders"
  on public.user_word_folders for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete own word folders"
  on public.user_word_folders for delete
  using (auth.uid() = user_id);

create policy "users can read own saved words"
  on public.user_saved_words for select
  using (auth.uid() = user_id);

create policy "users can insert own saved words"
  on public.user_saved_words for insert
  with check (auth.uid() = user_id);

create policy "users can update own saved words"
  on public.user_saved_words for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete own saved words"
  on public.user_saved_words for delete
  using (auth.uid() = user_id);
