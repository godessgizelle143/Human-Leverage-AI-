import { HLAI_CAPABILITIES } from '@/lib/ai/capabilities'
import type { AssetTypeDefinition, Knowledge } from '../domain'
import { denialToError } from '../entitlements'
import { HkeError, isHkeError } from '../errors'
import { progressFor, serializeInterviewMessages, type InterviewState } from '../interview'
import { knowledgeToPromptContext } from '../knowledge'
import { assetRequest, ASSET_PROMPT_VERSION, blueprintRequest, BLUEPRINT_PROMPT_VERSION } from '../intelligence/prompts'
import type { IntelligenceProvider } from '../intelligence/provider'
import { AssetOutputSchema, BlueprintOutputSchema } from '../intelligence/schemas'
import { generateStructured } from '../intelligence/structured'
import type { GenerationStore } from './store'

export type GenerationDeps = {
  store: GenerationStore
  provider: IntelligenceProvider
  newId?: () => string
  now?: () => Date
}

const EXPIRED_MESSAGE = 'This generation took too long and was cancelled. No credits were used. Please try again.'

/** Short, user-safe reason stored on a failed asset. */
function failureMessage(error: unknown) {
  return isHkeError(error) && error.code !== 'internal' && error.code !== 'database_error' ? error.message : 'Generation failed. Please try again.'
}

/**
 * Records a failed attempt (which returns the reserved credits). If even that
 * write fails, the database settles the claim after five minutes, refunding it.
 */
async function settleFailure(settle: () => Promise<unknown>) {
  try {
    await settle()
  } catch (error) {
    console.error('Generation failure could not be recorded; it will expire and refund automatically.', isHkeError(error) ? error.code : '')
  }
}

/**
 * Interview → knowledge blueprint → project. Credits: 1 interview + 1 build,
 * reserved with the project claim and returned if anything fails.
 */
export async function generateBlueprint(
  deps: GenerationDeps,
  input: { userId: string; interviewId: string; title: string; interview: InterviewState; skipEntitlement: boolean },
): Promise<{ projectId: string }> {
  const projectId = deps.newId?.() ?? crypto.randomUUID()
  const claim = await deps.store.beginBlueprint({ userId: input.userId, interviewId: input.interviewId, projectId, title: input.title, skipEntitlement: input.skipEntitlement })
  if (!claim.ok) throw denialToError(claim.reason, claim.details)

  let content: Record<string, unknown>
  try {
    const { data, model } = await generateStructured(deps.provider, BlueprintOutputSchema, blueprintRequest(input.interview.answers))
    const allowedModules = new Set<string>(HLAI_CAPABILITIES.map((capability) => capability.id))
    content = {
      ...data,
      recommended_modules: data.recommended_modules.filter((id) => allowedModules.has(id)),
      capability_catalog_version: 1,
      generation: { model, prompt_version: BLUEPRINT_PROMPT_VERSION, generated_at: (deps.now?.() ?? new Date()).toISOString() },
    }
  } catch (error) {
    await settleFailure(() => deps.store.finishBlueprint({ userId: input.userId, projectId: claim.projectId, succeeded: false }))
    throw error
  }

  const settled = await deps.store.finishBlueprint({
    userId: input.userId,
    projectId: claim.projectId,
    succeeded: true,
    content,
    interviewMessages: serializeInterviewMessages(input.interview),
    interviewProgress: progressFor(input.interview.answers),
  })
  if (settled !== 'completed') throw new HkeError('generation_expired', EXPIRED_MESSAGE)
  return { projectId: claim.projectId }
}

/**
 * Knowledge → one asset in project_assets. Credits: 1 build, reserved with the
 * asset claim and returned if anything fails.
 */
export async function generateAsset(
  deps: GenerationDeps,
  input: { userId: string; projectId: string; type: AssetTypeDefinition; knowledge: Knowledge; skipEntitlement: boolean },
): Promise<{ assetId: string }> {
  const claim = await deps.store.beginAsset({ userId: input.userId, projectId: input.projectId, assetType: input.type.id, title: input.type.label, skipEntitlement: input.skipEntitlement })
  if (!claim.ok) throw denialToError(claim.reason, claim.details)

  let output
  try {
    output = await generateStructured(deps.provider, AssetOutputSchema, assetRequest(input.type, knowledgeToPromptContext(input.knowledge)))
  } catch (error) {
    await settleFailure(() => deps.store.finishAsset({ userId: input.userId, assetId: claim.assetId, succeeded: false, error: failureMessage(error) }))
    throw error
  }

  const settled = await deps.store.finishAsset({
    userId: input.userId,
    assetId: claim.assetId,
    succeeded: true,
    title: output.data.title,
    content: output.data.content_markdown,
    metadata: {
      model: output.model,
      prompt_version: ASSET_PROMPT_VERSION,
      knowledge_sources: input.knowledge.sources.map((source) => source.id),
      generated_at: (deps.now?.() ?? new Date()).toISOString(),
    },
  })
  if (settled !== 'completed') throw new HkeError('generation_expired', EXPIRED_MESSAGE)
  return { assetId: claim.assetId }
}
