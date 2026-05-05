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

create index if not exists words_headword_idx
  on public.words(lower(headword));

create index if not exists word_examples_lookup_idx
  on public.word_examples(word_id, level, purpose);

alter table public.words enable row level security;
alter table public.word_examples enable row level security;

create policy "words are readable"
  on public.words for select
  using (true);

create policy "word examples are readable"
  on public.word_examples for select
  using (true);
