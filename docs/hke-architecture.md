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
| Entitlements | `lib/hke/entitlements.ts` (display mirror), database functions (authority) | `subscriptions` |
| Errors | `lib/hke/errors.ts` — `HkeError` codes map to HTTP status and safe messages | — |

## Generation accounting

All credit movement happens inside database functions (`supabase/migrations/20261004120000_hke_foundation.sql`), each in one transaction:

1. `hke_begin_*` locks the interview or project, refuses duplicates and in-flight work, reserves credits (`try_consume_generation` for a blueprint, `try_consume_build` for an asset), and claims the row with `entitlement_state = 'reserved'`.
2. The server calls the model and validates the output with Zod.
3. `hke_finish_*` settles the claim exactly once: success → `consumed`; failure → credits released, `released`.
4. A claim left `generating` for 5+ minutes (killed function) is settled and refunded by the next attempt on the same interview or project.

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
