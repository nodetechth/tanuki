alter table public.feedback
  add column if not exists problem_words jsonb not null default '[]'::jsonb;

alter table public.feedback
  add column if not exists next_focus text not null default '';
