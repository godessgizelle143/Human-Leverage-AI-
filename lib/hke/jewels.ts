import type { JourneyKey, JourneyStage } from './journey'

/**
 * The crown's five jewels: one per "Your path" stage, earned when that stage is
 * done. They come straight from the journey, so the path and the crown can
 * never disagree, and nothing is stored. Stages can finish out of order (an
 * asset before the full launch plan), so each jewel is earned on its own.
 */
export type Jewel = { key: JourneyKey; label: string; earned: boolean }

export type Crown = {
  jewels: Jewel[]
  earned: number
  /** The first jewel not yet earned; null once the crown is complete. */
  next: Jewel | null
  /** The script line under the jewels. */
  line: string
}

const NEXT_JEWEL: Record<JourneyKey, string> = {
  capture: 'Next jewel: finish your interview',
  blueprint: 'Next jewel: finish your blueprint',
  plan: 'Next jewel: finish your launch plan',
  assets: 'Next jewel: make your first asset',
  kit: 'Next jewel: complete your Knowledge Kit',
}

export function crownFor(stages: JourneyStage[]): Crown {
  const jewels = stages.map((stage) => ({ key: stage.key, label: stage.label, earned: stage.state === 'done' }))
  const next = jewels.find((jewel) => !jewel.earned) ?? null
  return {
    jewels,
    earned: jewels.filter((jewel) => jewel.earned).length,
    next,
    line: next ? NEXT_JEWEL[next.key] : 'Your crown is complete. Keep growing your Kit.',
  }
}
