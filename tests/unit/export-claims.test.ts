import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ASSET_TYPES } from '@/lib/hke/assets'
import { PRICING_PLANS } from '@/lib/stripe/client'

/**
 * What the pricing cards promise about exports, and the downloads that keep
 * that promise. HKE exports Markdown and a print-ready HTML page that the
 * customer saves as PDF from the browser; no route returns a PDF file, so no
 * plan may claim one. Exports are the customer's own work and are open on
 * every plan, including after a plan lapses.
 */
const EXPORT_FEATURE = 'Print-ready exports (save as PDF) + Markdown'

const USER = '00000000-0000-4000-8000-0000000000a1'
const OTHER_USER = '00000000-0000-4000-8000-0000000000a2'
const INTERVIEW = '00000000-0000-4000-8000-0000000000b1'
const PROJECT = '00000000-0000-4000-8000-0000000000c1'
const OTHER_PROJECT = '00000000-0000-4000-8000-0000000000c2'
const ASSET = '00000000-0000-4000-8000-0000000000d1'

type Row = Record<string, unknown>

const mocks = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  queried: [] as string[],
}))

// Applies .eq() filters to the rows, so ownership and status checks in the routes are really exercised.
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: USER, email: 'founder@example.test', email_confirmed_at: '2026-10-01T00:00:00Z' } } }) },
    from(table: string) {
      mocks.queried.push(table)
      let rows = [...(mocks.rows[table] ?? [])]
      const builder: Record<string, unknown> = {
        select: () => builder,
        order: () => builder,
        eq: (column: string, value: unknown) => { rows = rows.filter((row) => row[column] === value); return builder },
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
      }
      return builder
    },
  }),
}))

import { GET as exportAsset } from '@/app/api/projects/[id]/assets/[assetId]/export/route'
import { GET as exportBlueprint } from '@/app/api/projects/[id]/export/route'
import { GET as exportKit } from '@/app/api/projects/[id]/kit/route'

