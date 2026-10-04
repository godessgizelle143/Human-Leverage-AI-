ALTER TABLE public.subscriptions
  DROP CONSTRAINT subscriptions_plan_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan = ANY (ARRAY['creator'::text, 'professional'::text, 'business'::text, 'elite'::text]));
