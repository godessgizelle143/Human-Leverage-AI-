# Pricing redesign plan — "Free until your Blueprint"

Status: **PLAN ONLY — waiting for Christina's approval.** No payment, database, or
entitlement code has been changed. Per CLAUDE.md, Stripe, Supabase schema/RLS,
entitlement functions, and pricing are "do not touch without explicit approval".

## Why (the HKE mission)

HKE meets people where they stand and walks with them until they're moving on
their own. Many of the people we most want to reach are short on money, time,
or confidence. Pricing should:

1. Let everyone **feel the value before paying** — no pressure, no clock.
2. Make sure **your work is always yours** — never held hostage by a plan.
3. Keep jewels (levels) **earned, never bought**.
4. Be **honest about money**: HKE is a real business, and income is a real goal
   for our users too. It just isn't the headline.

## How it works today (verified in code, 2026-10-19)

| Area | Today | Where |
|---|---|---|
| Free trial | 3 days, Professional plan, no card, one per account | `lib/hke/entitlements.ts` (`TRIAL`), `start_trial()` DB function, `lib/stripe/policy.ts` (`NEW_ACCOUNT_TRIAL_DAYS = 3`) |
| Plans | Creator $47 (5/5), Professional $97 (15/15), Business Pro $197 (25/25) interviews/builds per month | `lib/stripe/client.ts` (`PRICING_PLANS`) |
| What costs credits | Blueprint = 1 interview + 1 build credit. Each asset = 1 build credit. Failures refunded. Launch-plan steps use **no** credits. | `lib/hke/entitlements.ts`, `hke_begin_*` DB functions |
| The interview | Free | `lib/hke/vault.ts` |
| Knowledge Vault (your own answers) | **Locked when a trial/plan ends** | `lib/hke/vault.ts` (`canOpenVault`) |
| Homepage button | "Start Free 3-Day Trial" | `app/page.tsx` |

## The proposal

### 1. Free path — no time limit
- **Free forever:** the interview (already free) and **one blueprint per account**.
- That takes someone to **Level 2 · Foundation** (two jewels) at their own pace —
  a day or a month.
- Replace the 3-day clock entirely. The homepage button becomes
  **"Start free — no time limit"**.

### 2. Your work is always yours
- Your **Knowledge Vault and Blueprint are always viewable and downloadable**,
  paid or not. Only *new* AI building needs a plan.
- Jewels/levels are never removed when a plan ends.

### 3. Paid plans buy **building power**, not progress — Rise · Build · Crown
What a plan pays for is the AI work that actually costs money to run:
generating assets and extra blueprints. Plan names follow the crown levels so
pricing feels like part of the journey. Each plan does more than the last, and
**every line below is something the app already does** (asset types are in
`lib/hke/assets.ts`). Prices are proposals for Christina to confirm once the
real AI cost per build is known.

| | Free | 🌅 Rise | 🦋 Build | 👑 Crown |
|---|---|---|---|---|
| Interview + Knowledge Vault | ✅ | ✅ | ✅ | ✅ |
| Blueprints | 1, free | 1 new / month | 3 / month | 10 / month |
| Your work always viewable + downloadable | ✅ | ✅ | ✅ | ✅ |
| Launch plan + Knowledge Kit | — | ✅ | ✅ | ✅ |
| Brand + Marketing assets (brand story, mission, landing page, sales page, email sequence, lead magnet, calls to action) | — | ✅ | ✅ | ✅ |
| Content + Education assets (blog, FAQ, product descriptions, ebook, workbook, course, one-pager) | — | — | ✅ | ✅ |
| Asset builds / month | — | 5 | 15 | 30 |
| Price | $0 | **Pay what you can: $5 / $12 / $19** | ~$47 / month | ~$97 / month |

### 4. Pricing that fits what people can really pay
Christina's own experience: on another AI builder she had to find $20 every
other day, and credits disappeared on actions nobody explained. HKE must never
make anyone feel that helpless.

- **Pay what you can (Rise):** the same plan at $5, $12, or $19 a month,
  chosen by the person. No proof of income, no paperwork — honor system.
  Wording: "Money's tight right now" / "I can manage this" / "I can pay full price".
  (Stripe: three prices on one product.)
- **Build Packs, no subscription:** small one-time packs (e.g. **$5**) of
  builds that **never expire**.
