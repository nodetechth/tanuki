create extension if not exists "pgcrypto";

create table if not exists public.materials (
  id text primary key,
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  title text not null,
  script_text text not null,
  audio_url text,
  duration integer not null,
  accent text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  material_id text references public.materials(id),
  source_type text not null default 'material' check (
    source_type in ('material', 'listening_article')
  ),
  source_id text not null,
  tutor_id text not null default 'a_san',
  access_type text not null default 'free'
    check (access_type in ('free', 'subscriber', 'admin_test')),
  is_test boolean not null default false,
  test_label text,
  audio_url text not null,
  r2_object_key text not null,
  duration numeric not null default 0,
  file_size integer not null default 0,
  status text not null default 'uploaded' check (
    status in ('uploaded', 'azure_processing', 'llm_processing', 'completed', 'failed')
  ),
  error_message text,
  retry_count integer not null default 0,
  azure_raw_json jsonb,
  llm_raw_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  accuracy_score integer not null check (accuracy_score between 0 and 100),
  fluency_score integer not null check (fluency_score between 0 and 100),
  completeness_score integer not null check (completeness_score between 0 and 100),
  good_points jsonb not null default '[]'::jsonb,
  development_points jsonb not null default '[]'::jsonb,
  problem_words jsonb not null default '[]'::jsonb,
  next_focus text not null default '',
  ai_comment text not null,
  llm_raw_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_billing (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text not null default 'none',
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  free_submission_used boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'admin'
    check (role in ('admin', 'owner')),
  is_active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listening_articles (
  id text primary key,
  content_type text not null default 'listening'
    check (content_type in ('shadowing', 'listening')),
  category text not null,
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  level_label text not null,
  title text not null,
  description text not null,
  body jsonb not null default '[]'::jsonb,
  read_time_minutes integer not null default 2,
  word_count integer not null default 0,
  wpm integer not null default 120,
  audio_url text,
  audio_sources jsonb not null default '{}'::jsonb,
  published_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_listening_articles (
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id text not null references public.listening_articles(id) on delete cascade,
  is_favorite boolean not null default false,
  completed_at timestamptz,
  read_completed_at timestamptz,
  shadowing_completed_at timestamptz,
  saved_at timestamptz,
  offline_saved_at timestamptz,
  preferred_accent text check (preferred_accent is null or preferred_accent in ('us', 'uk')),
  last_shadowing_submission_id uuid references public.submissions(id) on delete set null,
  last_opened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

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

create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  headword text not null unique,
  phonetic_jp text not null default '',
  ipa text not null default '',
  definitions jsonb not null default '[]'::jsonb,
  usage_notes text not null default '',
  synonyms jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.word_examples (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references public.words(id) on delete cascade,
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  purpose text not null check (purpose in ('casual', 'business', 'toeic')),
  sentence_en text not null,
  sentence_jp text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (word_id, level, purpose)
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

create table if not exists public.word_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  query text not null,
  status text not null default 'pending'
    check (status in ('pending', 'added', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists submissions_user_created_idx
  on public.submissions(user_id, created_at desc);

create index if not exists submissions_user_test_created_idx
  on public.submissions(user_id, is_test, created_at desc);

create index if not exists submissions_source_user_created_idx
  on public.submissions(source_type, source_id, user_id, created_at desc);

create index if not exists feedback_submission_idx
  on public.feedback(submission_id);

create index if not exists user_billing_customer_idx
  on public.user_billing(stripe_customer_id);

create index if not exists admin_users_email_idx
  on public.admin_users(lower(email));

create index if not exists admin_users_active_idx
  on public.admin_users(is_active, updated_at desc);

create index if not exists listening_articles_category_level_idx
  on public.listening_articles(category, level, published_at desc);

create index if not exists user_listening_articles_favorite_idx
  on public.user_listening_articles(user_id, is_favorite, updated_at desc);

create index if not exists user_listening_articles_read_completed_idx
  on public.user_listening_articles(user_id, read_completed_at desc)
  where read_completed_at is not null;

create index if not exists user_listening_articles_shadowing_completed_idx
  on public.user_listening_articles(user_id, shadowing_completed_at desc)
  where shadowing_completed_at is not null;

create index if not exists user_listening_articles_saved_idx
  on public.user_listening_articles(user_id, saved_at desc)
  where saved_at is not null;

create index if not exists user_listening_articles_offline_saved_idx
  on public.user_listening_articles(user_id, offline_saved_at desc)
  where offline_saved_at is not null;

create index if not exists user_word_folders_user_sort_idx
  on public.user_word_folders(user_id, sort_order, created_at);

create index if not exists words_headword_idx
  on public.words(lower(headword));

create index if not exists word_examples_lookup_idx
  on public.word_examples(word_id, level, purpose);

create index if not exists user_saved_words_folder_sort_idx
  on public.user_saved_words(folder_id, is_archived, sort_order, saved_at desc);

create index if not exists user_saved_words_user_status_idx
  on public.user_saved_words(user_id, status, last_reviewed_at desc);

create index if not exists user_saved_words_word_id_idx
  on public.user_saved_words(word_id)
  where word_id is not null;

create index if not exists word_requests_query_created_idx
  on public.word_requests(query, created_at desc);

create index if not exists word_requests_status_created_idx
  on public.word_requests(status, created_at desc);

alter table public.materials enable row level security;
alter table public.submissions enable row level security;
alter table public.feedback enable row level security;
alter table public.user_billing enable row level security;
alter table public.admin_users enable row level security;
alter table public.listening_articles enable row level security;
alter table public.user_listening_articles enable row level security;
alter table public.user_word_folders enable row level security;
alter table public.words enable row level security;
alter table public.word_examples enable row level security;
alter table public.user_saved_words enable row level security;
alter table public.word_requests enable row level security;

create policy "materials are readable"
  on public.materials for select
  using (true);

create policy "listening articles are readable"
  on public.listening_articles for select
  using (true);

create policy "users can read own submissions"
  on public.submissions for select
  using (auth.uid() = user_id);

create policy "users can read own feedback"
  on public.feedback for select
  using (
    exists (
      select 1
      from public.submissions
      where submissions.id = feedback.submission_id
        and submissions.user_id = auth.uid()
    )
  );

create policy "users can read own billing"
  on public.user_billing for select
  using (auth.uid() = user_id);

create policy "users can read own listening state"
  on public.user_listening_articles for select
  using (auth.uid() = user_id);

create policy "users can upsert own listening state"
  on public.user_listening_articles for insert
  with check (auth.uid() = user_id);

create policy "users can update own listening state"
  on public.user_listening_articles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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

create policy "words are readable"
  on public.words for select
  using (true);

create policy "word examples are readable"
  on public.word_examples for select
  using (true);

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

create policy "users can insert word requests"
  on public.word_requests for insert
  with check (auth.uid() = user_id or user_id is null);

insert into public.materials (id, level, title, script_text, audio_url, duration, accent)
values
  (
    'daily-coffee',
    'beginner',
    'Morning Coffee',
    'I usually grab a coffee before work, then I check my messages and plan the day.',
    null,
    35,
    'US'
  ),
  (
    'quarterly-update',
    'intermediate',
    'Quarterly Update',
    'Our team improved the onboarding flow, but we still need to reduce support tickets next quarter.',
    null,
    48,
    'US'
  ),
  (
    'global-markets',
    'advanced',
    'Global Markets',
    'Analysts expect global markets to remain cautious as central banks signal a slower path toward rate cuts.',
    null,
    58,
    'US'
  )
on conflict (id) do update set
  level = excluded.level,
  title = excluded.title,
  script_text = excluded.script_text,
  audio_url = excluded.audio_url,
  duration = excluded.duration,
  accent = excluded.accent;
