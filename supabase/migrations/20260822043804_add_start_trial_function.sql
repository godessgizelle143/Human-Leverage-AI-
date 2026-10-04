CREATE OR REPLACE FUNCTION public.start_trial()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.start_trial() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_trial() FROM anon;
REVOKE ALL ON FUNCTION public.start_trial() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.start_trial() TO authenticated;