- **Rollover:** unused monthly builds roll over (proposal: up to one month's
  worth) instead of disappearing.
- **Pay it forward (optional):** a checkbox on Build and Crown — "Add $5 to
  sponsor a free month for someone starting out." Sponsored months go to Rise.
- People with more expertise naturally build more and choose bigger plans,
  which helps carry people starting with less.

### 5. No surprise credit use — ever
Already true in the code today: only **Generate** (a blueprint or an asset)
uses credits; typing, editing, saving, reading, downloading, and launch-plan
steps are free; a failed generation returns its credits automatically.

Add:
- **Show the cost before it's spent**, every time: "This will use 1 build
  credit. You have 4 left. [Generate] [Not now]".
- A plain promise on the pricing page: **"No surprise charges. You'll always
  see what something costs before it costs you."**
- Credits left always visible on the dashboard (already shown) and next to
  every Generate button.

### 6. "See it in action" — show the product before the prices
Above the plans, a clearly labeled **sample** walkthrough (an illustrative
person, never presented as a real customer), built from real app screens in
demo mode:
1. She talks — an interview answer in plain words.
2. HKE organizes it — her Blueprint → Level 2 · Foundation.
3. She plans — four launch decisions → Level 3 · Rising.
4. She builds — landing page, welcome emails, one-page flyer → Level 5 · Crowned.

### 7. Remove features that don't exist (do first — text only)
The current pricing list promises things the app does not have:
Professional "Priority support", "Advanced templates"; Business Pro "Premium
templates", "Dedicated support", "API access", "White-label options"
(`lib/stripe/client.ts`, `PRICING_PLANS`). Remove them now; add any back only
once built.

### 8. Existing customers
- Anyone already paying keeps their plan and price (grandfathered).
- Anyone mid-trial keeps their trial; the change applies to new accounts.

## What would change in code (after approval, one step at a time)

1. **Vault & blueprint access** — `lib/hke/vault.ts` `canOpenVault`: allow the
   owner to read their own vault/blueprint without a plan. (Read-only; no cost.)
2. **Free blueprint** — new DB migration: replace the 3-day `start_trial()` with
   a one-time free blueprint allowance per account (e.g. `free_blueprints_used`),
   honored inside `hke_begin_blueprint_generation`. Needs RLS/ownership review.
3. **Checkout** — `lib/stripe/policy.ts`: no trial days on checkout for new
   plans; keep existing trial handling for in-flight trials.
4. **Stripe products** — Rise ($5/$12/$19 monthly prices on one product),
   Build, Crown, Build Pack (one-time), and the optional pay-it-forward add-on,
   in Stripe **test mode first**; Christina creates/approves them in the Stripe
   dashboard. Add their price IDs to env vars.
5. **Plans & limits** — `lib/stripe/client.ts`, `lib/hke/entitlements.ts`
   (`PLAN_LIMITS`), and the matching DB limits in `try_consume_*`; asset-type
   access per plan (Content + Education from Build up); never-expiring pack
   credits; rollover.
6. **Cost-before-spend** — confirm step before every Generate showing the
   credit cost and credits left.
7. **Copy & "See it in action"** — homepage button, sample walkthrough,
   pricing section, dashboard plan cards, and the "no active plan" messages
   (gentle, plain language).
7. **Tests** — new/updated unit tests for vault access, free blueprint, and
   checkout policy; `pnpm build`.

## Before anything goes live (required)

- **Confirm a staging database separate from production.** (Flagged in the
  checkout-lock review: the only known Supabase project is production.)
- Apply migrations to staging only; test with Stripe **test mode**.
- Walk through as a brand-new user: interview → free blueprint → vault still
  readable after "plan ends" → buy Starter → generate an asset → webhook.
- Abuse check: one free blueprint per verified account.

## Decisions

Approved in principle by Christina (2026-10-19): free until Blueprint with no
clock; Rise / Build / Crown; pay what you can; never-expiring packs; rollover;
pay it forward; cost shown before spending; "See it in action" section.

Still to confirm:
1. Final prices for Build and Crown (~$47 / ~$97) and the Build Pack ($5 for how many builds?).
2. Rollover cap.
3. What happens to Creator / Professional / Business Pro subscribers (grandfather as-is, or move to Build/Crown).
4. Go-ahead for the first, safest changes: remove nonexistent features (text only)
   and let people always read their own Vault/Blueprint.
