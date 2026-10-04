-- Close subscription self-grant hole.
--
-- The "Users can create their own subscription trial" INSERT policy only checked
-- auth.uid() = user_id, so a signed-in user without a subscription row could
-- insert one directly (e.g. plan = 'elite', status = 'active', no period end)
-- and receive unlimited generations from try_consume_generation.
--
-- start_trial() is the only legitimate insert path for users. Running it as
-- SECURITY DEFINER lets it insert without that policy; it still derives the
-- user from auth.uid() and hard-codes the trial values, so callers cannot
-- choose plan, status, or period.
--
-- The function body below is identical to the live definition; only the
-- SECURITY DEFINER attribute and the search_path are changed.

create or replace function public.start_trial()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_started timestamptz := now();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.subscriptions (
    user_id,
    plan,
    status,
    interviews_used,
    builds_used,
    current_period_start,
    current_period_end,
    trial_started_at,
    stripe_customer_id,
    stripe_subscription_id
  )
  VALUES (
    v_user_id,
    'professional',
    'trialing',
    0,
    0,
    v_started,
    v_started + interval '3 days',
    v_started,
    NULL,
    NULL
  )
  ON CONFLICT (user_id) DO NOTHING;
END;
$function$;

revoke execute on function public.start_trial() from public, anon;
grant execute on function public.start_trial() to authenticated;

drop policy if exists "Users can create their own subscription trial" on public.subscriptions;

-- Post-apply checks (run manually):
--   select prosecdef, proconfig from pg_proc
--     where proname = 'start_trial' and pronamespace = 'public'::regnamespace;    -- expect true, {"search_path=public, pg_temp"}
--   select policyname, cmd from pg_policies
--     where schemaname = 'public' and tablename = 'subscriptions';                -- expect only the SELECT policy
--   As a fresh authenticated user: rpc('start_trial') succeeds and creates a professional/trialing row;
--   a direct insert into subscriptions is rejected by RLS.
