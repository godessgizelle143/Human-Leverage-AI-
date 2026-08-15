create table if not exists public.interviews (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text not null default 'draft' check (status in ('draft','in-progress','completed')),
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  messages jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  interview_id uuid not null references public.interviews(id) on delete restrict,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'generating' check (status in ('generating','completed','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interviews_user_id_idx on public.interviews(user_id);
create index if not exists interviews_updated_at_idx on public.interviews(updated_at desc);
create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists projects_interview_id_idx on public.projects(interview_id);

alter table public.interviews enable row level security;
alter table public.projects enable row level security;

create policy "Users can view own interviews" on public.interviews for select using (auth.uid() = user_id);
create policy "Users can create own interviews" on public.interviews for insert with check (auth.uid() = user_id);
create policy "Users can update own interviews" on public.interviews for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own interviews" on public.interviews for delete using (auth.uid() = user_id);

create policy "Users can view own projects" on public.projects for select using (auth.uid() = user_id);
create policy "Users can create own projects" on public.projects for insert with check (auth.uid() = user_id);
create policy "Users can update own projects" on public.projects for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own projects" on public.projects for delete using (auth.uid() = user_id);
