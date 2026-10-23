import { TOTAL_QUESTIONS } from './interview'
import { STEP_SECTIONS } from './steps'

/**
 * The path every project follows, from what the founder knows to what they
 * can hand over. Derived only from saved data, like the lifecycle stage.
 */
export const JOURNEY_KEYS = ['capture', 'blueprint', 'plan', 'assets', 'kit'] as const
export type JourneyKey = (typeof JOURNEY_KEYS)[number]
export type JourneyState = 'done' | 'current' | 'upcoming'
export type JourneyStage = { key: JourneyKey; label: string; summary: string; detail: string; state: JourneyState; href?: string; cta: string }

export const JOURNEY_LABELS: Record<JourneyKey, { label: string; summary: string }> = {
  capture: { label: 'Capture', summary: 'Your expertise, in your words' },
  blueprint: { label: 'Blueprint', summary: 'Structured by HKE' },
  plan: { label: 'Launch plan', summary: 'Four decisions to launch' },
  assets: { label: 'Assets', summary: 'Built from your knowledge' },
  kit: { label: 'Knowledge Kit', summary: 'Everything in one document' },
}

export type JourneyInput = {
  answered: number
  interviewId?: string | null
  projectId?: string | null
  /** 'none' while there is no project; 'building' until the blueprint is saved. */
  blueprint: 'none' | 'building' | 'ready'
  /** The interview was marked finished (interviews.status = 'completed'). */
  interviewDone?: boolean
  stepsDone?: number
  /** Path of the first unfinished launch-plan step, when there is one. */
  nextStepPath?: string | null
  assetsReady?: number
}

export function buildJourney(input: JourneyInput): JourneyStage[] {
  const { answered, blueprint, stepsDone = 0, assetsReady = 0 } = input
  const project = input.projectId ? `/projects/${input.projectId}` : null
  const ready = blueprint === 'ready'
  const totalSteps = STEP_SECTIONS.length

  const captured = blueprint !== 'none' || !!input.interviewDone
  const planned = ready && stepsDone >= totalSteps
  const built = ready && assetsReady > 0
  const done: Record<JourneyKey, boolean> = {
    capture: captured,
    blueprint: ready,
    plan: planned,
    assets: built,
    // The kit keeps growing with every asset, but it counts as done once it
    // holds everything: the interview, the blueprint, the full plan, and an asset.
    kit: captured && ready && planned && built,
  }
  const detail: Record<JourneyKey, string> = {
    capture: `${answered} of ${TOTAL_QUESTIONS} answered`,
    blueprint: ready ? 'Ready' : blueprint === 'building' ? 'Building…' : captured ? 'Ready to build' : 'After the interview',
    plan: ready ? `${stepsDone} of ${totalSteps} steps` : 'After the blueprint',
    assets: ready ? (assetsReady ? `${assetsReady} ready` : 'None yet') : 'After the blueprint',
    kit: done.assets ? 'Ready to download' : 'After your first asset',
  }
  const href: Record<JourneyKey, string | undefined> = {
    capture: project ? `${project}#capture` : input.interviewId ? `/builder?interview=${input.interviewId}` : undefined,
    blueprint: project ? `${project}#blueprint` : undefined,
    plan: project && ready ? (input.nextStepPath ? `${project}/${input.nextStepPath}` : `${project}#plan`) : undefined,
    assets: project && ready ? `${project}#assets` : undefined,
    kit: project && ready ? `${project}#kit` : undefined,
  }
  const cta: Record<JourneyKey, string> = {
    capture: answered ? 'Resume interview' : 'Start the interview',
    blueprint: blueprint === 'building' ? 'Check blueprint' : 'Build blueprint',
    plan: stepsDone ? 'Continue launch plan' : 'Start launch plan',
    assets: 'Generate your first asset',
    kit: 'Open your Knowledge Kit',
  }

  const current = JOURNEY_KEYS.find((key) => !done[key]) ?? 'kit'
  return JOURNEY_KEYS.map((key) => ({
    key,
    ...JOURNEY_LABELS[key],
    detail: detail[key],
    state: done[key] ? 'done' : key === current ? 'current' : 'upcoming',
    href: href[key],
    cta: cta[key],
  }))
}

export function currentStage(stages: JourneyStage[]) {
  return stages.find((stage) => stage.state === 'current') ?? stages[stages.length - 1]
}
