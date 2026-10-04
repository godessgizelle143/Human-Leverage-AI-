import { beforeAll, describe, expect, it } from 'vitest'
import { age, createTestDb, newMigrations, seedProject, seedUser, usage, uuid, type TestDb } from './harness'

let t: TestDb

beforeAll(async () => {
  t = await createTestDb()
})

type BlueprintClaim = { claimed_project_id: string | null; denial_reason: string | null; plan_name: string | null }
type AssetClaim = { claimed_asset_id: string | null; claimed_version: number | null; denial_reason: string | null; build_credits_used: number | null; build_credit_limit: number | null }

async function beginBlueprint(userId: string, interviewId: string, options: { projectId?: string; skip?: boolean } = {}) {
  await t.asService()
  return t.one<BlueprintClaim>('select * from public.hke_begin_blueprint_generation($1, $2, $3, $4, $5)', [userId, interviewId, options.projectId ?? uuid(), 'My business', options.skip ?? false])
}

async function finishBlueprint(userId: string, projectId: string, succeeded: boolean) {
  await t.asService()
  const row = await t.one<{ result: string | null }>('select public.hke_finish_blueprint_generation($1, $2, $3, $4, $5, $6) as result', [userId, projectId, succeeded, JSON.stringify({ business_summary: 'Summary' }), JSON.stringify({ version: 2, answers: { 1: 'A' }, current: 0, archived: false }), 7])
  return row.result
}

async function beginAsset(userId: string, projectId: string, assetType = 'sales_page', skip = false) {
  await t.asService()
  return t.one<AssetClaim>('select * from public.hke_begin_asset_generation($1, $2, $3, $4, $5)', [userId, projectId, assetType, 'Sales Page', skip])
}

async function finishAsset(userId: string, assetId: string, succeeded: boolean) {
  await t.asService()
  const row = await t.one<{ result: string | null }>('select public.hke_finish_asset_generation($1, $2, $3, $4, $5, $6, $7) as result', [userId, assetId, succeeded, 'Generated title', succeeded ? '# Content' : '', JSON.stringify({ model: 'test' }), succeeded ? null : 'Generation failed.'])
  return row.result
}

describe('migration harness', () => {
  it('applies the HKE foundation migration on top of the production baseline', async () => {
    expect(newMigrations().map((migration) => migration.file)).toContain('20261004120000_hke_foundation.sql')
    await t.asSuperuser()
    const index = await t.one<{ n: number }>(`select count(*)::int as n from pg_indexes where indexname = 'projects_interview_id_key'`)
    expect(index.n).toBe(1)
  })
})

describe('duplicate project protection', () => {
  it('rejects a second project for the same interview at the database level', async () => {
    const { userId, interviewId } = await seedUser(t)
    await seedProject(t, userId, interviewId)
    await expect(seedProject(t, userId, interviewId)).rejects.toThrow(/projects_interview_id_key/)
  })

  it('reports an existing project instead of creating or charging again', async () => {
    const { userId, interviewId } = await seedUser(t)
    const existing = await seedProject(t, userId, interviewId)
    const claim = await beginBlueprint(userId, interviewId)
    expect(claim).toMatchObject({ claimed_project_id: existing, denial_reason: 'project_exists' })
    expect(await usage(t, userId)).toEqual({ interviews_used: 0, builds_used: 0 })
  })
})

