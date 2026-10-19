import { describe, expect, it } from 'vitest'
import { buildJourney } from '@/lib/hke/journey'
import { levelFor, levelUpMessage } from '@/lib/hke/levels'
import { STEP_SECTIONS } from '@/lib/hke/steps'

/**
 * The crown level is the journey stage being worked on, so it can only move
 * up as the person saves real work — it is earned, never bought.
 */
describe('build levels', () => {
  it('starts at Spark during the interview', () => {
    const level = levelFor(buildJourney({ answered: 3, blueprint: 'none' }))
    expect(level).toMatchObject({ number: 1, key: 'capture', name: 'Spark', backdrop: 'level-backdrop level-1' })
    expect(levelUpMessage(level)).toBeNull()
  })

  it('reaches Foundation while the blueprint is being built', () => {
    const level = levelFor(buildJourney({ answered: 15, projectId: 'p', blueprint: 'building' }))
    expect(level).toMatchObject({ number: 2, name: 'Foundation' })
    expect(levelUpMessage(level)).toBe("You did it — your interview is captured! You've moved up to Foundation.")
  })

  it('reaches Rising once the blueprint is ready', () => {
    const level = levelFor(buildJourney({ answered: 15, projectId: 'p', blueprint: 'ready', stepsDone: 1 }))
    expect(level).toMatchObject({ number: 3, name: 'Rising' })
    expect(levelUpMessage(level)).toContain('your Blueprint is built')
  })

  it('reaches Building when the launch plan is complete', () => {
    const level = levelFor(buildJourney({ answered: 15, projectId: 'p', blueprint: 'ready', stepsDone: STEP_SECTIONS.length }))
    expect(level).toMatchObject({ number: 4, name: 'Building' })
  })

  it('is Crowned after the first asset, and stays there', () => {
    const level = levelFor(buildJourney({ answered: 15, projectId: 'p', blueprint: 'ready', stepsDone: STEP_SECTIONS.length, assetsReady: 1 }))
    expect(level).toMatchObject({ number: 5, name: 'Crowned', backdrop: 'level-backdrop level-5' })
    expect(levelUpMessage(level)).toContain('your first asset is ready')
  })
})
