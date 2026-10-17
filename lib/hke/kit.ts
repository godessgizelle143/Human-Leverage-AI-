import { INTERVIEW_QUESTIONS } from '@/types/interview'
import { ASSET_TYPES, assetTypeLabel } from './assets'
import { blueprintEntries, blueprintValueToText, stepEntries } from './blueprint'
import type { ProjectAssetRow } from './db'
import { BRAND } from '../brand'
import type { InterviewAnswers } from './interview'
import { escapeHtml, markdownToHtml, printableShell } from './markdown'
import { STEP_SECTIONS } from './steps'

/**
 * The Knowledge Kit: everything HKE built from one project's knowledge, as a
 * single document — blueprint, launch plan, the latest version of every
 * asset, and the interview answers it all came from.
 */

export type KitAsset = Pick<ProjectAssetRow, 'id' | 'asset_type' | 'title' | 'content' | 'version' | 'updated_at'>

export type KitSection = {
  id: string
  kind: 'blueprint' | 'plan' | 'asset' | 'source'
  heading: string
  /** Shown under the heading in the contents, e.g. the asset type. */
  label: string
  /** Section body; its top-level headings start at `#`. */
  markdown: string
}

export type Kit = { title: string; generatedAt: string; sections: KitSection[] }

const CATALOG_ORDER = new Map<string, number>(ASSET_TYPES.map((type, index) => [type.id, index]))

/**
 * The newest version of each asset type, in catalog order. Callers pass
 * completed assets only; other versions stay in the workspace.
 */
export function latestAssetsByType<T extends Pick<ProjectAssetRow, 'asset_type' | 'version' | 'title'>>(assets: T[]): T[] {
  const latest = new Map<string, T>()
  for (const asset of assets) {
    const current = latest.get(asset.asset_type)
    if (!current || asset.version > current.version) latest.set(asset.asset_type, asset)
  }
  return Array.from(latest.values()).sort(
    (a, b) => (CATALOG_ORDER.get(a.asset_type) ?? Infinity) - (CATALOG_ORDER.get(b.asset_type) ?? Infinity) || a.title.localeCompare(b.title),
  )
}

