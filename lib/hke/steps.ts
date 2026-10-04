import { z } from 'zod'

/**
 * The four launch-plan steps. Each is stored as one section of
 * projects.content and saved atomically through hke_save_project_section, so
 * steps never overwrite each other. `input` is the request field the step
 * page sends; `stored` is the key kept in the database (unchanged from the
 * original routes, so existing saved data still loads).
 */
type StepField = { input: string; stored: string; label: string }

export type StepDefinition = {
  key: 'launch_target' | 'customer_offer' | 'customer_foundation' | 'launch_content'
  label: string
  path: string
  /** Key of the saved section in the GET response, as the step pages expect. */
  responseKey: string
  fields: readonly StepField[]
  /** Fixed values stored alongside the user's answers. */
  extras?: Record<string, unknown>
}

export const STEP_SECTIONS = [
  {
    key: 'launch_target',
    label: 'Launch Target',
    path: 'launch-target',
    responseKey: 'launchTarget',
    fields: [
      { input: 'audience', stored: 'audience', label: 'Audience' },
      { input: 'location', stored: 'location', label: 'Location' },
      { input: 'offer', stored: 'offer', label: 'Offer' },
      { input: 'milestone', stored: 'first_milestone', label: 'First milestone' },
    ],
  },
  {
    key: 'customer_offer',
    label: 'Customer Offer',
    path: 'customer-offer',
    responseKey: 'customerOffer',
    fields: [
      { input: 'serviceName', stored: 'service_name', label: 'Service name' },
      { input: 'customerGets', stored: 'customer_gets', label: 'What the customer gets' },
      { input: 'pricing', stored: 'pricing', label: 'Pricing' },
      { input: 'booking', stored: 'booking', label: 'How customers book or buy' },
      { input: 'nextAction', stored: 'next_action', label: 'Next action' },
    ],
  },
  {
    key: 'customer_foundation',
    label: 'Customer Foundation',
    path: 'customer-foundation',
    responseKey: 'customerFoundation',
    fields: [
      { input: 'foundationType', stored: 'foundation_type', label: 'What is built first' },
      { input: 'customerExperience', stored: 'customer_experience', label: 'Customer experience' },
      { input: 'customerInfo', stored: 'customer_information', label: 'Customer information' },
      { input: 'firstAction', stored: 'after_submission', label: 'After submission' },
    ],
  },
  {
    key: 'launch_content',
    label: 'Launch Content',
    path: 'launch-content',
    responseKey: 'launchContent',
    fields: [
      { input: 'launchGoal', stored: 'launch_goal', label: 'Launch goal' },
      { input: 'audience', stored: 'audience', label: 'Audience' },
      { input: 'channels', stored: 'channels', label: 'Channels' },
      { input: 'callToAction', stored: 'call_to_action', label: 'Call to action' },
    ],
    extras: {
      plan: {
        days_1_30: 'Build awareness, explain the problem you solve, and introduce your offer consistently.',
        days_31_60: 'Publish proof, answer customer questions, and strengthen the content that earns engagement.',
        days_61_90: 'Double down on the strongest channels, refine the message, and turn attention into repeatable customer action.',
      },
    },
  },
] as const satisfies readonly StepDefinition[]

export type StepKey = StepDefinition['key']

export function getStep(key: StepKey): StepDefinition {
  return STEP_SECTIONS.find((step) => step.key === key) as StepDefinition
}

export const MAX_STEP_FIELD_LENGTH = 5000

/** Validates a step request body and returns the section value to store. */
export function parseStepInput(step: StepDefinition, body: unknown): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  const shape = Object.fromEntries(step.fields.map((field) => [field.input, z.string().trim().min(1).max(MAX_STEP_FIELD_LENGTH)]))
  const result = z.object(shape).safeParse(body)
  if (!result.success) {
    const tooLong = result.error.issues.some((issue) => issue.code === 'too_big')
    return { ok: false, message: tooLong ? `Each answer can be up to ${MAX_STEP_FIELD_LENGTH} characters.` : `All ${step.label.toLowerCase()} fields are required.` }
  }
  const data = result.data as Record<string, string>
  const value: Record<string, unknown> = Object.fromEntries(step.fields.map((field) => [field.stored, data[field.input]]))
  return { ok: true, value: { ...value, ...step.extras } }
}
