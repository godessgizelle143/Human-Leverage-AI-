import { STEP_SECTIONS } from './steps'

export const BLUEPRINT_SECTIONS: { key: string; label: string }[] = [
  { key: 'elevator_pitch', label: 'Elevator Pitch' },
  { key: 'business_summary', label: 'Business Summary' },
  { key: 'ideal_customer', label: 'Ideal Customer' },
  { key: 'problem_solved', label: 'Problem Solved' },
  { key: 'differentiation', label: 'What Makes You Different' },
  { key: 'products_services', label: 'Products & Services' },
  { key: 'customer_transformation', label: 'Customer Transformation' },
  { key: 'brand_voice', label: 'Brand Voice' },
  { key: 'brand_visuals', label: 'Brand Colors & Style' },
  { key: 'origin_story', label: 'Origin Story' },
  { key: 'mission_values', label: 'Mission & Values' },
  { key: 'goals_6_12_months', label: 'Goals: Next 6–12 Months' },
  { key: 'marketing_strategy', label: 'Marketing Strategy' },
  { key: 'launch_roadmap', label: 'Launch Roadmap' },
  { key: 'next_steps', label: 'Next Steps' },
]

// Keys stored in projects.content that are not part of the generated blueprint.
const NON_BLUEPRINT_KEYS = new Set<string>([
  'recommended_modules',
  'capability_catalog_version',
  'generation',
  ...STEP_SECTIONS.map((step) => step.key),
])

export type BlueprintValue = string | string[] | { label: string; value: string }[]

/** Flattens whatever shape the model returned into readable text/list values. */
export function normalizeBlueprintValue(value: unknown): BlueprintValue | null {
  if (value == null) return null
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    const items = value.map((item) => (typeof item === 'string' ? item : flattenToText(item))).filter(Boolean)
    return items.length ? items : null
  }
  if (typeof value === 'object') {
    const pairs = Object.entries(value as Record<string, unknown>)
      .map(([key, inner]) => ({ label: humanize(key), value: flattenToText(inner) }))
      .filter((pair) => pair.value)
    return pairs.length ? pairs : null
  }
  return null
}

function flattenToText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(flattenToText).filter(Boolean).join('; ')
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, inner]) => `${humanize(key)}: ${flattenToText(inner)}`)
      .join(' · ')
  }
  return ''
}

export function humanize(key: string) {
  const text = key.replace(/[_-]+/g, ' ').trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Known sections in a sensible order, followed by any extra keys the model added. */
export function blueprintEntries(content: unknown) {
  const source = (content && typeof content === 'object' ? content : {}) as Record<string, unknown>
  const known = new Set(BLUEPRINT_SECTIONS.map((section) => section.key))
  const entries = [
    ...BLUEPRINT_SECTIONS.map((section) => ({ key: section.key, label: section.label, value: normalizeBlueprintValue(source[section.key]) })),
    ...Object.keys(source)
      .filter((key) => !known.has(key) && !NON_BLUEPRINT_KEYS.has(key))
      .map((key) => ({ key, label: humanize(key), value: normalizeBlueprintValue(source[key]) })),
  ]
  return entries.filter((entry): entry is { key: string; label: string; value: BlueprintValue } => entry.value !== null)
}

export function blueprintValueToText(value: BlueprintValue) {
  if (typeof value === 'string') return value
  return value.map((item) => (typeof item === 'string' ? `- ${item}` : `- **${item.label}:** ${item.value}`)).join('\n')
}

export function stepEntries(content: unknown, key: string) {
  const source = (content && typeof content === 'object' ? content : {}) as Record<string, unknown>
  const step = source[key]
  if (!step || typeof step !== 'object') return null
  return Object.entries(step as Record<string, unknown>)
    .map(([field, value]) => ({ label: humanize(field), value: flattenToText(value) }))
    .filter((entry) => entry.value)
}
