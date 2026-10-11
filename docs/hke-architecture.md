# HKE AI architecture

HKE turns what a person knows into structured knowledge, then into assets and (later) builds and automations.

```
Capture (interview) → Knowledge engine → Intelligence → Asset engine → [Build engine] → [Execution engine]
```

Items in brackets are contracts only (`lib/hke/domain.ts`), not yet implemented.

## Where things live

| Concern | Code | Storage |
|---|---|---|
| Interview capture, autosave | `components/hke/InterviewWorkspace.tsx`, `app/api/interviews/*`, `lib/hke/interview.ts` | `interviews.messages` (versioned JSON) |
| Knowledge engine | `lib/hke/knowledge.ts` assembles typed `KnowledgeItem`s from interview answers, the blueprint, and plan steps | derived |
| Intelligence | `lib/hke/intelligence/` — provider interface, OpenAI provider, prompts, Zod schemas, `generateStructured` | — |
| Blueprint (interview → project) | `lib/hke/generation/services.ts#generateBlueprint`, `app/api/projects/generate` | `projects` (one per interview) |
| Launch-plan steps | `lib/hke/steps.ts`, `lib/hke/step-route.ts` | `projects.content.<step>` via `hke_save_project_section` |
| Asset engine | `lib/hke/assets.ts` (catalog), `generateAsset`, `app/api/projects/[id]/assets/*` | `project_assets` (canonical) |
| Knowledge Kit (deploy) | `lib/hke/kit.ts` (latest version per asset type, Markdown + print-ready HTML), `app/api/projects/[id]/kit`, `components/hke/KnowledgeKitPanel.tsx` | derived from `projects` + `project_assets` |
| Entitlements | `lib/hke/entitlements.ts` (display mirror), database functions (authority) | `subscriptions` |
| Errors | `lib/hke/errors.ts` — `HkeError` codes map to HTTP status and safe messages | — |

## Auth and billing rules

