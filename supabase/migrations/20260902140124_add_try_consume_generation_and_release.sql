-- Combine interview + build consumption into one atomic generation reservation.
-- No changes to existing try_consume_build/release_build functions.
-- Elite: 100 interviews, unlimited builds — consumes 1 of each per generation,
-- denies only on the interview counter.

create or replace function public.try_consume_generation(p_user_id uuid)
returns table(
  allowed boolean,
  denial_reason text,
  plan text,
  interviews_used integer,
  interview_limit integer,
  builds_used integer,
  build_limit integer
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_plan text;
  v_status text;
  v_interviews_used integer;
  v_builds_used integer;
  v_interview_limit integer;
  v_build_limit integer;
  v_period_end timestamptz;
begin
  select
    s.plan,
    s.status,
    s.interviews_used,
    s.builds_used,
    s.current_period_end
  into
    v_plan,
    v_status,
    v_interviews_used,
    v_builds_used,
    v_period_end
  from public.subscriptions s
  where s.user_id = p_user_id
  for update;

  -- No subscription, inactive subscription, or expired period.
  if not found
     or v_status not in ('active', 'trialing')
     or (v_period_end is not null and v_period_end <= now()) then
    return query
      select
        false,
        'no_subscription'::text,
        v_plan,
        coalesce(v_interviews_used, 0),
        null::integer,
        coalesce(v_builds_used, 0),
        null::integer;
    return;
  end if;

  v_interview_limit := case v_plan
    when 'creator' then 5
    when 'professional' then 15
    when 'business' then 25
    when 'elite' then 100
    else 0
  end;

  v_build_limit := case v_plan
    when 'creator' then 5
    when 'professional' then 15
    when 'business' then 25
    when 'elite' then null   -- unlimited builds
    else 0
  end;

  -- Both counters evaluated before either is changed.
  if v_interview_limit is not null
     and v_interviews_used >= v_interview_limit
     and v_build_limit is not null
     and v_builds_used >= v_build_limit then

    return query
      select
        false,
        'both_limits'::text,
        v_plan,
        v_interviews_used,
        v_interview_limit,
        v_builds_used,
        v_build_limit;
    return;

  elsif v_interview_limit is not null
        and v_interviews_used >= v_interview_limit then

    return query
      select
        false,
        'interview_limit'::text,
        v_plan,
        v_interviews_used,
        v_interview_limit,
        v_builds_used,
        v_build_limit;
    return;

  elsif v_build_limit is not null
        and v_builds_used >= v_build_limit then

    return query
      select
        false,
        'build_limit'::text,
        v_plan,
        v_interviews_used,
        v_interview_limit,
        v_builds_used,
        v_build_limit;
    return;
  end if;

  -- Atomic reservation: one interview + one build, for every plan including Elite.
  update public.subscriptions s
  set
    interviews_used = s.interviews_used + 1,
    builds_used = s.builds_used + 1,
    updated_at = now()
  where s.user_id = p_user_id;

  return query
    select
      true,
      null::text,
      v_plan,
      v_interviews_used + 1,
      v_interview_limit,
      v_builds_used + 1,
      v_build_limit;
end;
$function$;


create or replace function public.release_generation(p_user_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  -- Floors at zero. No plan-based exemption — Elite consumes interviews/builds
  -- on reservation, so it must also roll back on release like every other plan.
  update public.subscriptions
  set
    interviews_used = greatest(interviews_used - 1, 0),
    builds_used = greatest(builds_used - 1, 0),
    updated_at = now()
  where user_id = p_user_id;
$function$;
