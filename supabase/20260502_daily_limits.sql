alter table public.submissions
  add column if not exists access_type text not null default 'free'
  check (access_type in ('free', 'subscriber'));

create index if not exists submissions_user_access_created_idx
  on public.submissions(user_id, access_type, created_at desc);
