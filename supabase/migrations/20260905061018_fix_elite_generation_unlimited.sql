CREATE OR REPLACE FUNCTION public.try_consume_generation(p_user_id uuid)
RETURNS TABLE(allowed boolean, denial_reason text, plan text, interviews_used integer, interview_limit integer, builds_used integer, build_limit integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_plan text;
  v_status text;
  v_interviews_used integer;
  v_builds_used integer;
  v_interview_limit integer;
  v_build_limit integer;
  v_period_end timestamptz;
begin
  select s.plan, s.status, s.interviews_used, s.builds_used, s.current_period_end
  into v_plan, v_status, v_interviews_used, v_builds_used, v_period_end
  from public.subscriptions s
  where s.user_id = p_user_id
  for update;

  if not found
     or v_status not in ('active', 'trialing')
     or (v_period_end is not null and v_period_end <= now()) then
    return query select false, 'no_subscription'::text, v_plan, coalesce(v_interviews_used, 0), null::integer, coalesce(v_builds_used, 0), null::integer;
    return;
  end if;

  v_interview_limit := case v_plan
    when 'creator' then 5
    when 'professional' then 15
    when 'business' then 25
    when 'elite' then null
    else 0
  end;

  v_build_limit := case v_plan
    when 'creator' then 5
    when 'professional' then 15
    when 'business' then 25
    when 'elite' then null
    else 0
  end;

  if v_interview_limit is not null and v_interviews_used >= v_interview_limit
     and v_build_limit is not null and v_builds_used >= v_build_limit then
    return query select false, 'both_limits'::text, v_plan, v_interviews_used, v_interview_limit, v_builds_used, v_build_limit;
    return;
  elsif v_interview_limit is not null and v_interviews_used >= v_interview_limit then
    return query select false, 'interview_limit'::text, v_plan, v_interviews_used, v_interview_limit, v_builds_used, v_build_limit;
    return;
  elsif v_build_limit is not null and v_builds_used >= v_build_limit then
    return query select false, 'build_limit'::text, v_plan, v_interviews_used, v_interview_limit, v_builds_used, v_build_limit;
    return;
  end if;

  update public.subscriptions s
  set interviews_used = s.interviews_used + 1, builds_used = s.builds_used + 1, updated_at = now()
  where s.user_id = p_user_id;

  return query select true, null::text, v_plan, v_interviews_used + 1, v_interview_limit, v_builds_used + 1, v_build_limit;
end;
$function$;