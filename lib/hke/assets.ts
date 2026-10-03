import { INTERVIEW_QUESTIONS } from '@/types/interview'

export type HKEAssetStatus = 'generating' | 'completed' | 'failed'

export type HKEAsset = {
  id: string
  project_id: string
  asset_type: string
  title: string
  content: string
  status: HKEAssetStatus
  version: number
  created_at: string
  updated_at: string
}

type HKEAssetDefinition = {
  label: string
  /** Blueprint keys from projects.content that this asset draws on, with prompt labels. */
  blueprintFields: Record<string, string>
  /** Saved Step 01-04 sections from projects.content that this asset draws on. */
  stepSections: (keyof typeof HKE_STEP_SECTIONS)[]
  instructions: string
  maxTokens: number
}

/** Saved project steps, keyed by their projects.content key. Only user-entered fields are listed. */
export const HKE_STEP_SECTIONS = {
  launch_target: {
    label: 'Step 01 · Launch target',
    fields: { audience: 'Audience', location: 'Location / service area', offer: 'Offer', first_milestone: 'First milestone' },
  },
  customer_offer: {
    label: 'Step 02 · Customer offer',
    fields: { service_name: 'Service or product name', customer_gets: 'What the customer gets', pricing: 'Pricing', booking: 'How customers book or buy', next_action: 'Next action for the customer' },
  },
  customer_foundation: {
    label: 'Step 03 · Customer foundation',
    fields: { foundation_type: 'What is being built first', customer_experience: 'What the customer should be able to do', customer_information: 'Information needed from the customer', after_submission: 'What happens after they submit' },
  },
  launch_content: {
    label: 'Step 04 · Launch content',
    fields: { launch_goal: 'Launch goal', audience: 'Who to reach first', channels: 'Where the launch will be promoted', call_to_action: 'Call to action' },
  },
} as const

/**
 * HKE asset registry. Adding an asset type means adding an entry here; the
 * generation endpoint, prompt construction, and UI all read from this map.
 */
export const HKE_ASSET_TYPES = {
  sales_page: {
    label: 'Sales Page',
    blueprintFields: {
      business_summary: 'Business summary',
      ideal_customer: 'Ideal customer',
      problem_solved: 'Problem solved',
      customer_transformation: 'Customer needs and transformation',
      differentiation: 'Differentiation',
      products_services: 'Products and services',
      brand_voice: 'Brand voice',
      origin_story: 'Origin story',
      mission_values: 'Mission and values',
      marketing_strategy: 'Marketing strategy',
      launch_roadmap: 'Launch roadmap',
      elevator_pitch: 'Elevator pitch',
      next_steps: 'Next steps',
    },
    stepSections: ['launch_target', 'customer_offer', 'customer_foundation', 'launch_content'],
    instructions: [
      'Write a complete, ready-to-edit sales page for the offer described in the project context.',
      'Structure it with these sections, each starting with its heading on its own line: Headline, Subheadline, The Problem, The Solution, What You Get, Who This Is For, Why Us, Our Story, Pricing, How It Works, Call to Action.',
      'Write in the brand voice from the context. Speak directly to the ideal customer.',
      'Use the saved customer offer for the offer name, deliverables, pricing, and booking or purchase steps, and the launch content call to action for the final call to action.',
      'Omit a section if the context has nothing for it rather than padding it.',
    ].join('\n'),
    maxTokens: 4000,
  },
} satisfies Record<string, HKEAssetDefinition>

export type HKEAssetType = keyof typeof HKE_ASSET_TYPES

export function isHKEAssetType(value: unknown): value is HKEAssetType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(HKE_ASSET_TYPES, value)
}

export function getHKEAssetLabel(assetType: string): string {
  return isHKEAssetType(assetType) ? HKE_ASSET_TYPES[assetType].label : assetType.replaceAll('_', ' ')
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join('; ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

/**
 * Builds the plain-text project context for one asset type from the saved
 * interview answers, the generated blueprint, and any saved Step 01-04 data.
 * Empty fields are left out so the model is not prompted to fill them in.
 */
export function buildHKEAssetContext(
  assetType: HKEAssetType,
  project: { title: string; content: unknown },
  interviewAnswers: unknown
): { context: string; hasBlueprint: boolean } {
  const definition: HKEAssetDefinition = HKE_ASSET_TYPES[assetType]
  const content = asRecord(project.content)
  const sections: string[] = [`PROJECT: ${project.title}`]

  const blueprintLines = Object.entries(definition.blueprintFields)
    .map(([key, label]) => [label, asText(content[key])] as const)
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
  if (blueprintLines.length) sections.push(`BLUEPRINT\n${blueprintLines.join('\n')}`)

  for (const key of definition.stepSections) {
    const step = HKE_STEP_SECTIONS[key]
    const saved = asRecord(content[key])
    const lines = Object.entries(step.fields)
      .map(([field, label]) => [label, asText(saved[field])] as const)
      .filter(([, value]) => value)
      .map(([label, value]) => `${label}: ${value}`)
    if (lines.length) sections.push(`${step.label.toUpperCase()}\n${lines.join('\n')}`)
  }

  const answers = asRecord(interviewAnswers)
  const interviewLines = INTERVIEW_QUESTIONS
    .map((question) => [question.question, asText(answers[String(question.id)])] as const)
    .filter(([, value]) => value)
    .map(([question, value]) => `Q: ${question}\nA: ${value}`)
  if (interviewLines.length) sections.push(`ORIGINAL INTERVIEW ANSWERS\n${interviewLines.join('\n\n')}`)

  return { context: sections.join('\n\n'), hasBlueprint: blueprintLines.length > 0 }
}

export const HKE_ASSET_SYSTEM_PROMPT = `You are the HKE asset writer. You turn a founder's saved knowledge into finished business assets.
Use only facts present in the supplied project context. Never invent testimonials, results, statistics, customer counts, revenue, prices, guarantees, credentials, partnerships, or awards.
When a section would normally need a fact the context does not contain, write a short bracketed placeholder such as [Add a customer testimonial] instead of making one up.
Write plain text: section headings on their own line, short paragraphs, and "- " for bullet points. Do not use markdown symbols such as #, *, or **.`

export function buildHKEAssetMessages(assetType: HKEAssetType, context: string) {
  const definition: HKEAssetDefinition = HKE_ASSET_TYPES[assetType]
  return [
    { role: 'system' as const, content: `${HKE_ASSET_SYSTEM_PROMPT}\nReturn valid JSON only with these keys: title (a short title for this ${definition.label.toLowerCase()}), content (the full asset as plain text).` },
    { role: 'user' as const, content: `ASSET TYPE: ${definition.label}\n\nINSTRUCTIONS:\n${definition.instructions}\n\nPROJECT CONTEXT:\n${context}` },
  ]
}

export function getHKEAssetMaxTokens(assetType: HKEAssetType): number {
  return (HKE_ASSET_TYPES[assetType] as HKEAssetDefinition).maxTokens
}
