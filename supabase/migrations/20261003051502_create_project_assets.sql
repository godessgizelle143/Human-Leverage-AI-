-- HKE asset foundation: reusable assets generated from a project's interview,
-- blueprint, and saved Step 01-04 context. Each generation is stored as a new
-- version so earlier assets are never overwritten.
--
-- Allowed asset types are enforced by the application's HKE asset registry
-- (lib/hke/assets.ts); the column check only guarantees a well-formed slug so
-- new asset types do not require a schema change.

create table if not exists public.project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_type text not null check (asset_type ~ '^[a-z][a-z0-9_]{0,63}$'),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  content text not null default '',
  status text not null default 'generating' check (status in ('generating','completed','failed')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_assets_project_type_version_key unique (project_id, asset_type, version)
);

create index if not exists project_assets_user_id_idx on public.project_assets(user_id);
create index if not exists project_assets_project_id_created_at_idx on public.project_assets(project_id, created_at desc);

alter table public.project_assets enable row level security;

-- Same owner-only pattern as public.projects, plus a check that the referenced
-- project also belongs to the caller so an asset cannot be attached to another
-- user's project.
drop policy if exists "Users can view own project assets" on public.project_assets;
create policy "Users can view own project assets" on public.project_assets for select using (auth.uid() = user_id);

drop policy if exists "Users can create own project assets" on public.project_assets;
create policy "Users can create own project assets" on public.project_assets for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
);

drop policy if exists "Users can update own project assets" on public.project_assets;
create policy "Users can update own project assets" on public.project_assets for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
);

drop policy if exists "Users can delete own project assets" on public.project_assets;
create policy "Users can delete own project assets" on public.project_assets for delete using (auth.uid() = user_id);
