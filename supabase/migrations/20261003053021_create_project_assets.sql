create table public.project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_type text not null check (asset_type ~ '^[a-z0-9_]{1,64}$'),
  title text not null check (char_length(title) between 1 and 200),
  content text not null default '',
  status text not null default 'generating' check (status in ('generating', 'completed', 'failed')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, asset_type, version)
);

create index project_assets_user_id_idx on public.project_assets(user_id);
create index project_assets_project_id_created_at_idx on public.project_assets(project_id, created_at desc);

alter table public.project_assets enable row level security;

create policy "Users can view their own project assets"
on public.project_assets
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own project assets"
on public.project_assets
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.projects p
    where p.id = project_assets.project_id
      and p.user_id = auth.uid()
  )
);

create policy "Users can update their own project assets"
on public.project_assets
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.projects p
    where p.id = project_assets.project_id
      and p.user_id = auth.uid()
  )
);

create policy "Users can delete their own project assets"
on public.project_assets
for delete
to authenticated
using (auth.uid() = user_id);