/** Pushes every heading down `levels` levels so a document nests under a section heading. */
export function demoteHeadings(markdown: string, levels: number) {
  if (levels <= 0) return markdown
  const prefix = '#'.repeat(levels)
  return markdown.replace(/^(\s*)(#{1,6})(?=\s)/gm, (_match, indent: string, hashes: string) => `${indent}${(prefix + hashes).slice(0, 6)}`)
}

/** Drops a leading `# Title` that only repeats the section heading. */
export function stripLeadingTitle(markdown: string, title: string) {
  const match = /^\s*#\s+(.+?)\s*(?:\n|$)/.exec(markdown)
  if (!match || match[1].replace(/[*_]/g, '').trim().toLowerCase() !== title.trim().toLowerCase()) return markdown.trim()
  return markdown.slice(match[0].length).trim()
}

function blueprintSection(content: Record<string, unknown>): KitSection | null {
  const entries = blueprintEntries(content)
  if (!entries.length) return null
  const markdown = entries.map((entry) => `# ${entry.label}\n\n${blueprintValueToText(entry.value)}`).join('\n\n')
  return { id: 'blueprint', kind: 'blueprint', heading: 'Knowledge Blueprint', label: 'What HKE AI extracted from your interview', markdown }
}

function planSection(content: Record<string, unknown>): KitSection | null {
  const parts = STEP_SECTIONS.flatMap((step) => {
    const entries = stepEntries(content, step.key)
    return entries?.length ? [`# ${step.label}\n\n${entries.map((entry) => `- **${entry.label}:** ${entry.value}`).join('\n')}`] : []
  })
  if (!parts.length) return null
  return { id: 'launch-plan', kind: 'plan', heading: 'Launch Plan', label: 'Your decisions for taking it to market', markdown: parts.join('\n\n') }
}

function sourceSection(answers: InterviewAnswers): KitSection | null {
  const answered = INTERVIEW_QUESTIONS.filter((question) => answers[String(question.id)]?.trim())
  if (!answered.length) return null
  const markdown = answered.map((question) => `# ${question.question}\n\n${answers[String(question.id)].trim()}`).join('\n\n')
  return { id: 'interview', kind: 'source', heading: 'Source: Your Interview', label: 'The knowledge everything above was built from', markdown }
}

export function buildKit(input: { title: string; content: Record<string, unknown>; answers: InterviewAnswers; assets: KitAsset[]; now?: Date }): Kit {
  const assetSections: KitSection[] = latestAssetsByType(input.assets).map((asset) => ({
    id: `asset-${asset.id}`,
    kind: 'asset',
    heading: asset.title,
    label: `${assetTypeLabel(asset.asset_type)}${asset.version > 1 ? ` · version ${asset.version}` : ''}`,
    markdown: stripLeadingTitle(asset.content, asset.title),
  }))

  const sections = [blueprintSection(input.content), planSection(input.content), ...assetSections, sourceSection(input.answers)]
  return {
    title: input.title,
    generatedAt: (input.now ?? new Date()).toISOString(),
    sections: sections.filter((section): section is KitSection => section !== null),
  }
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })

export function kitToMarkdown(kit: Kit) {
  const contents = kit.sections.map((section, index) => `${index + 1}. ${section.heading} — ${section.label}`).join('\n')
  const body = kit.sections.map((section) => `## ${section.heading}\n\n*${section.label}*\n\n${demoteHeadings(section.markdown, 2)}`).join('\n\n---\n\n')
  return `# ${kit.title} — Knowledge Kit\n\n*Speak Once. Build Forever.* · Built with HKE AI on ${formatDate(kit.generatedAt)}\n\n## Contents\n\n${contents}\n\n---\n\n${body}\n`
}

const KIT_STYLES = `
  .cover { min-height: 60vh; display: flex; flex-direction: column; justify-content: center; }
  .cover .plate { background: ${BRAND.black}; color: ${BRAND.white}; border-left: 6px solid ${BRAND.pink}; border-radius: 4px; padding: 2.5rem 2rem; margin-bottom: 1.5rem; }
  .cover .eyebrow { font: 600 12px Helvetica, Arial, sans-serif; letter-spacing: .2em; text-transform: uppercase; color: ${BRAND.pink}; margin: 0; }
  .cover h1 { font-size: 2.6rem; margin: .5rem 0 1rem; color: ${BRAND.white}; border-bottom-color: ${BRAND.gold}; }
  .cover .meta { color: ${BRAND.white}; opacity: .7; font-style: italic; margin: 0; }
  .contents { padding-left: 1.25rem; }
  .contents li { margin: .35rem 0; }
  .contents a { color: inherit; text-decoration: none; }
  .contents span { color: #888; font-size: .9em; }
  .part { break-before: page; page-break-before: always; padding-top: 1rem; }
  .part > .label { color: #888; font-style: italic; margin-top: -.5rem; }`

/** The kit as a print-ready page (Print → Save as PDF), one part per page. */
export function kitToHtml(kit: Kit) {
  const contents = kit.sections
    .map((section) => `<li><a href="#${section.id}">${escapeHtml(section.heading)}</a> <span>— ${escapeHtml(section.label)}</span></li>`)
    .join('')
  const parts = kit.sections
    .map((section) => `<section class="part" id="${section.id}">\n<h1>${escapeHtml(section.heading)}</h1>\n<p class="label">${escapeHtml(section.label)}</p>\n${markdownToHtml(demoteHeadings(section.markdown, 1))}\n</section>`)
    .join('\n')
  const cover = `<header class="cover">
<div class="plate">
<p class="eyebrow">Knowledge Kit</p>
<h1>${escapeHtml(kit.title)}</h1>
<p class="meta">Speak Once. Build Forever. · Built with HKE AI on ${escapeHtml(formatDate(kit.generatedAt))}</p>
</div>
<h2>Contents</h2>
<ol class="contents">${contents}</ol>
</header>`
  return printableShell(`${kit.title} — Knowledge Kit`, `${cover}\n${parts}`, KIT_STYLES)
}
