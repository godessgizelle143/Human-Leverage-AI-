import { HLAI_CAPABILITIES } from '@/lib/ai/capabilities'
import { INTERVIEW_QUESTIONS } from '@/types/interview'
import type { AssetTypeDefinition } from '../domain'
import type { InterviewAnswers } from '../interview'
import type { JsonCompletionRequest } from './provider'

const GROUNDING_RULES = `Use only facts the founder supplied. Never invent testimonials, statistics, revenue, customer counts, prices, guarantees, credentials, partnerships, awards, or results.
Where a fact is missing, write a clearly marked [placeholder] instead of making one up.`

export const BLUEPRINT_PROMPT_VERSION = 2
export const ASSET_PROMPT_VERSION = 1

/** Interview → structured knowledge blueprint. */
export function blueprintRequest(answers: InterviewAnswers): JsonCompletionRequest {
  const catalog = HLAI_CAPABILITIES.map(({ id, name, category, description, stage }) => ({ id, name, category, description, stage }))
  const interview = INTERVIEW_QUESTIONS
    .filter((question) => answers[String(question.id)]?.trim())
    .map((question) => `Q: ${question.question}\nA: ${answers[String(question.id)].trim()}`)
    .join('\n\n')

  return {
    temperature: 0.6,
    maxOutputTokens: 4000,
    system: `You are HKE AI (Human Knowledge Engine AI). You extract a founder's knowledge from an interview into a structured business blueprint.
Preserve the founder's actual ideas, words, and voice. ${GROUNDING_RULES}
Return valid JSON only with these keys:
business_summary (string, required), elevator_pitch (string, required), ideal_customer, problem_solved, differentiation, products_services, brand_voice, brand_visuals, origin_story, mission_values, customer_transformation, goals_6_12_months, marketing_strategy, launch_roadmap, next_steps.
Each non-required value is a string, an array of strings, or an object of short labelled strings.
recommended_modules: an array containing only capability ids from the supplied catalog that would materially help this business next.
brand_visuals: the brand colors and visual style the founder described. Quietly fix spelling, punctuation, and capitalization, and turn a run-together list into a clean one (for example, "blu grean and gold" becomes "Blue, green, and gold"). Keep every color and style they named and add none of your own, including hex codes they did not give. Leave this key out if they did not answer.`,
    user: `CAPABILITY CATALOG:\n${JSON.stringify(catalog)}\n\nINTERVIEW:\n${interview}`,
  }
}

/** Knowledge → one finished asset. */
export function assetRequest(type: AssetTypeDefinition, knowledgeContext: string): JsonCompletionRequest {
  return {
    temperature: 0.7,
    maxOutputTokens: 6000,
    system: `You are HKE AI (Human Knowledge Engine AI), turning a founder's captured knowledge into finished business assets.
Write in the founder's brand voice as described in their knowledge. Be specific to their business, customers, and offer.
${GROUNDING_RULES}
Format the asset in Markdown using #/## headings, short paragraphs, and - or 1. lists. No tables, no HTML, no code fences.
Return valid JSON only: {"title": string, "content_markdown": string}.`,
    user: `Create this asset: ${type.label}.\n${type.instructions}\n\nFOUNDER KNOWLEDGE:\n${knowledgeContext}`,
  }
}