const answers = { '1': 'Crumb & Co', '2': 'Profit-first pricing coaching for small bakeries' }
const project: Row = {
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
const asset = (overrides: Row = {}): Row => ({
  id: ASSET,
  project_id: PROJECT,
  user_id: USER,
  asset_type: 'one_pager',
  title: 'Crumb & Co <Overview>',
  content: '## Who We Serve\n\n- Owner-run bakeries\n- **Under 10 staff**',
  status: 'completed',
  version: 1,
  updated_at: '2026-10-12T00:00:00Z',
  ...overrides,
})

const url = (path: string) => `https://hke.test/api/projects/${PROJECT}${path}`
const downloadAsset = (format: string, ids = { id: PROJECT, assetId: ASSET }) => exportAsset(new Request(url(`/assets/${ASSET}/export?format=${format}`)), { params: ids })

beforeEach(() => {
  mocks.rows = {
    projects: [project],
    interviews: [{ id: INTERVIEW, user_id: USER, messages: { version: 2, answers, current: 14, archived: false } }],
    project_assets: [asset()],
    // No plan at all: an expired or cancelled trial must not lock anyone out of their own work.
    subscriptions: [],
  }
  mocks.queried = []
})

describe('pricing export claims', () => {
  const plans = Object.values(PRICING_PLANS)

  it('makes the same, accurate export promise on every paid plan', () => {
    for (const plan of plans) expect(plan.features).toContain(EXPORT_FEATURE)
  })

  it('never promises a PDF file or a "priority" export, which no route provides', () => {
    for (const plan of plans) {
      for (const feature of plan.features.filter((item) => item !== EXPORT_FEATURE)) {
        expect(feature).not.toMatch(/pdf/i)
        expect(feature).not.toMatch(/priority.*export/i)
      }
    }
  })

  it('does not label any asset type as a PDF', () => {
    for (const type of ASSET_TYPES) expect(type.label).not.toMatch(/pdf/i)
  })
})

describe('asset download', () => {
  it('downloads the saved asset as Markdown', async () => {
    const response = await downloadAsset('md')
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8')
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="crumb-co-crumb-co-overview.md"')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.text()).toBe('# Crumb & Co <Overview>\n\n## Who We Serve\n\n- Owner-run bakeries\n- **Under 10 staff**\n')
  })

  it('downloads the saved asset as a complete, escaped print-ready page', async () => {
    const response = await downloadAsset('html')
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="crumb-co-crumb-co-overview.html"')
    const html = await response.text()
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<title>Crumb &amp; Co &lt;Overview&gt;</title>')
    expect(html).toContain('<h1>Crumb &amp; Co &lt;Overview&gt;</h1>')
    expect(html).toContain('<li><strong>Under 10 staff</strong></li>')
    expect(html).not.toContain('<Overview>')
    expect(html.trimEnd().endsWith('</html>')).toBe(true)
  })

  it('falls back to Markdown for an unknown format rather than claiming one it cannot make', async () => {
    const response = await downloadAsset('pdf')
    expect(response.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8')
    expect(response.headers.get('Content-Disposition')).toMatch(/\.md"$/)
  })

  it.each([
    ['still generating', { status: 'generating' }],
    ['failed', { status: 'failed' }],
    ["another user's", { user_id: OTHER_USER }],
    ['in another project', { project_id: OTHER_PROJECT }],
  ])('refuses an asset that is %s', async (_label, overrides) => {
    mocks.rows.project_assets = [asset(overrides)]
    const response = await downloadAsset('html')
    expect(response.status).toBe(404)
    expect(response.headers.get('Content-Disposition')).toBeNull()
  })

  it("refuses an asset under another user's project", async () => {
    mocks.rows.projects = [{ ...project, user_id: OTHER_USER }]
    const response = await downloadAsset('md')
    expect(response.status).toBe(404)
  })
})

describe('blueprint download', () => {
  it('contains the blueprint, the launch plan, and the interview answers', async () => {
    const response = await exportBlueprint(new Request(url('/export?format=md')), { params: { id: PROJECT } })
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="crumb-co-blueprint.md"')
    const markdown = await response.text()
    expect(markdown).toContain('We teach owner-run bakeries to price for profit.')
    expect(markdown).toContain('Bakery owners in Leeds')
    expect(markdown).toContain('Profit-first pricing coaching for small bakeries')
  })

  it('renders the same content as a print-ready page', async () => {
    const response = await exportBlueprint(new Request(url('/export?format=html')), { params: { id: PROJECT } })
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    const html = await response.text()
    expect(html).toContain('<h1>Crumb &amp; Co — Blueprint</h1>')
    expect(html).toContain('Bakery owners in Leeds')
  })
})

describe('Knowledge Kit download', () => {
  it('starts each part on a new printed page', async () => {
    const response = await exportKit(new Request(url('/kit?format=html')), { params: { id: PROJECT } })
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="crumb-co-knowledge-kit.html"')
    const html = await response.text()
    expect(html).toContain('break-before: page')
    // Blueprint, launch plan, the asset, and the interview source.
    expect(html.match(/<section class="part"/g)).toHaveLength(4)
    expect(html).toContain('Crumb &amp; Co &lt;Overview&gt;')
  })

  it('is refused while the blueprint is still building', async () => {
    mocks.rows.projects = [{ ...project, status: 'generating' }]
    const response = await exportKit(new Request(url('/kit?format=html')), { params: { id: PROJECT } })
    expect(response.status).toBe(409)
  })
})

describe('exports are open on every plan', () => {
  it('serves every download without reading or requiring a subscription', async () => {
    const responses = [
      await downloadAsset('md'),
      await downloadAsset('html'),
      await exportBlueprint(new Request(url('/export?format=html')), { params: { id: PROJECT } }),
      await exportKit(new Request(url('/kit?format=md')), { params: { id: PROJECT } }),
    ]
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200])
    expect(mocks.queried).not.toContain('subscriptions')
  })
})