describe('blueprint generation accounting', () => {
  it('consumes one generation, blocks a concurrent attempt, and settles once on success', async () => {
    const { userId, interviewId } = await seedUser(t)
    const first = await beginBlueprint(userId, interviewId)
    expect(first.denial_reason).toBeNull()
    expect(await usage(t, userId)).toEqual({ interviews_used: 1, builds_used: 1 })

    const second = await beginBlueprint(userId, interviewId)
    expect(second).toMatchObject({ claimed_project_id: first.claimed_project_id, denial_reason: 'generation_in_progress' })
    expect(await usage(t, userId)).toEqual({ interviews_used: 1, builds_used: 1 })

    expect(await finishBlueprint(userId, first.claimed_project_id!, true)).toBe('completed')
    expect(await finishBlueprint(userId, first.claimed_project_id!, false)).toBeNull()
    expect(await usage(t, userId)).toEqual({ interviews_used: 1, builds_used: 1 })

    await t.asSuperuser()
    const project = await t.one<{ status: string; entitlement_state: string }>('select status, entitlement_state from public.projects where id = $1', [first.claimed_project_id])
    expect(project).toEqual({ status: 'completed', entitlement_state: 'consumed' })
    const interview = await t.one<{ status: string; progress: number }>('select status, progress from public.interviews where id = $1', [interviewId])
    expect(interview).toEqual({ status: 'completed', progress: 7 })
  })

  it('releases the generation exactly once on failure and allows a retry', async () => {
    const { userId, interviewId } = await seedUser(t)
    const claim = await beginBlueprint(userId, interviewId)
    expect(await finishBlueprint(userId, claim.claimed_project_id!, false)).toBe('failed')
    expect(await finishBlueprint(userId, claim.claimed_project_id!, false)).toBeNull()
    expect(await usage(t, userId)).toEqual({ interviews_used: 0, builds_used: 0 })

    const retry = await beginBlueprint(userId, interviewId)
    expect(retry.denial_reason).toBeNull()
    expect(await usage(t, userId)).toEqual({ interviews_used: 1, builds_used: 1 })
  })

  it('settles an interrupted attempt before claiming again', async () => {
    const { userId, interviewId } = await seedUser(t)
    const stale = await beginBlueprint(userId, interviewId)
    await age(t, 'projects', stale.claimed_project_id!, 10)
    const fresh = await beginBlueprint(userId, interviewId)
    expect(fresh.denial_reason).toBeNull()
    expect(fresh.claimed_project_id).not.toBe(stale.claimed_project_id)
    expect(await usage(t, userId)).toEqual({ interviews_used: 1, builds_used: 1 })
    // The interrupted request finishing late must not settle anything.
    expect(await finishBlueprint(userId, stale.claimed_project_id!, true)).toBeNull()
  })

  it('denies exhausted, expired, and unsubscribed users without creating a project', async () => {
    const exhausted = await seedUser(t, { interviewsUsed: 15, buildsUsed: 3 })
    expect((await beginBlueprint(exhausted.userId, exhausted.interviewId)).denial_reason).toBe('interview_limit')

    const expired = await seedUser(t, { periodEnd: new Date(Date.now() - 1000).toISOString() })
    expect((await beginBlueprint(expired.userId, expired.interviewId)).denial_reason).toBe('no_subscription')

    const none = await seedUser(t, { subscription: false })
    expect((await beginBlueprint(none.userId, none.interviewId)).denial_reason).toBe('no_subscription')

    await t.asSuperuser()
    const count = await t.one<{ n: number }>('select count(*)::int as n from public.projects where interview_id = any($1)', [[exhausted.interviewId, expired.interviewId, none.interviewId]])
    expect(count.n).toBe(0)
    expect(await usage(t, exhausted.userId)).toEqual({ interviews_used: 15, builds_used: 3 })
  })

  it('rejects an interview owned by someone else', async () => {
    const owner = await seedUser(t)
    const other = await seedUser(t)
    expect((await beginBlueprint(other.userId, owner.interviewId)).denial_reason).toBe('interview_not_found')
  })

  it('lets the owner bypass entitlement without touching counters', async () => {
    const { userId, interviewId } = await seedUser(t, { subscription: false })
    const claim = await beginBlueprint(userId, interviewId, { skip: true })
    expect(claim.denial_reason).toBeNull()
    expect(await finishBlueprint(userId, claim.claimed_project_id!, false)).toBe('failed')
  })
})

