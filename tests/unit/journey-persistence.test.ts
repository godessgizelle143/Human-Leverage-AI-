import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mergeAssetLists, type AssetSummary } from '@/lib/hke/assets'
import { parseStepInput, STEP_SECTIONS, stepFormValues } from '@/lib/hke/steps'

/**
 * The customer journey after the blueprint: launch-plan steps saved and
 * reopened, assets generated from the project's saved knowledge, and every
 * read failure reported as a failure. A failed read used to look like an
 * empty project, a missing project, or (for asset generation) an interview
 * with no answers, which spent a credit on incomplete knowledge.
 */
const USER = '00000000-0000-4000-8000-0000000000a1'
const INTERVIEW = '00000000-0000-4000-8000-0000000000b1'
const PROJECT = '00000000-0000-4000-8000-0000000000c1'
const ASSET = '00000000-0000-4000-8000-0000000000d1'

type Result = { data: unknown; error: { message: string; code?: string } | null }

const mocks = vi.hoisted(() => ({
  tables: {} as Record<string, { data: unknown; error: { message: string; code?: string } | null }>,
  rpc: [] as { name: string; args: Record<string, unknown> }[],
  prompts: [] as string[],
}))

vi.mock('@/lib/supabase/server', () => {
  const from = (table: string) => {
    const result = (): Result => mocks.tables[table] ?? { data: null, error: null }
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      maybeSingle: async () => {
        const { data, error } = result()
        return { data: Array.isArray(data) ? data[0] ?? null : data, error }
      },
      then: (resolve: (value: Result) => unknown) => Promise.resolve(result()).then(resolve),
    }
    return builder
  }
  return {
    createServerSupabaseClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: USER, email: 'founder@example.test', email_confirmed_at: '2026-10-01T00:00:00Z' } } }) },
      from,
    }),
    // The generation store's client: records every credit claim and settlement.
    createServiceRoleClient: () => ({
      rpc(name: string, args: Record<string, unknown>) {
        mocks.rpc.push({ name, args })
        const data = name === 'hke_begin_asset_generation'
          ? { claimed_asset_id: ASSET, claimed_version: 1, denial_reason: null, plan_name: 'professional', build_credit_limit: 15 }
          : 'completed'
        const settled = Promise.resolve({ data, error: null })
        return Object.assign(settled, { single: () => settled })
      },
    }),
  }
})

vi.mock('@/lib/hke/intelligence/provider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/hke/intelligence/provider')>()),
  openAIProvider: {
    isConfigured: () => true,
    completeJson: async (request: { user: string }) => {
      mocks.prompts.push(request.user)
      return { text: JSON.stringify({ title: 'Crumb & Co FAQ', content_markdown: '# FAQ\n\n- How do I price a loaf? Start from your true cost.' }), truncated: false, model: 'test-model' }
    },
  },
}))

import { GET as listAssets, POST as generateAssetRoute } from '@/app/api/projects/[id]/assets/route'
import { GET as downloadKit } from '@/app/api/projects/[id]/kit/route'
import { GET as loadLaunchTarget } from '@/app/api/projects/[id]/launch-target/route'

const answers = { '1': 'Crumb & Co', '2': 'Profit-first pricing coaching for small bakeries' }
const project = {
  id: PROJECT,
  user_id: USER,
  interview_id: INTERVIEW,
  title: 'Crumb & Co',
  status: 'completed',
  archived_at: null,
  entitlement_state: 'consumed',
  created_at: '2026-10-10T00:00:00Z',
  updated_at: '2026-10-10T00:00:00Z',
  content: {
    business_summary: 'We teach owner-run bakeries to price for profit.',
    launch_target: { audience: 'Bakery owners in Leeds', location: 'Leeds', offer: 'Pricing audit', first_milestone: '10 audits sold' },
  },
}
const savedAsset = { id: ASSET, project_id: PROJECT, user_id: USER, asset_type: 'faq', title: 'Crumb & Co FAQ', content: '# FAQ', status: 'completed', version: 1, metadata: {}, error_message: null, entitlement_state: 'consumed', created_at: '2026-10-12T00:00:00Z', updated_at: '2026-10-12T00:00:00Z' }
const readFailure = { data: null, error: { message: 'connection reset' } }

