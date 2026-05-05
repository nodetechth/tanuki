create table if not exists public.user_billing (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text not null default 'none',
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  free_submission_used boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_billing_customer_idx
  on public.user_billing(stripe_customer_id);

alter table public.user_billing enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_billing'
      and policyname = 'users can read own billing'
  ) then
    create policy "users can read own billing"
      on public.user_billing for select
      using (auth.uid() = user_id);
  end if;
end $$;
