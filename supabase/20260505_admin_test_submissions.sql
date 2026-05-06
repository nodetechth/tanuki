alter table public.submissions
  add column if not exists is_test boolean not null default false;

alter table public.submissions
  add column if not exists test_label text;

alter table public.submissions
  drop constraint if exists submissions_access_type_check;

alter table public.submissions
  add constraint submissions_access_type_check
  check (access_type in ('free', 'subscriber', 'admin_test'));

create index if not exists submissions_user_test_created_idx
  on public.submissions(user_id, is_test, created_at desc);

create index if not exists submissions_user_access_test_created_idx
  on public.submissions(user_id, access_type, is_test, created_at desc);