const params = { params: { id: PROJECT } }
const request = (path: string, init?: RequestInit) => new Request(`https://hke.test/api/projects/${PROJECT}${path}`, init)
const generate = () => generateAssetRoute(request('/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'faq' }) }), params)

beforeEach(() => {
  mocks.tables = {
    projects: { data: project, error: null },
    interviews: { data: { messages: { version: 2, answers, current: 14, archived: false } }, error: null },
    project_assets: { data: [savedAsset], error: null },
  }
  mocks.rpc = []
  mocks.prompts = []
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('launch-plan steps reopen with what was saved', () => {
  it.each(STEP_SECTIONS.map((step) => [step.label, step] as const))('%s: every answer saved comes back into its own field', (_label, step) => {
    const typed = Object.fromEntries(step.fields.map((field, index) => [field.input, `  answer ${index} for ${field.label}  `]))
    const parsed = parseStepInput(step, typed)
    if (!parsed.ok) throw new Error(parsed.message)

    const reopened = stepFormValues(step, parsed.value)
    expect(reopened).toEqual(Object.fromEntries(step.fields.map((field, index) => [field.input, `answer ${index} for ${field.label}`])))
  })

  it('opens every field empty (never undefined) when nothing is saved or the saved value is malformed', () => {
    for (const saved of [null, undefined, 'text', ['a'], { audience: 42 }]) {
      const values = stepFormValues(STEP_SECTIONS[0], saved)
      expect(Object.keys(values).sort()).toEqual(STEP_SECTIONS[0].fields.map((field) => field.input).sort())
      expect(Object.values(values).every((value) => value === '')).toBe(true)
    }
  })

  it('reports a failed read as an error, not as a step with nothing saved (an empty form would overwrite it)', async () => {
    mocks.tables.projects = readFailure
    const response = await loadLaunchTarget(request('/launch-target'), params)
    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ code: 'database_error' })
  })

  it('returns the saved step when the read succeeds', async () => {
    const response = await loadLaunchTarget(request('/launch-target'), params)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ launchTarget: project.content.launch_target })
  })
})

describe('asset generation uses the saved project knowledge', () => {
  it('builds from the blueprint, the launch plan, and the interview answers, then returns the saved asset', async () => {
    const response = await generate()
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ asset: { id: ASSET, status: 'completed' } })

    expect(mocks.prompts).toHaveLength(1)
    expect(mocks.prompts[0]).toContain('We teach owner-run bakeries to price for profit.')
    expect(mocks.prompts[0]).toContain('Bakery owners in Leeds')
    expect(mocks.prompts[0]).toContain('Profit-first pricing coaching for small bakeries')

    expect(mocks.rpc.map((call) => call.name)).toEqual(['hke_begin_asset_generation', 'hke_finish_asset_generation'])
    expect(mocks.rpc[0].args).toMatchObject({ p_user_id: USER, p_project_id: PROJECT, p_asset_type: 'faq', p_skip_entitlement: false })
    expect(mocks.rpc[1].args).toMatchObject({ p_asset_id: ASSET, p_succeeded: true, p_content: expect.stringContaining('price a loaf') })
  })

  it('refuses to generate, and claims no credit, when the interview answers cannot be read', async () => {
    mocks.tables.interviews = readFailure
    const response = await generate()
    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ code: 'database_error' })
    expect(mocks.rpc).toEqual([])
    expect(mocks.prompts).toEqual([])
  })

  it('reports a failed project read as an error, not as "project not found"', async () => {
    mocks.tables.projects = readFailure
    const response = await generate()
    expect(response.status).toBe(500)
    expect(mocks.rpc).toEqual([])
  })
})

describe('reading saved assets back', () => {
  it('lists the saved assets', async () => {
    const response = await listAssets(request('/assets'), params)
    expect(await response.json()).toMatchObject({ assets: [{ id: ASSET }] })
  })

  it('reports a failed asset read as an error, not as a project with no assets', async () => {
    mocks.tables.project_assets = readFailure
    const response = await listAssets(request('/assets'), params)
    expect(response.status).toBe(500)
    expect(await response.json()).not.toHaveProperty('assets')
  })

  it('does not download a Knowledge Kit missing the interview when the answers cannot be read', async () => {
    mocks.tables.interviews = readFailure
    const response = await downloadKit(request('/kit?format=md'), params)
    expect(response.status).toBe(500)
    expect(response.headers.get('Content-Disposition')).toBeNull()
  })

  it('downloads a Knowledge Kit containing the saved asset and the founder\'s answers', async () => {
    const response = await downloadKit(request('/kit?format=md'), params)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toContain('knowledge-kit.md')
    const kit = await response.text()
    expect(kit).toContain('Crumb & Co FAQ')
    expect(kit).toContain('Profit-first pricing coaching for small bakeries')
  })
})

describe('the asset list a project page shows', () => {
  const asset = (id: string, status: AssetSummary['status']): AssetSummary => ({ id, project_id: PROJECT, asset_type: 'faq', title: id, status, version: 1, error_message: null, created_at: '2026-10-12T00:00:00Z', updated_at: '2026-10-12T00:00:00Z' })

  it('follows the server after a refresh, so a generation that finishes or fails shows its new status', () => {
    const shown = mergeAssetLists([asset('a', 'failed'), asset('b', 'completed')], [asset('a', 'generating')])
    expect(shown.map((item) => [item.id, item.status])).toEqual([['a', 'failed'], ['b', 'completed']])
  })

  it('shows a just-generated asset before the refresh that returns it', () => {
    const shown = mergeAssetLists([asset('b', 'completed')], [asset('new', 'completed')])
    expect(shown.map((item) => item.id)).toEqual(['new', 'b'])
  })
})
