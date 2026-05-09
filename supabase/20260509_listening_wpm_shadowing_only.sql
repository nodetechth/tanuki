alter table public.listening_articles
  alter column wpm drop not null,
  alter column wpm drop default;

update public.listening_articles
set wpm = null
where content_type = 'listening';
