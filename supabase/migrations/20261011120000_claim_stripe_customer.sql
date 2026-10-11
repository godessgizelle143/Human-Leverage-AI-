-- Atomic Stripe customer claim.
--
-- /api/checkout creates a Stripe customer for an account that has none and
-- records it on the account's subscriptions row. Concurrent first checkouts
-- each create a customer, so the row must take exactly one of them. This was a
-- filtered UPDATE sent through the API followed by a separate read; it is now
-- one function, so the claim and the read of the winning id happen in one
-- transaction and cannot be changed by how a client builds its filters.
--
-- A stored customer id is never overwritten: the update applies only while
-- stripe_customer_id is null.
--
-- Returns one row for an account that has a subscriptions row:
--   claimed = true   p_customer_id was stored
--   claimed = false  another id was already stored; stored_customer_id is it
-- and no row when the account has no subscriptions row.
--
-- Additive only: no existing table, function, policy, or row is changed.
-- Independent of 20261010120000_checkout_locks.sql.

create or replace function public.claim_stripe_customer(p_user_id uuid, p_customer_id text)
returns table (claimed boolean, stored_customer_id text)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if p_user_id is null then
    raise exception 'claim_stripe_customer: user id is required';
  end if;
  if p_customer_id is null or btrim(p_customer_id) = '' then
    raise exception 'claim_stripe_customer: customer id is required';
  end if;

  update public.subscriptions s
    set stripe_customer_id = p_customer_id,
        updated_at = now()
    where s.user_id = p_user_id
      and s.stripe_customer_id is null;

  if found then
    return query select true, p_customer_id;
    return;
  end if;

  -- Lost the claim, or it was made earlier: report what is stored. A concurrent
  -- claim holds the row lock until it commits, so the update above has already
  -- waited for it and this read sees its id.
  return query
    select false, s.stripe_customer_id
    from public.subscriptions s
    where s.user_id = p_user_id;
end;
$function$;

revoke execute on function public.claim_stripe_customer(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_stripe_customer(uuid, text) to service_role;

-- Apply before deploying application code that calls this function: without
-- it the first checkout of an account fails closed (?error=checkout-unavailable)
-- after creating a Stripe customer that is then never used.
--
-- Post-apply checks (run manually):
--   select prosecdef, proconfig from pg_proc
--     where proname = 'claim_stripe_customer' and pronamespace = 'public'::regnamespace;  -- expect true, {"search_path=public, pg_temp"}
--   select has_function_privilege('authenticated', 'public.claim_stripe_customer(uuid, text)', 'execute');  -- expect false
--   select has_function_privilege('service_role', 'public.claim_stripe_customer(uuid, text)', 'execute');   -- expect true
