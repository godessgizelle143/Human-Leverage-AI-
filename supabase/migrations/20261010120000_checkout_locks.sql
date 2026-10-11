-- Per-account checkout lock.
--
-- /api/checkout creates a Stripe Checkout Session, expires the account's other
-- open sessions, and returns one URL. Two requests interleaving those steps
-- could each act on a stale list of open sessions, so one of them returned the
-- URL of a session the other had already expired. The lock makes that sequence
-- exclusive per account (lib/stripe/checkout.ts).
--
-- The lock is a row, not a transaction or advisory lock, because the work it
-- guards is a series of Stripe API calls made between separate PostgREST
-- requests. A holder that crashes cannot release it, so every lock carries a
-- lease: once expires_at passes, the next acquire takes it over. Release and
-- renew match on the holder's token, so a holder whose lease was taken over
-- cannot release or extend the new holder's lock.
--
-- Additive only: no existing table, function, policy, or row is changed.

create table if not exists public.checkout_locks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token uuid not null,
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- Server only: no policies, and no direct table access for clients.
alter table public.checkout_locks enable row level security;
revoke all on public.checkout_locks from public, anon, authenticated;

-- Leases are bounded so a bad argument can never lock an account for long.
create or replace function public.checkout_lock_lease(p_lease_seconds integer)
returns interval
language sql
immutable
set search_path = public, pg_temp
as $function$
  select make_interval(secs => least(greatest(coalesce(p_lease_seconds, 30), 1), 300));
$function$;

-- Takes the lock if the account has none or its lease has expired. One
-- statement, so concurrent callers cannot both succeed: the insert conflicts on
-- the primary key and the takeover applies only to an expired row.
create or replace function public.acquire_checkout_lock(p_user_id uuid, p_token uuid, p_lease_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  insert into public.checkout_locks as l (user_id, token, acquired_at, expires_at)
  values (p_user_id, p_token, now(), now() + public.checkout_lock_lease(p_lease_seconds))
  on conflict (user_id) do update
    set token = excluded.token,
        acquired_at = excluded.acquired_at,
        expires_at = excluded.expires_at
    where l.expires_at <= now();
  return found;
end;
$function$;

-- Extends the lease only while the caller still holds an unexpired lock.
-- False means the lock was lost and the caller must not act on it.
create or replace function public.renew_checkout_lock(p_user_id uuid, p_token uuid, p_lease_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  update public.checkout_locks l
    set expires_at = now() + public.checkout_lock_lease(p_lease_seconds)
    where l.user_id = p_user_id
      and l.token = p_token
      and l.expires_at > now();
  return found;
end;
$function$;

-- Releases only the caller's own lock.
create or replace function public.release_checkout_lock(p_user_id uuid, p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  delete from public.checkout_locks l
    where l.user_id = p_user_id
      and l.token = p_token;
  return found;
end;
$function$;

revoke execute on function public.checkout_lock_lease(integer) from public, anon, authenticated;
revoke execute on function public.acquire_checkout_lock(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.renew_checkout_lock(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.release_checkout_lock(uuid, uuid) from public, anon, authenticated;
grant execute on function public.acquire_checkout_lock(uuid, uuid, integer) to service_role;
grant execute on function public.renew_checkout_lock(uuid, uuid, integer) to service_role;
grant execute on function public.release_checkout_lock(uuid, uuid) to service_role;

-- Apply before deploying application code that calls these functions: without
-- them /api/checkout fails closed (?error=checkout-unavailable).
--
-- Post-apply checks (run manually):
--   select proname, prosecdef from pg_proc
--     where pronamespace = 'public'::regnamespace and proname like '%checkout_lock%';   -- expect 4 rows
--   select has_function_privilege('authenticated', 'public.acquire_checkout_lock(uuid, uuid, integer)', 'execute');  -- expect false
--   select has_table_privilege('authenticated', 'public.checkout_locks', 'select');     -- expect false
