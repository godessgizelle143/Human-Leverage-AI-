alter table public.subscriptions alter column stripe_customer_id drop not null;
alter table public.subscriptions alter column stripe_subscription_id drop not null;
alter table public.subscriptions add column if not exists trial_started_at timestamptz;

create policy "Users can create their own subscription trial"
on public.subscriptions
for insert
with check (auth.uid() = user_id);
