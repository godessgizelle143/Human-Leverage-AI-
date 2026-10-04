import { displayStatus, type AssetSummary } from './assets'
import type { ProjectRow } from './db'
import { answeredCount, parseInterviewMessages } from './interview'

export const LIFECYCLE_STAGES = [
  'draft',
  'interviewing',
  'knowledge_extracted',
  'blueprint_created',
  'assets_generating',
  'assets_ready',
  'archived',
] as const

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number]

export const LIFECYCLE_LABELS: Record<LifecycleStage, string> = {
  draft: 'Draft',
  interviewing: 'Interviewing',
  knowledge_extracted: 'Knowledge captured',
  blueprint_created: 'Blueprint ready',
  assets_generating: 'Generating assets',
  assets_ready: 'Assets ready',
  archived: 'Archived',
}

type InterviewLike = { status?: string | null; messages?: unknown }
type ProjectLike = Pick<ProjectRow, 'status' | 'archived_at'>
type AssetLike = Pick<AssetSummary, 'status' | 'updated_at'>

/**
 * Derived from what is actually saved, so it can never drift from the data:
 * interview answers and completion, the project row (and whether its blueprint
 * is still being built), and the project's assets.
 */
export function deriveLifecycle(interview: InterviewLike | null | undefined, project: ProjectLike | null | undefined, assets: AssetLike[] = []): LifecycleStage {
  if (project) {
    if (project.archived_at) return 'archived'
    if (project.status !== 'completed') return 'knowledge_extracted'
    if (assets.some((asset) => displayStatus(asset) === 'generating')) return 'assets_generating'
    if (assets.some((asset) => asset.status === 'completed')) return 'assets_ready'
    return 'blueprint_created'
  }

  const state = parseInterviewMessages(interview?.messages)
  if (state.archived) return 'archived'
  if (interview?.status === 'completed') return 'knowledge_extracted'
  return answeredCount(state.answers) > 0 ? 'interviewing' : 'draft'
}

/** Position on the main path, ignoring "archived". */
export function lifecycleStep(stage: LifecycleStage) {
  return Math.max(0, LIFECYCLE_STAGES.indexOf(stage === 'archived' ? 'assets_ready' : stage))
}
