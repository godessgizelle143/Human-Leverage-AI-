import { describe, expect, it } from 'vitest'
import { buildKit, demoteHeadings, kitToHtml, kitToMarkdown, latestAssetsByType, stripLeadingTitle, type KitAsset } from '@/lib/hke/kit'
import { printableHtmlDocument } from '@/lib/hke/markdown'

const now = new Date('2026-10-08T12:00:00Z')

function asset(overrides: Partial<KitAsset> & Pick<KitAsset, 'asset_type'>): KitAsset {
  return { id: `id-${overrides.asset_type}-${overrides.version ?? 1}`, title: 'Untitled', content: 'Body text that is long enough.', version: 1, updated_at: now.toISOString(), ...overrides }
}

const content = {
  business_summary: 'We teach small bakeries to price for profit.',
  elevator_pitch: 'Profit-first pricing for bakeries.',
  ideal_customer: ['Owner-operated bakeries'],
  launch_target: { audience: 'Bakery owners', location: 'Portland' },
  recommended_modules: ['x'],
}

describe('latestAssetsByType', () => {
  it('keeps the newest version of each type, in catalog order', () => {
    const result = latestAssetsByType([
      asset({ asset_type: 'faq', version: 1, title: 'FAQ v1' }),
      asset({ asset_type: 'brand_story', version: 1, title: 'Story' }),
      asset({ asset_type: 'faq', version: 3, title: 'FAQ v3' }),
      asset({ asset_type: 'faq', version: 2, title: 'FAQ v2' }),
    ])
    expect(result.map((item) => item.title)).toEqual(['Story', 'FAQ v3'])
  })

  it('places asset types missing from the catalog last', () => {
    const result = latestAssetsByType([asset({ asset_type: 'retired_type', title: 'Old' }), asset({ asset_type: 'one_pager', title: 'One pager' })])
    expect(result.map((item) => item.title)).toEqual(['One pager', 'Old'])
  })
})

describe('heading helpers', () => {
  it('demotes headings without exceeding six levels or touching other lines', () => {
    expect(demoteHeadings('# A\n## B\nText with # hash\n##### E\n#NoSpace', 2)).toBe('### A\n#### B\nText with # hash\n###### E\n#NoSpace')
  })

  it('drops a leading title that repeats the section heading', () => {
    expect(stripLeadingTitle('# **Pricing FAQ**\n\n## Q1\nA', 'Pricing FAQ')).toBe('## Q1\nA')
    expect(stripLeadingTitle('# Something else\n\nBody', 'Pricing FAQ')).toBe('# Something else\n\nBody')
  })
})

describe('buildKit', () => {
  it('orders blueprint, plan, assets, then the interview source', () => {
    const kit = buildKit({
      title: 'Bakery Pricing',
      content,
      answers: { '1': 'I run a bakery consultancy.' },
      assets: [asset({ asset_type: 'faq', title: 'Pricing FAQ', content: '# Pricing FAQ\n\n## Costs\n\n- Know your unit cost.', version: 2 })],
      now,
    })
    expect(kit.sections.map((section) => section.kind)).toEqual(['blueprint', 'plan', 'asset', 'source'])
    const faq = kit.sections[2]
    expect(faq).toMatchObject({ heading: 'Pricing FAQ', label: 'FAQ · version 2' })
    expect(faq.markdown.startsWith('## Costs')).toBe(true)
    expect(kit.sections[0].markdown).not.toContain('recommended')
  })

  it('omits empty parts instead of rendering blank sections', () => {
    const kit = buildKit({ title: 'Empty', content: {}, answers: {}, assets: [], now })
    expect(kit.sections).toEqual([])
    expect(kitToMarkdown(kit)).toContain('# Empty — Knowledge Kit')
  })
})

describe('kit rendering', () => {
  const kit = buildKit({
    title: 'Bakery <Pricing>',
    content,
    answers: {},
    assets: [asset({ asset_type: 'faq', title: 'FAQ <script>alert(1)</script>', content: '## Costs\n\n**Know** your <b>unit</b> cost.' })],
    now,
  })

  it('nests every part under its own heading in Markdown', () => {
    const markdown = kitToMarkdown(kit)
    expect(markdown).toContain('## Contents')
    expect(markdown).toContain('## Knowledge Blueprint')
    expect(markdown).toContain('### Elevator Pitch')
    expect(markdown).toContain('#### Costs')
    expect(markdown).toContain('October 8, 2026')
  })

  it('escapes all user and model text in the print-ready HTML', () => {
    const html = kitToHtml(kit)
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>unit</b>')
    expect(html).toContain('FAQ &lt;script&gt;')
    expect(html).toContain('<title>Bakery &lt;Pricing&gt; — Knowledge Kit</title>')
    expect(html).toContain('<strong>Know</strong>')
    expect(html.match(/<section class="part"/g)).toHaveLength(3)
    expect(html).toContain('Speak Once. Build Forever.')
  })
})

describe('printableHtmlDocument', () => {
  it('still renders a titled, escaped single document', () => {
    const html = printableHtmlDocument('A & B', '# Heading\n\nText')
    expect(html).toContain('<title>A &amp; B</title>')
    expect(html).toContain('<h1>A &amp; B</h1>\n<h1>Heading</h1>')
    expect(html).toContain('Created with HKE AI — Speak Once. Build Forever.')
  })
})
