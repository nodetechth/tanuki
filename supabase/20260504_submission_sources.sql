alter table public.submissions
  add column if not exists source_type text not null default 'material',
  add column if not exists source_id text;

update public.submissions
set source_id = material_id
where source_id is null;

alter table public.submissions
  alter column source_id set not null,
  alter column material_id drop not null;

alter table public.submissions
  drop constraint if exists submissions_source_type_check;

alter table public.submissions
  add constraint submissions_source_type_check
  check (source_type in ('material', 'listening_article'));

create index if not exists submissions_source_user_created_idx
  on public.submissions(source_type, source_id, user_id, created_at desc);
