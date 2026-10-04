-- HKE foundation: canonical assets, atomic generation accounting, safe project writes.
--
-- Builds on the production history through 20261003053021_create_project_assets
-- (protected by tag migrations-prod-sync-2026-10-03). Additive only: no table,
-- column, or row is dropped. Production had no duplicate projects.interview_id
-- values when this was written (checked 2026-10-04), so the unique index is safe.
--
-- What this changes and why:
--   1. projects.interview_id becomes unique, so one interview can never produce
--      two projects, regardless of how many requests race.
--   2. Blueprint and asset generation reserve entitlement and claim their row in
--      one transaction (hke_begin_*), and settle it exactly once
--      (hke_finish_*): consumed on success, released on failure. Interrupted
--      attempts are settled by the next attempt after five minutes.
--   3. try_consume_build now rejects expired periods, matching
--      try_consume_generation.
--   4. Clients can no longer write server-controlled columns. projects allows
--      client updates to title and archived_at only; project_assets allows
--      client edits to title and content of completed assets only. Clients
--      cannot insert either table directly; step data is written one section at
--      a time through hke_save_project_section. Rows that are still generating
--      (projects or assets) cannot be deleted by clients.

-- ---------------------------------------------------------------------------
-- Shared trigger
-- ---------------------------------------------------------------------------

create or replace function public.hke_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

revoke execute on function public.hke_touch_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------

alter table public.projects add column if not exists archived_at timestamptz;
alter table public.projects add column if not exists entitlement_state text not null default 'none';
alter table public.projects drop constraint if exists projects_entitlement_state_check;
alter table public.projects add constraint projects_entitlement_state_check
  check (entitlement_state in ('none', 'reserved', 'consumed', 'released'));

create unique index if not exists projects_interview_id_key on public.projects (interview_id);
drop index if exists public.projects_interview_id_idx;

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.hke_touch_updated_at();

-- Projects are created only by the server (hke_begin_blueprint_generation).
drop policy if exists "Users can create own projects" on public.projects;

-- A project whose blueprint is still generating holds a credit reservation;
-- deleting it would strand that reservation, so wait until it settles.
drop policy if exists "Users can delete own projects" on public.projects;
create policy "Users can delete own settled projects" on public.projects
  for delete using (auth.uid() = user_id and status <> 'generating');
revoke insert, update, truncate on public.projects from anon, authenticated;
grant update (title, archived_at) on public.projects to authenticated;

-- ---------------------------------------------------------------------------
-- project_assets
-- ---------------------------------------------------------------------------

alter table public.project_assets add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.project_assets add column if not exists error_message text;
alter table public.project_assets add column if not exists entitlement_state text not null default 'none';

alter table public.project_assets drop constraint if exists project_assets_metadata_check;
alter table public.project_assets add constraint project_assets_metadata_check
  check (jsonb_typeof(metadata) = 'object');
alter table public.project_assets drop constraint if exists project_assets_error_message_check;
alter table public.project_assets add constraint project_assets_error_message_check
  check (error_message is null or char_length(error_message) <= 500);
alter table public.project_assets drop constraint if exists project_assets_entitlement_state_check;
alter table public.project_assets add constraint project_assets_entitlement_state_check
  check (entitlement_state in ('none', 'reserved', 'consumed', 'released'));
alter table public.project_assets drop constraint if exists project_assets_content_length_check;
alter table public.project_assets add constraint project_assets_content_length_check
  check (char_length(content) <= 200000);

-- At most one in-flight generation per project, enforced by the database.
create unique index if not exists project_assets_one_generating_per_project
  on public.project_assets (project_id)
  where status = 'generating';

drop trigger if exists project_assets_touch_updated_at on public.project_assets;
create trigger project_assets_touch_updated_at
  before update on public.project_assets
  for each row execute function public.hke_touch_updated_at();

-- Assets are created only by the server (hke_begin_asset_generation), so a
-- client cannot create an asset without spending a build.
drop policy if exists "Users can create their own project assets" on public.project_assets;

drop policy if exists "Users can update their own project assets" on public.project_assets;
create policy "Users can edit their own completed project assets"
on public.project_assets
for update
to authenticated
using (auth.uid() = user_id and status = 'completed')
with check (auth.uid() = user_id and status = 'completed');

drop policy if exists "Users can delete their own project assets" on public.project_assets;
create policy "Users can delete their own settled project assets"
on public.project_assets
for delete
to authenticated
using (auth.uid() = user_id and status <> 'generating');

