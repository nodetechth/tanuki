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

create index if not exists admin_users_email_idx
  on public.admin_users(lower(email));

create index if not exists admin_users_active_idx
  on public.admin_users(is_active, updated_at desc);

alter table public.admin_users enable row level security;

-- No public RLS policy is added intentionally.
-- Admin checks are performed server-side with the Supabase service role.