- `/api/auth/callback` (`lib/auth/callback.ts`) handles OAuth and PKCE codes, and `token_hash` email links (cross-browser confirmation, once the Supabase email template sends them). It redirects failures to `/login?error=<code>`; the login page shows only the fixed messages in `lib/auth/messages.ts`.
- A failed `start_trial` after sign-in never discards the session; the dashboard retries it and shows a retry state.
- Password reset (`lib/auth/recovery.ts`): `/forgot-password` asks Supabase to send the link back to `/api/auth/callback`, the same address as sign-up confirmation and Google sign-in. The callback completes the link on the server (a PKCE code, recognised as a recovery from the verifier stored when the reset was requested, or a `token_hash` with `type=recovery`), sets the session, marks the browser with a 15-minute httpOnly cookie naming the account, and redirects to `/reset-password`. That page opens the form only while the marker matches the signed-in user, so it survives a refresh and never opens for an ordinary session. `POST /api/auth/reset-password` re-checks the marker, saves the password, signs the recovery session out, and clears the marker; the customer then signs in with the new password. A link that lands on `/reset-password` or on `/` with its code or token is passed to the callback. With Supabase's default email template the link must be opened in the browser that requested it; a template using `token_hash` works in any browser.
- Owner bypass requires a listed **and confirmed** email (`isOwnerUser`).
- One trial per account (`lib/stripe/policy.ts#checkoutTrial`): checkout carries over the remaining cardless trial (if at least 48h remain) and otherwise bills immediately.
- Checkout (`lib/stripe/checkout.ts`): one Stripe customer per account (claimed on the subscriptions row by the `claim_stripe_customer` database function, `supabase/migrations/20261011120000_claim_stripe_customer.sql`: it stores the id only while none is stored and returns the stored id to a request that lost; the customer is created before the checkout lock is taken, so a request that loses deletes its own unused customer); refused while Stripe reports an active, trialing, past-due, or incomplete (payment processing) subscription; after creating a session a request keeps its own session, expires every other open one, and re-checks Stripe's subscriptions. If an older session cannot be expired and is still open, or a subscription appeared meanwhile, no checkout URL is returned (`?error=checkout-retry` / `already-subscribed`). This narrows but does not eliminate duplicate payments: Stripe does not enforce one subscription per customer.
- Checkout lock (`checkout_locks`, `supabase/migrations/20261010120000_checkout_locks.sql`): the subscription check, session creation, and sweep run under a per-account lock so one request cannot act on a list of open sessions that another request is changing. Acquisition is one atomic statement; release and renew match the holder's token; the lease is 90 seconds, after which the next request takes the lock over. A request waits up to about 5 seconds for a busy lock. The request renews the lock in the database immediately before every Stripe call it makes under the lock (reads included) and stops once a renewal is refused. Before returning a URL it retrieves its own session by id and checks that it is open, unexpired, has a URL, and belongs to the customer, then renews the lock once more as the last step; if the lock is busy or lost, or the session fails that check, it returns no URL (`?error=checkout-retry`, logged as `CHECKOUT CONTENDED` with the reason). Every Stripe request in checkout, and the webhook's subscription read, is limited to 10 seconds with one retry (`lib/stripe/limits.ts`), at most 20.5 seconds per call, so a call that starts after a renewal ends locally well inside the lease; the route's `maxDuration` is 60 seconds, so a request that is cut off can leave the account locked for up to the 90-second lease. The 20.5-second figure was read from stripe@14.25.0, where a `Retry-After` header is not applied; it must be rechecked when the SDK is upgraded (a unit test fails on a version change). A timeout only ends the local wait: Stripe may still complete the request. A Stripe call already sent when a lease runs out cannot be recalled: a late expiry can only reach sessions listed before the takeover (never the session a later request returned), and a session creation that takes effect late, or whose response is lost to a timeout, can leave an extra open session whose URL no one was given until the next checkout expires it. The lock functions have been exercised only on single-connection PGlite, not on concurrent PostgreSQL connections or a Supabase project. Both migrations must be applied before the code is deployed; without the functions checkout fails closed (`?error=checkout-unavailable`), and without `claim_stripe_customer` an account's first checkout also leaves an unused Stripe customer behind on each attempt.
- Webhook (`lib/stripe/sync.ts`): every event re-reads the subscription from Stripe and plans one conditional write (applies only if the row still has the subscription and period that were read; otherwise 500 and Stripe retries). Usage resets only for a newer period of the current subscription or a new subscription that is already `active`; trialing attachments carry usage over. Older periods, ended or replaced subscriptions, and a second live subscription are ignored. A duplicate is logged as `DUPLICATE LIVE SUBSCRIPTION` with the kept and duplicate subscription ids, which are also returned in the webhook response (visible in Stripe's event log); nothing is cancelled or refunded automatically. A failed row read returns 500 without writing. A conditional update that matches no rows is re-read: a changed row is a normal conflict; an unchanged or missing row raises `UnexpectedWriteError` (also 500), which points at the write itself (key, RLS, filter encoding) rather than a race.

## Generation accounting

All credit movement happens inside database functions (`supabase/migrations/20261004120000_hke_foundation.sql`), each in one transaction:

1. `hke_begin_*` locks the interview or project, refuses duplicates and in-flight work, reserves credits (`try_consume_generation` for a blueprint, `try_consume_build` for an asset), and claims the row with `entitlement_state = 'reserved'`.
2. The server calls the model and validates the output with Zod.
3. `hke_finish_*` settles the claim exactly once: success → `consumed`; failure → credits released, `released`.
4. A claim left `generating` for 5+ minutes (killed function) is settled and refunded by the next attempt on the same interview or project.
5. Every model request goes through one client (`lib/openai/client.ts`) limited to 45 seconds with no SDK retries, against the 60-second limit of both generation routes, so a slow request fails inside the route (`ai_timeout`, HTTP 504) and step 3 records it and returns the credits. The SDK defaults (10 minutes, 2 retries) would outlast the route.
6. If a blueprint build is cut off anyway, its project stays `generating`. While that is under five minutes old it still owns the interview; after that `lib/hke/generation/recovery.ts` stops treating it as locking, so the builder opens the interview again and the next build request triggers step 4. A completed project always locks its interview.

The owner bypass (`HUMAN_LEVERAGE_OWNER_EMAILS`) passes `p_skip_entitlement`, so no credits move (`entitlement_state = 'none'`).

Credit costs: a blueprint uses 1 interview + 1 build credit; an asset uses 1 build credit.

## Write rules (enforced in the database)

- `projects`: clients may update `title` and `archived_at` only; no client inserts. Step sections go through `hke_save_project_section`, which writes one key with `jsonb_set`.
- `project_assets`: clients may edit `title`/`content` of their own **completed** assets and delete non-generating ones; no client inserts.
- `projects.interview_id` is unique.

## Adding things

- **Asset type**: add an entry to `ASSET_TYPES` in `lib/hke/assets.ts` (id must match `^[a-z0-9_]{1,64}$`).
- **Knowledge source** (documents, URLs): add a `KnowledgeSourceKind`, persist it (e.g. a `knowledge_sources` table), and include its items in `assembleKnowledge`. Every generator picks it up.
- **Retrieval/embeddings**: implement behind `lib/hke/intelligence/`; keep `knowledgeToPromptContext` as the fallback.
- **Build/Execution engines**: implement the interfaces in `lib/hke/domain.ts` with their own tables (`build_jobs`, `agent_runs`); do not route them through builder UI state.

## Database types

`types/database.ts` is the single source of database types. `lib/hke/db.ts` derives HKE row types from it, adding only the value sets enforced by CHECK constraints (which the generator renders as `string`) and select lists checked against generated column names.

The additions from `20261004120000_hke_foundation.sql` were written into `types/database.ts` by hand in generator format, because no local generator is set up. After the migration is applied to a Supabase branch, regenerate the file with `supabase gen types typescript` and confirm the diff is empty. `tests/db/types-drift.test.ts` fails if table columns or HKE function arguments drift from the migrated schema.

## Tests

`pnpm test` runs unit tests and database tests. Database tests apply every migration after the production head to an in-process Postgres (PGlite) seeded from `tests/db/supabase-baseline.sql`, then exercise accounting, concurrency guards, RLS, and column grants.
