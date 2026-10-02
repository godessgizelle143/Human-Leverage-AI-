create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null,
  plan text not null check (plan in ('creator','professional','business')),
  status text not null check (status in ('active','cancelled','past_due','trialing')),
  interviews_used integer not null default 0,
  builds_used integer not null default 0,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_user_id_key unique (user_id),
  constraint subscriptions_stripe_subscription_id_key unique (stripe_subscription_id)
);

create index if not exists subscriptions_stripe_customer_id_idx on public.subscriptions (stripe_customer_id);

alter table public.subscriptions enable row level security;

create policy "Users can view their own subscription"
on public.subscriptions
for select
using (auth.uid() = user_id);