describe('asset generation accounting', () => {
  it('consumes one build, blocks concurrent generation, and versions assets per type', async () => {
    const { userId, interviewId } = await seedUser(t, { buildsUsed: 1, interviewsUsed: 1 })
    const projectId = await seedProject(t, userId, interviewId)

    const first = await beginAsset(userId, projectId)
    expect(first).toMatchObject({ denial_reason: null, claimed_version: 1, build_credits_used: 2, build_credit_limit: 15 })
    expect(await usage(t, userId)).toEqual({ interviews_used: 1, builds_used: 2 })

    const concurrent = await beginAsset(userId, projectId, 'faq')
    expect(concurrent.denial_reason).toBe('generation_in_progress')
    expect(await usage(t, userId)).toEqual({ interviews_used: 1, builds_used: 2 })

    expect(await finishAsset(userId, first.claimed_asset_id!, true)).toBe('completed')
    expect(await finishAsset(userId, first.claimed_asset_id!, false)).toBeNull()
    expect(await usage(t, userId)).toEqual({ interviews_used: 1, builds_used: 2 })

    const second = await beginAsset(userId, projectId)
    expect(second.claimed_version).toBe(2)
    await finishAsset(userId, second.claimed_asset_id!, true)

    await t.asSuperuser()
    const rows = await t.query<{ status: string; entitlement_state: string; metadata: unknown }>('select status, entitlement_state, metadata from public.project_assets where project_id = $1', [projectId])
    expect(rows).toHaveLength(2)
    expect(rows.every((row) => row.status === 'completed' && row.entitlement_state === 'consumed')).toBe(true)
  })

  it('releases the build exactly once when generation fails', async () => {
    const { userId, interviewId } = await seedUser(t)
    const projectId = await seedProject(t, userId, interviewId)
    const claim = await beginAsset(userId, projectId)
    expect(await usage(t, userId)).toEqual({ interviews_used: 0, builds_used: 1 })
    expect(await finishAsset(userId, claim.claimed_asset_id!, false)).toBe('failed')
    expect(await finishAsset(userId, claim.claimed_asset_id!, false)).toBeNull()
    expect(await usage(t, userId)).toEqual({ interviews_used: 0, builds_used: 0 })

    await t.asSuperuser()
    const row = await t.one<{ status: string; entitlement_state: string; error_message: string }>('select status, entitlement_state, error_message from public.project_assets where id = $1', [claim.claimed_asset_id])
    expect(row).toEqual({ status: 'failed', entitlement_state: 'released', error_message: 'Generation failed.' })
  })

  it('expires an interrupted generation, refunds it, and unblocks the project', async () => {
    const { userId, interviewId } = await seedUser(t)
    const projectId = await seedProject(t, userId, interviewId)
    const stale = await beginAsset(userId, projectId)
    await age(t, 'project_assets', stale.claimed_asset_id!, 10)
    const fresh = await beginAsset(userId, projectId)
    expect(fresh.denial_reason).toBeNull()
    expect(await usage(t, userId)).toEqual({ interviews_used: 0, builds_used: 1 })
    expect(await finishAsset(userId, stale.claimed_asset_id!, true)).toBeNull()
  })

  it('enforces the build limit and expired periods', async () => {
    const exhausted = await seedUser(t, { plan: 'creator', status: 'active', buildsUsed: 5 })
    const projectA = await seedProject(t, exhausted.userId, exhausted.interviewId)
    expect(await beginAsset(exhausted.userId, projectA)).toMatchObject({ denial_reason: 'build_limit', build_credits_used: 5, build_credit_limit: 5 })

    const expired = await seedUser(t, { periodEnd: new Date(Date.now() - 1000).toISOString() })
    const projectB = await seedProject(t, expired.userId, expired.interviewId)
    expect((await beginAsset(expired.userId, projectB)).denial_reason).toBe('no_subscription')
    expect(await usage(t, expired.userId)).toEqual({ interviews_used: 0, builds_used: 0 })
  })

  it('gives elite plans unlimited builds', async () => {
    const { userId, interviewId } = await seedUser(t, { plan: 'elite', status: 'active', buildsUsed: 500 })
    const projectId = await seedProject(t, userId, interviewId)
    expect(await beginAsset(userId, projectId)).toMatchObject({ denial_reason: null, build_credit_limit: null })
  })

  it('refuses archived projects and projects owned by someone else', async () => {
    const owner = await seedUser(t)
    const projectId = await seedProject(t, owner.userId, owner.interviewId)
    const other = await seedUser(t)
    expect((await beginAsset(other.userId, projectId)).denial_reason).toBe('project_not_found')
    expect(await usage(t, other.userId)).toEqual({ interviews_used: 0, builds_used: 0 })

    await t.asSuperuser()
    await t.query('update public.projects set archived_at = now() where id = $1', [projectId])
    expect((await beginAsset(owner.userId, projectId)).denial_reason).toBe('project_archived')
    expect(await usage(t, owner.userId)).toEqual({ interviews_used: 0, builds_used: 0 })
  })

  it('makes try_consume_build reject expired periods', async () => {
    const { userId } = await seedUser(t, { periodEnd: new Date(Date.now() - 1000).toISOString() })
    await t.asService()
    const gate = await t.one<{ allowed: boolean }>('select * from public.try_consume_build($1)', [userId])
    expect(gate.allowed).toBe(false)
  })
})

