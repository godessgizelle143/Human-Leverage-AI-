-- Harden production RPC surface: entitlement mutation functions are server-only.
REVOKE EXECUTE ON FUNCTION public.try_consume_generation(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_generation(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.try_consume_build(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_build(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_consume_generation(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_generation(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.try_consume_build(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_build(uuid) TO service_role;

-- rls_auto_enable is an event-trigger function, not a client RPC.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- start_trial already authenticates via auth.uid() and is protected by the
-- subscriptions INSERT RLS policy, so it does not need SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.start_trial()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
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