import { currentStage, JOURNEY_KEYS, type JourneyKey, type JourneyStage } from './journey'

/**
 * Build levels: the five journey stages, shown as a crown with five jewels.
 * The level is the stage the person is working on now, so it is derived only
 * from saved data (the same journey the dashboard and project page show) and
 * is always earned — never bought or unlocked by a plan.
 */
export type LevelNumber = 1 | 2 | 3 | 4 | 5

export type Level = {
  number: LevelNumber
  key: JourneyKey
  name: string
  /** Short, plain-language line for the level badge. */
  tagline: string
  /** CSS class for this level's page backdrop (see app/globals.css). */
  backdrop: string
}

export const LEVELS: Record<JourneyKey, Omit<Level, 'number' | 'key' | 'backdrop'>> = {
  capture: { name: 'Spark', tagline: 'You started. Your knowledge is being captured.' },
  blueprint: { name: 'Foundation', tagline: 'Your answers are becoming a blueprint.' },
  plan: { name: 'Rising', tagline: 'Your blueprint is ready. Now you plan your launch.' },
  assets: { name: 'Building', tagline: 'Your plan is set. Now you build.' },
  kit: { name: 'Crowned', tagline: 'You built it. Keep growing your Knowledge Kit.' },
}

export function levelFor(stages: JourneyStage[]): Level {
  const key = currentStage(stages).key
  const number = (JOURNEY_KEYS.indexOf(key) + 1) as LevelNumber
  return { number, key, ...LEVELS[key], backdrop: `level-backdrop level-${number}` }
}

/** The celebration line for reaching `level`, naming the stage just finished. */
export function levelUpMessage(level: Level): string | null {
  if (level.number === 1) return null
  const finished = JOURNEY_KEYS[level.number - 2]
  const done: Record<JourneyKey, string> = {
    capture: 'your interview is captured',
    blueprint: 'your Blueprint is built',
    plan: 'your launch plan is complete',
    assets: 'your first asset is ready',
    kit: 'your Knowledge Kit is ready',
  }
  return `You did it — ${done[finished]}! You've moved up to ${level.name}.`
}
