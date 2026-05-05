alter table public.submissions
  add column if not exists tutor_id text not null default 'a_san';

create index if not exists submissions_tutor_created_idx
  on public.submissions(tutor_id, created_at desc);
