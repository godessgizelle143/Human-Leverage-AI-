CREATE OR REPLACE FUNCTION public.try_consume_build(p_user_id uuid)
 RETURNS TABLE(allowed boolean, plan text, builds_used integer, build_limit integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_plan text;
  v_status text;
  v_used int;
  v_limit int;
begin
  select s.plan, s.status, s.builds_used
    into v_plan, v_status, v_used
  from subscriptions s
  where s.user_id = p_user_id
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

  update subscriptions s
    set builds_used = s.builds_used + 1, updated_at = now()
    where s.user_id = p_user_id;

  return query select true, v_plan, v_used + 1, v_limit;
end;
$function$
