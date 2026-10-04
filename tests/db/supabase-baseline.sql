-- Test fixture: the minimum of Supabase plus the production schema that the
-- HKE migrations build on (production history through
-- 20261003053021_create_project_assets, tag migrations-prod-sync-2026-10-03).
-- Used only by tests/db/*.test.ts against an in-process PGlite database.
-- Once supabase/migrations on this branch carries the synced history, the
-- harness can replay those files instead of this fixture.

-- Supabase roles and auth helpers --------------------------------------------
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- subscriptions ------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null check (plan in ('creator','professional','business','elite')),
  status text not null check (status in ('active','cancelled','past_due','trialing')),
  interviews_used integer not null default 0,
  builds_used integer not null default 0,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_user_id_key unique (user_id)
);
alter table public.subscriptions enable row level security;
create policy "Users can view their own subscription" on public.subscriptions for select using (auth.uid() = user_id);

-- interviews / projects --------------------------------------------------------------
create table public.interviews (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text not null default 'draft' check (status in ('draft','in-progress','completed')),
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  messages jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.projects (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  interview_id uuid not null references public.interviews(id) on delete restrict,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'generating' check (status in ('generating','completed','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_interview_id_idx on public.projects(interview_id);
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

-- project_assets -------------------------------------------------------------------------
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
alter table public.project_assets enable row level security;
create policy "Users can view their own project assets" on public.project_assets for select to authenticated using (auth.uid() = user_id);
create policy "Users can create their own project assets" on public.project_assets for insert to authenticated
  with check (auth.uid() = user_id and exists (select 1 from public.projects p where p.id = project_assets.project_id and p.user_id = auth.uid()));
create policy "Users can update their own project assets" on public.project_assets for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from public.projects p where p.id = project_assets.project_id and p.user_id = auth.uid()));
create policy "Users can delete their own project assets" on public.project_assets for delete to authenticated using (auth.uid() = user_id);

-- Supabase grants table privileges broadly and relies on RLS.
grant all on all tables in schema public to anon, authenticated, service_role;

-- Entitlement functions (production definitions) ----------------------------------------------
create function public.try_consume_build(p_user_id uuid)
returns table(allowed boolean, plan text, builds_used integer, build_limit integer)
language plpgsql security definer set search_path to 'public' as $function$
declare v_plan text; v_status text; v_used int; v_limit int;
begin
  select s.plan, s.status, s.builds_used into v_plan, v_status, v_used
  from subscriptions s where s.user_id = p_user_id for update;
  if not found or v_status not in ('active', 'trialing') then
    return query select false, v_plan, coalesce(v_used, 0), null::int; return;
  end if;
  v_limit := case v_plan when 'creator' then 5 when 'professional' then 15 when 'business' then 25 when 'elite' then null else 0 end;
  if v_limit is not null and v_used >= v_limit then
    return query select false, v_plan, v_used, v_limit; return;
  end if;
  update subscriptions s set builds_used = s.builds_used + 1, updated_at = now() where s.user_id = p_user_id;
  return query select true, v_plan, v_used + 1, v_limit;
end;
$function$;

create function public.release_build(p_user_id uuid) returns void language sql security definer set search_path = public as $$
  update subscriptions set builds_used = greatest(builds_used - 1, 0), updated_at = now() where user_id = p_user_id;
$$;

create function public.try_consume_generation(p_user_id uuid)
returns table(allowed boolean, denial_reason text, plan text, interviews_used integer, interview_limit integer, builds_used integer, build_limit integer)
language plpgsql security definer set search_path to 'public' as $function$
declare v_plan text; v_status text; v_interviews_used integer; v_builds_used integer; v_interview_limit integer; v_build_limit integer; v_period_end timestamptz;
begin
  select s.plan, s.status, s.interviews_used, s.builds_used, s.current_period_end
  into v_plan, v_status, v_interviews_used, v_builds_used, v_period_end
  from public.subscriptions s where s.user_id = p_user_id for update;
  if not found or v_status not in ('active', 'trialing') or (v_period_end is not null and v_period_end <= now()) then
    return query select false, 'no_subscription'::text, v_plan, coalesce(v_interviews_used, 0), null::integer, coalesce(v_builds_used, 0), null::integer; return;
  end if;
  v_interview_limit := case v_plan when 'creator' then 5 when 'professional' then 15 when 'business' then 25 when 'elite' then null else 0 end;
  v_build_limit := case v_plan when 'creator' then 5 when 'professional' then 15 when 'business' then 25 when 'elite' then null else 0 end;
  if v_interview_limit is not null and v_interviews_used >= v_interview_limit and v_build_limit is not null and v_builds_used >= v_build_limit then
    return query select false, 'both_limits'::text, v_plan, v_interviews_used, v_interview_limit, v_builds_used, v_build_limit; return;
  elsif v_interview_limit is not null and v_interviews_used >= v_interview_limit then
    return query select false, 'interview_limit'::text, v_plan, v_interviews_used, v_interview_limit, v_builds_used, v_build_limit; return;
  elsif v_build_limit is not null and v_builds_used >= v_build_limit then
    return query select false, 'build_limit'::text, v_plan, v_interviews_used, v_interview_limit, v_builds_used, v_build_limit; return;
  end if;
  update public.subscriptions s set interviews_used = s.interviews_used + 1, builds_used = s.builds_used + 1, updated_at = now() where s.user_id = p_user_id;
  return query select true, null::text, v_plan, v_interviews_used + 1, v_interview_limit, v_builds_used + 1, v_build_limit;
end;
$function$;

create function public.release_generation(p_user_id uuid) returns void language sql security definer set search_path to 'public' as $function$
  update public.subscriptions set interviews_used = greatest(interviews_used - 1, 0), builds_used = greatest(builds_used - 1, 0), updated_at = now() where user_id = p_user_id;
$function$;

revoke execute on function public.try_consume_build(uuid) from public, anon, authenticated;
revoke execute on function public.release_build(uuid) from public, anon, authenticated;
revoke execute on function public.try_consume_generation(uuid) from public, anon, authenticated;
revoke execute on function public.release_generation(uuid) from public, anon, authenticated;
grant execute on function public.try_consume_build(uuid) to service_role;
grant execute on function public.release_build(uuid) to service_role;
grant execute on function public.try_consume_generation(uuid) to service_role;
grant execute on function public.release_generation(uuid) to service_role;
