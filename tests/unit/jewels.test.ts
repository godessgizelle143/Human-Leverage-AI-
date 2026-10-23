import { describe, expect, it } from 'vitest'
import { buildJourney } from '@/lib/hke/journey'
import { crownFor } from '@/lib/hke/jewels'
import { levelFor } from '@/lib/hke/levels'
import { STEP_SECTIONS } from '@/lib/hke/steps'

const ALL_STEPS = STEP_SECTIONS.length
const earnedKeys = (crown: ReturnType<typeof crownFor>) => crown.jewels.filter((jewel) => jewel.earned).map((jewel) => jewel.key)

/**
 * One jewel per "Your path" stage, earned when that stage is done — derived
 * from saved work only.
 */
describe('crown jewels', () => {
  it('has no jewels while the interview is in progress', () => {
    const crown = crownFor(buildJourney({ answered: 6, blueprint: 'none' }))
    expect(crown.jewels.map((jewel) => jewel.label)).toEqual(['Capture', 'Blueprint', 'Launch plan', 'Assets', 'Knowledge Kit'])
    expect(crown.earned).toBe(0)
    expect(crown.line).toBe('Next jewel: finish your interview')
  })

  it('earns Capture once the interview is marked finished, before any blueprint', () => {
    const journey = buildJourney({ answered: 15, blueprint: 'none', interviewDone: true })
    const crown = crownFor(journey)
    expect(earnedKeys(crown)).toEqual(['capture'])
    expect(crown.line).toBe('Next jewel: finish your blueprint')
    expect(journey[1]).toMatchObject({ state: 'current', detail: 'Ready to build' })
  })

  it('earns Capture when a project exists, even if the interview was never marked finished', () => {
    expect(earnedKeys(crownFor(buildJourney({ answered: 9, projectId: 'p', blueprint: 'building' })))).toEqual(['capture'])
  })

  it('earns Blueprint only once the blueprint is saved', () => {
    const crown = crownFor(buildJourney({ answered: 15, projectId: 'p', blueprint: 'ready', stepsDone: 1 }))
    expect(earnedKeys(crown)).toEqual(['capture', 'blueprint'])
    expect(crown.line).toBe('Next jewel: finish your launch plan')
  })

  it('earns Assets on its own when an asset is ready before the plan is finished', () => {
    const crown = crownFor(buildJourney({ answered: 15, projectId: 'p', blueprint: 'ready', stepsDone: 2, assetsReady: 1 }))
    expect(earnedKeys(crown)).toEqual(['capture', 'blueprint', 'assets'])
    expect(crown.earned).toBe(3)
    expect(crown.next?.key).toBe('plan')
  })

  it('earns Launch plan only when all four steps are saved', () => {
    const crown = crownFor(buildJourney({ answered: 15, projectId: 'p', blueprint: 'ready', stepsDone: ALL_STEPS }))
    expect(earnedKeys(crown)).toEqual(['capture', 'blueprint', 'plan'])
    expect(crown.line).toBe('Next jewel: make your first asset')
  })

  it('completes the crown, Knowledge Kit included, once the other four stages are done', () => {
    const journey = buildJourney({ answered: 15, projectId: 'p', blueprint: 'ready', stepsDone: ALL_STEPS, assetsReady: 2 })
    const crown = crownFor(journey)
    expect(crown.earned).toBe(5)
    expect(crown.next).toBeNull()
    expect(crown.line).toBe('Your crown is complete. Keep growing your Kit.')
    expect(journey.every((stage) => stage.state === 'done')).toBe(true)
    // The old build level still ends at Crowned.
    expect(levelFor(journey)).toMatchObject({ number: 5, name: 'Crowned' })
  })

  it('does not count a blueprint that is still building or failed', () => {
    expect(crownFor(buildJourney({ answered: 15, projectId: 'p', blueprint: 'building', stepsDone: ALL_STEPS, assetsReady: 1 })).earned).toBe(1)
  })
})
