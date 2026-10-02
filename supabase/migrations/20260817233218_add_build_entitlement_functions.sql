create or replace function public.try_consume_build(p_user_id uuid)
returns table (allowed boolean, plan text, builds_used int, build_limit int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_status text;
  v_used int;
  v_limit int;
begin
  select plan, status, builds_used
    into v_plan, v_status, v_used
  from subscriptions
  where user_id = p_user_id
  for update;

  if not found or v_status not in ('active', 'trialing') then
    return query select false, v_plan, coalesce(v_used, 0), null::int;
    return;
  end if;

  v_limit := case v_plan
    when 'creator' then 5
    when 'professional' then 25
    when 'business' then null
    else 0
  end;

  if v_limit is not null and v_used >= v_limit then
    return query select false, v_plan, v_used, v_limit;
    return;
  end if;

  update subscriptions
    set builds_used = builds_used + 1, updated_at = now()
    where user_id = p_user_id;

  return query select true, v_plan, v_used + 1, v_limit;
end;
$$;

revoke execute on function public.try_consume_build(uuid) from public, anon, authenticated;
grant execute on function public.try_consume_build(uuid) to service_role;

create or replace function public.release_build(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update subscriptions
    set builds_used = greatest(builds_used - 1, 0), updated_at = now()
    where user_id = p_user_id;
$$;

revoke execute on function public.release_build(uuid) from public, anon, authenticated;
grant execute on function public.release_build(uuid) to service_role;