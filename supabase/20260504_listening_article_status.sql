alter table public.user_listening_articles
  add column if not exists read_completed_at timestamptz,
  add column if not exists shadowing_completed_at timestamptz,
  add column if not exists last_shadowing_submission_id uuid references public.submissions(id) on delete set null;

update public.user_listening_articles
set read_completed_at = completed_at
where read_completed_at is null
  and completed_at is not null;

create index if not exists user_listening_articles_read_completed_idx
  on public.user_listening_articles(user_id, read_completed_at desc)
  where read_completed_at is not null;

create index if not exists user_listening_articles_shadowing_completed_idx
  on public.user_listening_articles(user_id, shadowing_completed_at desc)
  where shadowing_completed_at is not null;
