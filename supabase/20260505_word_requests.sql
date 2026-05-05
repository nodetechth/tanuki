create table if not exists public.word_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  query text not null,
  status text not null default 'pending'
    check (status in ('pending', 'added', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists word_requests_query_created_idx
  on public.word_requests(query, created_at desc);

create index if not exists word_requests_status_created_idx
  on public.word_requests(status, created_at desc);

alter table public.word_requests enable row level security;

create policy "users can insert word requests"
  on public.word_requests for insert
  with check (auth.uid() = user_id or user_id is null);
