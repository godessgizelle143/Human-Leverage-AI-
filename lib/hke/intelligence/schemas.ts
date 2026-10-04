import { z } from 'zod'
import { MAX_ASSET_LENGTH } from '../assets'

const text = z.string().trim().max(8000)
const listItem = z.union([text, z.record(z.string(), z.unknown())])

/** A blueprint field: prose, a list, or labelled sub-fields. */
export const BlueprintValueSchema = z.union([text, z.array(listItem).max(50), z.record(z.string(), z.unknown())])

const optionalValue = BlueprintValueSchema.optional()

/**
 * The knowledge blueprint extracted from an interview. Unknown keys are
 * stripped; the two anchor fields must be present and non-empty.
 */
export const BlueprintOutputSchema = z
  .object({
    business_summary: text.min(1),
    elevator_pitch: text.min(1),
    ideal_customer: optionalValue,
    problem_solved: optionalValue,
    differentiation: optionalValue,
    products_services: optionalValue,
    brand_voice: optionalValue,
    origin_story: optionalValue,
    mission_values: optionalValue,
    customer_transformation: optionalValue,
    goals_6_12_months: optionalValue,
    marketing_strategy: optionalValue,
    launch_roadmap: optionalValue,
    next_steps: optionalValue,
    recommended_modules: z.array(z.string().max(64)).max(20).default([]),
  })
  .refine((value) => JSON.stringify(value).length <= 100000, { message: 'Blueprint is too large' })

export type BlueprintOutput = z.output<typeof BlueprintOutputSchema>

export const AssetOutputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content_markdown: z.string().trim().min(40).max(MAX_ASSET_LENGTH),
})

export type AssetOutput = z.output<typeof AssetOutputSchema>
