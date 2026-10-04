import type { AssetStatus, ProjectAssetRow } from './db'
import type { AssetTypeDefinition } from './domain'

/**
 * The asset engine's catalog. Adding an asset type means adding an entry here;
 * the generation route, prompt, and UI all read from it. Ids are stored in
 * project_assets.asset_type and must match ^[a-z0-9_]{1,64}$.
 */
export const ASSET_TYPES = [
  { id: 'brand_story', label: 'Brand Story', category: 'brand', description: 'Origin story, values, and what they mean for customers.', instructions: 'Write a brand story with sections: Origin, What We Believe, How We Work, and What This Means For Customers. 500-800 words.' },
  { id: 'mission_statement', label: 'Mission Statement', category: 'brand', description: 'Mission, vision, and core values in your voice.', instructions: 'Write a mission statement (one or two sentences), a vision statement, and 3-6 core values each with a one-sentence explanation. Then give three alternative mission statement variants.' },
  { id: 'landing_page', label: 'Landing Page', category: 'marketing', description: 'Hero, benefits, offer, and call to action copy.', instructions: 'Write landing page copy with sections: Hero headline and subheadline, The Problem, The Solution, Benefits (bulleted), How It Works (numbered steps), Offer, FAQ (3-5 items), Final Call to Action.' },
  { id: 'sales_page', label: 'Sales Page', category: 'marketing', description: 'Long-form persuasive page for your main offer.', instructions: 'Write long-form sales page copy with sections: Headline, Who This Is For, The Problem, The Transformation, What You Get, Why This Is Different, Pricing/Next Step, Guarantee, FAQ, Final Call to Action. Use [placeholders] for any price, guarantee, or proof the founder has not provided.' },
  { id: 'lead_magnet', label: 'Lead Magnet', category: 'marketing', description: 'A free, practical resource that attracts ideal customers.', instructions: 'Create a lead magnet (checklist or quick-start guide) with a title, a short introduction, 7-12 actionable items or steps with one-line explanations, and a closing call to action.' },
  { id: 'email_sequence', label: 'Email Sequence', category: 'marketing', description: 'A 5-email welcome and nurture sequence.', instructions: 'Write a 5-email welcome sequence. For each email include a heading "Email N", a Subject line, Preview text, and the Body. End each with a single clear call to action.' },
  { id: 'cta_set', label: 'Calls to Action', category: 'marketing', description: 'Buttons, banners, and closing lines that convert.', instructions: 'Write calls to action grouped by use: Button text (8 options), Banner/headline CTAs (5), Social post closing lines (5), and Email closing lines (5).' },
  { id: 'blog_content', label: 'Blog Articles', category: 'content', description: 'Three article ideas with one fully drafted post.', instructions: 'Provide 3 blog article ideas (title + one-sentence angle each), then fully draft the strongest one as a 700-1000 word article with subheadings.' },
  { id: 'faq', label: 'FAQ', category: 'content', description: 'Customer questions with clear answers.', instructions: 'Write 10-12 frequently asked questions customers would ask, each with a clear, concise answer. Group them under 2-4 headings.' },
  { id: 'product_description', label: 'Product & Service Descriptions', category: 'content', description: 'Descriptions for your top products or services.', instructions: 'Write a description for each product or service the founder named: a name heading, a one-line hook, a 100-150 word description, and 3-5 key benefit bullets.' },
  { id: 'ebook', label: 'Ebook Outline & Opening', category: 'education', description: 'Chapter outline plus a drafted introduction.', instructions: 'Create an ebook: title, subtitle, a chapter outline (6-10 chapters, each with 2-3 bullet points), then a fully drafted Introduction of 500-700 words.' },
  { id: 'workbook', label: 'Workbook', category: 'education', description: 'Exercises and prompts that apply your method.', instructions: 'Create a workbook with a title, a short how-to-use section, and 5-7 modules. Each module has a short explanation, 3-5 reflection prompts, and one action exercise.' },
  { id: 'course', label: 'Course Outline', category: 'education', description: 'Modules, lessons, and outcomes for a course.', instructions: 'Create a course outline: course title, promise, who it is for, 5-8 modules each with 3-5 lesson titles and one learning outcome, plus suggested bonuses.' },
  { id: 'one_pager', label: 'One-Page Overview (PDF)', category: 'document', description: 'A print-ready business overview to share or attach.', instructions: 'Write a one-page business overview designed to be printed or saved as PDF: business name as the title, a one-paragraph summary, Who We Serve, What We Offer (bulleted), Why Us (bulleted), How To Get Started, and contact [placeholders]. Keep it under 450 words.' },
] as const satisfies readonly AssetTypeDefinition[]

export type AssetTypeId = (typeof ASSET_TYPES)[number]['id']

export const ASSET_TYPE_IDS = ASSET_TYPES.map((type) => type.id) as [AssetTypeId, ...AssetTypeId[]]

const CATEGORY_LABELS: Record<AssetTypeDefinition['category'], string> = {
  brand: 'Brand',
  marketing: 'Marketing',
  content: 'Content',
  education: 'Education',
  document: 'Documents',
}

export function assetCategoryLabel(category: AssetTypeDefinition['category']) {
  return CATEGORY_LABELS[category]
}

export function getAssetType(id: string): AssetTypeDefinition | undefined {
  return ASSET_TYPES.find((type) => type.id === id)
}

export function assetTypeLabel(id: string) {
  return getAssetType(id)?.label ?? id.replaceAll('_', ' ')
}

export const MAX_ASSET_LENGTH = 200000

/** Mirrors the five-minute window after which the database settles an interrupted generation. */
export const STALE_GENERATION_MS = 5 * 60 * 1000

/** Display status: a generation past the stale window is shown as interrupted. */
export type AssetDisplayStatus = AssetStatus | 'interrupted'

export function displayStatus(asset: Pick<ProjectAssetRow, 'status' | 'updated_at'>, now = Date.now()): AssetDisplayStatus {
  if (asset.status === 'generating' && now - new Date(asset.updated_at).getTime() > STALE_GENERATION_MS) return 'interrupted'
  return asset.status
}

/** The asset fields the UI needs (no ownership or accounting columns). */
export type AssetSummary = Pick<ProjectAssetRow, 'id' | 'project_id' | 'asset_type' | 'title' | 'status' | 'version' | 'error_message' | 'created_at' | 'updated_at'>