revoke insert, update, truncate on public.project_assets from anon, authenticated;
grant update (title, content) on public.project_assets to authenticated;

-- ---------------------------------------------------------------------------
-- interviews / subscriptions: TRUNCATE ignores RLS, so clients never get it.
-- ---------------------------------------------------------------------------

revoke truncate on public.interviews from anon, authenticated;
revoke truncate on public.subscriptions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- try_consume_build: reject expired periods (same rule as try_consume_generation).
-- Limits are unchanged.
-- ---------------------------------------------------------------------------

create or replace function public.try_consume_build(p_user_id uuid)
returns table(allowed boolean, plan text, builds_used integer, build_limit integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_plan text;
  v_status text;
  v_used int;
  v_limit int;
  v_period_end timestamptz;
begin
  select s.plan, s.status, s.builds_used, s.current_period_end
    into v_plan, v_status, v_used, v_period_end
  from public.subscriptions s
  where s.user_id = p_user_id
  for update;

  if not found
     or v_status not in ('active', 'trialing')
     or (v_period_end is not null and v_period_end <= now()) then
    return query select false, v_plan, coalesce(v_used, 0), null::int;
    return;
  end if;

  v_limit := case v_plan
    when 'creator' then 5
    when 'professional' then 15
    when 'business' then 25
    when 'elite' then null
    else 0
  end;

  if v_limit is not null and v_used >= v_limit then
    return query select false, v_plan, v_used, v_limit;
    return;
  end if;

  update public.subscriptions s
    set builds_used = s.builds_used + 1, updated_at = now()
    where s.user_id = p_user_id;

  return query select true, v_plan, v_used + 1, v_limit;
end;
$function$;

revoke execute on function public.try_consume_build(uuid) from public, anon, authenticated;
grant execute on function public.try_consume_build(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Blueprint generation (interview -> project)
-- ---------------------------------------------------------------------------

create or replace function public.hke_begin_blueprint_generation(
  p_user_id uuid,
  p_interview_id uuid,
  p_project_id uuid,
  p_title text,
  p_skip_entitlement boolean default false
)
returns table(
  claimed_project_id uuid,
  denial_reason text,
  plan_name text,
  interview_credits_used integer,
  interview_credit_limit integer,
  build_credits_used integer,
  build_credit_limit integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_existing_id uuid;
  v_existing_status text;
  v_existing_updated timestamptz;
  v_existing_state text;
  v_allowed boolean;
  v_reason text;
  v_plan text;
  v_iu integer;
  v_il integer;
  v_bu integer;
  v_bl integer;
  v_state text := 'none';
begin
  -- Locking the interview serializes every attempt for it.
  perform 1 from public.interviews i
  where i.id = p_interview_id and i.user_id = p_user_id
  for update;
  if not found then
    return query select null::uuid, 'interview_not_found'::text, null::text, null::int, null::int, null::int, null::int;
    return;
  end if;

  select p.id, p.status, p.updated_at, p.entitlement_state
    into v_existing_id, v_existing_status, v_existing_updated, v_existing_state
  from public.projects p
  where p.interview_id = p_interview_id
  for update;

  if found then
    if v_existing_status = 'generating' and v_existing_updated < now() - interval '5 minutes' then
      -- An interrupted attempt: return its reservation and free the slot.
      if v_existing_state = 'reserved' then
        perform public.release_generation(p_user_id);
      end if;
      delete from public.projects p where p.id = v_existing_id;
    elsif v_existing_status = 'generating' then
      return query select v_existing_id, 'generation_in_progress'::text, null::text, null::int, null::int, null::int, null::int;
      return;
    else
      return query select v_existing_id, 'project_exists'::text, null::text, null::int, null::int, null::int, null::int;
      return;
    end if;
  end if;

  if not p_skip_entitlement then
    select g.allowed, g.denial_reason, g.plan, g.interviews_used, g.interview_limit, g.builds_used, g.build_limit
      into v_allowed, v_reason, v_plan, v_iu, v_il, v_bu, v_bl
    from public.try_consume_generation(p_user_id) g;

    if not coalesce(v_allowed, false) then
      return query select null::uuid, coalesce(v_reason, 'no_subscription'), v_plan, v_iu, v_il, v_bu, v_bl;
      return;
    end if;
    v_state := 'reserved';
  end if;

  insert into public.projects (id, user_id, interview_id, title, content, status, entitlement_state)
  values (
    p_project_id,
    p_user_id,
    p_interview_id,
    left(coalesce(nullif(btrim(p_title), ''), 'Untitled project'), 200),
    '{}'::jsonb,
    'generating',
    v_state
  );

  return query select p_project_id, null::text, v_plan, v_iu, v_il, v_bu, v_bl;
end;
$function$;

create or replace function public.hke_finish_blueprint_generation(
  p_user_id uuid,
  p_project_id uuid,
  p_succeeded boolean,
  p_content jsonb,
  p_interview_messages jsonb,
  p_interview_progress integer
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_state text;
  v_interview_id uuid;
begin
  select p.entitlement_state, p.interview_id
    into v_state, v_interview_id
  from public.projects p
  where p.id = p_project_id and p.user_id = p_user_id and p.status = 'generating'
  for update;

  -- Already settled (or expired by a later attempt): nothing to do.
  if not found then
    return null;
  end if;

  if p_succeeded then
    update public.projects p
      set content = coalesce(p_content, '{}'::jsonb),
          status = 'completed',
          entitlement_state = case when v_state = 'reserved' then 'consumed' else v_state end
      where p.id = p_project_id;

    update public.interviews i
      set status = 'completed',
          progress = greatest(0, least(100, coalesce(p_interview_progress, i.progress))),
          messages = coalesce(p_interview_messages, i.messages),
          updated_at = now()
      where i.id = v_interview_id and i.user_id = p_user_id;

    return 'completed';
  end if;

  -- Failed: remove the claim so the interview can be retried, and return the credit once.
  delete from public.projects p where p.id = p_project_id;
  if v_state = 'reserved' then
    perform public.release_generation(p_user_id);
  end if;
  return 'failed';
end;
$function$;

-- ---------------------------------------------------------------------------
-- Asset generation (project -> project_assets)
-- ---------------------------------------------------------------------------

create or replace function public.hke_expire_stale_asset_generations(p_project_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  r record;
  n integer := 0;
begin
  for r in
    select a.id, a.user_id, a.entitlement_state
    from public.project_assets a
    where a.project_id = p_project_id
      and a.status = 'generating'
      and a.updated_at < now() - interval '5 minutes'
    for update
  loop
    update public.project_assets a
      set status = 'failed',
          error_message = 'Generation was interrupted. No build credit was used.',
          entitlement_state = case when r.entitlement_state = 'reserved' then 'released' else r.entitlement_state end
      where a.id = r.id;
    if r.entitlement_state = 'reserved' then
      perform public.release_build(r.user_id);
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$function$;

create or replace function public.hke_begin_asset_generation(
  p_user_id uuid,
  p_project_id uuid,
  p_asset_type text,
  p_title text,
  p_skip_entitlement boolean default false
)
returns table(
  claimed_asset_id uuid,
  claimed_version integer,
  denial_reason text,
  plan_name text,
  build_credits_used integer,
  build_credit_limit integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_archived timestamptz;
  v_allowed boolean;
  v_plan text;
  v_used integer;
  v_limit integer;
  v_version integer;
  v_id uuid;
  v_state text := 'none';
begin
  -- Locking the project serializes every generation attempt for it.
  select p.archived_at into v_archived
  from public.projects p
  where p.id = p_project_id and p.user_id = p_user_id and p.status = 'completed'
  for update;
  if not found then
    return query select null::uuid, null::int, 'project_not_found'::text, null::text, null::int, null::int;
    return;
  end if;
  if v_archived is not null then
    return query select null::uuid, null::int, 'project_archived'::text, null::text, null::int, null::int;
    return;
  end if;

  perform public.hke_expire_stale_asset_generations(p_project_id);

  if exists (select 1 from public.project_assets a where a.project_id = p_project_id and a.status = 'generating') then
    return query select null::uuid, null::int, 'generation_in_progress'::text, null::text, null::int, null::int;
    return;
  end if;

  if not p_skip_entitlement then
    select g.allowed, g.plan, g.builds_used, g.build_limit
      into v_allowed, v_plan, v_used, v_limit
    from public.try_consume_build(p_user_id) g;

    if not coalesce(v_allowed, false) then
      return query select null::uuid, null::int,
        (case when v_limit is null then 'no_subscription' else 'build_limit' end)::text,
        v_plan, v_used, v_limit;
      return;
    end if;
    v_state := 'reserved';
  end if;

  select coalesce(max(a.version), 0) + 1 into v_version
  from public.project_assets a
  where a.project_id = p_project_id and a.asset_type = p_asset_type;

  insert into public.project_assets (project_id, user_id, asset_type, title, status, version, entitlement_state)
  values (
    p_project_id,
    p_user_id,
    p_asset_type,
    left(coalesce(nullif(btrim(p_title), ''), 'Untitled asset'), 200),
    'generating',
    v_version,
    v_state
  )
  returning id into v_id;

  return query select v_id, v_version, null::text, v_plan, v_used, v_limit;
end;
$function$;

create or replace function public.hke_finish_asset_generation(
  p_user_id uuid,
  p_asset_id uuid,
  p_succeeded boolean,
  p_title text,
  p_content text,
  p_metadata jsonb,
  p_error text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_state text;
begin
  select a.entitlement_state into v_state
  from public.project_assets a
  where a.id = p_asset_id and a.user_id = p_user_id and a.status = 'generating'
  for update;

  -- Already settled (or expired by a later attempt): nothing to do.
  if not found then
    return null;
  end if;

  if p_succeeded then
    update public.project_assets a
      set status = 'completed',
          title = left(coalesce(nullif(btrim(p_title), ''), a.title), 200),
          content = coalesce(p_content, ''),
          metadata = coalesce(p_metadata, '{}'::jsonb),
          error_message = null,
          entitlement_state = case when v_state = 'reserved' then 'consumed' else v_state end
      where a.id = p_asset_id;
    return 'completed';
  end if;

  update public.project_assets a
    set status = 'failed',
        error_message = left(coalesce(nullif(btrim(p_error), ''), 'Generation failed.'), 500),
        entitlement_state = case when v_state = 'reserved' then 'released' else v_state end
    where a.id = p_asset_id;
  if v_state = 'reserved' then
    perform public.release_build(p_user_id);
  end if;
  return 'failed';
end;
$function$;

-- Generation accounting is server-only.
revoke execute on function public.hke_begin_blueprint_generation(uuid, uuid, uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.hke_finish_blueprint_generation(uuid, uuid, boolean, jsonb, jsonb, integer) from public, anon, authenticated;
revoke execute on function public.hke_expire_stale_asset_generations(uuid) from public, anon, authenticated;
revoke execute on function public.hke_begin_asset_generation(uuid, uuid, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.hke_finish_asset_generation(uuid, uuid, boolean, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.hke_begin_blueprint_generation(uuid, uuid, uuid, text, boolean) to service_role;
grant execute on function public.hke_finish_blueprint_generation(uuid, uuid, boolean, jsonb, jsonb, integer) to service_role;
grant execute on function public.hke_expire_stale_asset_generations(uuid) to service_role;
grant execute on function public.hke_begin_asset_generation(uuid, uuid, text, text, boolean) to service_role;
grant execute on function public.hke_finish_asset_generation(uuid, uuid, boolean, text, text, jsonb, text) to service_role;

-- ---------------------------------------------------------------------------
-- Step sections: one atomic jsonb_set per save, so saves to different sections
-- (or a save racing an archive) can never overwrite each other.
-- ---------------------------------------------------------------------------

create or replace function public.hke_save_project_section(p_project_id uuid, p_section text, p_value jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_updated timestamptz;
  v_archived timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_section not in ('launch_target', 'customer_offer', 'customer_foundation', 'launch_content') then
    raise exception 'Unknown project section' using errcode = '22023';
  end if;
  if p_value is null or jsonb_typeof(p_value) <> 'object' or octet_length(p_value::text) > 50000 then
    raise exception 'Invalid project section value' using errcode = '22023';
  end if;

  select p.archived_at into v_archived
  from public.projects p
  where p.id = p_project_id and p.user_id = v_user_id and p.status = 'completed';
  if not found then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;
  if v_archived is not null then
    raise exception 'Project is archived' using errcode = 'HKA01';
  end if;

  update public.projects p
    set content = jsonb_set(coalesce(p.content, '{}'::jsonb), array[p_section], p_value, true)
    where p.id = p_project_id and p.user_id = v_user_id
    returning p.updated_at into v_updated;

  return v_updated;
end;
$function$;

revoke execute on function public.hke_save_project_section(uuid, text, jsonb) from public, anon;
grant execute on function public.hke_save_project_section(uuid, text, jsonb) to authenticated;