describe('client privileges (RLS + column grants)', () => {
  it('blocks direct inserts of projects and assets', async () => {
    const { userId, interviewId } = await seedUser(t)
    const projectId = await seedProject(t, userId, interviewId)
    const other = await seedUser(t)
    await t.asUser(other.userId)
    await expect(t.query(`insert into public.projects (id, user_id, interview_id, title) values ($1, $2, $3, 'x')`, [uuid(), other.userId, other.interviewId])).rejects.toThrow(/permission denied/)
    await t.asUser(userId)
    await expect(t.query(`insert into public.project_assets (project_id, user_id, asset_type, title, status) values ($1, $2, 'faq', 'x', 'completed')`, [projectId, userId])).rejects.toThrow(/permission denied/)
  })

  it('lets owners rename and archive but not rewrite server-controlled project fields', async () => {
    const { userId, interviewId } = await seedUser(t)
    const projectId = await seedProject(t, userId, interviewId)
    await t.asUser(userId)
    expect(await t.query('update public.projects set title = $2, archived_at = now() where id = $1 returning id', [projectId, 'Renamed'])).toHaveLength(1)
    await expect(t.query(`update public.projects set status = 'generating' where id = $1`, [projectId])).rejects.toThrow(/permission denied/)
    await expect(t.query(`update public.projects set content = '{}' where id = $1`, [projectId])).rejects.toThrow(/permission denied/)
    await expect(t.query(`update public.projects set entitlement_state = 'none' where id = $1`, [projectId])).rejects.toThrow(/permission denied/)

    const stranger = await seedUser(t)
    await t.asUser(stranger.userId)
    expect(await t.query('update public.projects set title = $2 where id = $1 returning id', [projectId, 'Hijacked'])).toHaveLength(0)
  })

  it('lets owners edit completed asset text only, and never generating or foreign assets', async () => {
    const { userId, interviewId } = await seedUser(t)
    const projectId = await seedProject(t, userId, interviewId)
    const done = await beginAsset(userId, projectId)
    await finishAsset(userId, done.claimed_asset_id!, true)
    const running = await beginAsset(userId, projectId, 'faq')

    await t.asUser(userId)
    expect(await t.query(`update public.project_assets set content = 'edited', title = 'Mine' where id = $1 returning id`, [done.claimed_asset_id])).toHaveLength(1)
    await expect(t.query(`update public.project_assets set status = 'completed' where id = $1`, [running.claimed_asset_id])).rejects.toThrow(/permission denied/)
    await expect(t.query(`update public.project_assets set entitlement_state = 'released' where id = $1`, [done.claimed_asset_id])).rejects.toThrow(/permission denied/)
    expect(await t.query(`update public.project_assets set content = 'sneaky' where id = $1 returning id`, [running.claimed_asset_id])).toHaveLength(0)
    expect(await t.query('delete from public.project_assets where id = $1 returning id', [running.claimed_asset_id])).toHaveLength(0)

    const stranger = await seedUser(t)
    await t.asUser(stranger.userId)
    expect(await t.query('select id from public.project_assets where project_id = $1', [projectId])).toHaveLength(0)
    expect(await t.query('delete from public.project_assets where id = $1 returning id', [done.claimed_asset_id])).toHaveLength(0)

    await t.asUser(userId)
    expect(await t.query('delete from public.project_assets where id = $1 returning id', [done.claimed_asset_id])).toHaveLength(1)
  })

  it('blocks deleting a project while its blueprint holds a reservation', async () => {
    const { userId, interviewId } = await seedUser(t)
    const claim = await beginBlueprint(userId, interviewId)
    await t.asUser(userId)
    expect(await t.query('delete from public.projects where id = $1 returning id', [claim.claimed_project_id])).toHaveLength(0)
    await finishBlueprint(userId, claim.claimed_project_id!, true)
    await t.asUser(userId)
    expect(await t.query('delete from public.projects where id = $1 returning id', [claim.claimed_project_id])).toHaveLength(1)
  })

  it('keeps generation accounting functions server-only', async () => {
    const { userId, interviewId } = await seedUser(t)
    await t.asUser(userId)
    await expect(t.query('select * from public.hke_begin_blueprint_generation($1, $2, $3, $4, false)', [userId, interviewId, uuid(), 'x'])).rejects.toThrow(/permission denied/)
    await expect(t.query('select * from public.try_consume_build($1)', [userId])).rejects.toThrow(/permission denied/)
  })
})

describe('step section persistence', () => {
  it('saves sections atomically without overwriting other sections or the blueprint', async () => {
    const { userId, interviewId } = await seedUser(t)
    const projectId = await seedProject(t, userId, interviewId, { business_summary: 'Keep me', launch_target: { audience: 'old' } })
    await t.asUser(userId)
    await t.query('select public.hke_save_project_section($1, $2, $3)', [projectId, 'customer_offer', JSON.stringify({ pricing: '$100' })])
    await t.query('select public.hke_save_project_section($1, $2, $3)', [projectId, 'launch_target', JSON.stringify({ audience: 'new' })])
    const row = await t.one<{ content: Record<string, unknown> }>('select content from public.projects where id = $1', [projectId])
    expect(row.content).toEqual({ business_summary: 'Keep me', launch_target: { audience: 'new' }, customer_offer: { pricing: '$100' } })
  })

  it('rejects unknown sections, non-objects, foreign projects, and archived projects', async () => {
    const { userId, interviewId } = await seedUser(t)
    const projectId = await seedProject(t, userId, interviewId)
    await t.asUser(userId)
    await expect(t.query('select public.hke_save_project_section($1, $2, $3)', [projectId, 'status', '{}'])).rejects.toThrow(/Unknown project section/)
    await expect(t.query('select public.hke_save_project_section($1, $2, $3)', [projectId, 'launch_target', '"text"'])).rejects.toThrow(/Invalid project section value/)

    const stranger = await seedUser(t)
    await t.asUser(stranger.userId)
    await expect(t.query('select public.hke_save_project_section($1, $2, $3)', [projectId, 'launch_target', '{}'])).rejects.toThrow(/Project not found/)

    await t.asUser(userId)
    await t.query('update public.projects set archived_at = now() where id = $1', [projectId])
    await expect(t.query('select public.hke_save_project_section($1, $2, $3)', [projectId, 'launch_target', '{}'])).rejects.toThrow(/archived/)
  })
})
