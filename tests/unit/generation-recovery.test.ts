import { describe, expect, it } from 'vitest'
import { STALE_GENERATION_MS } from '@/lib/hke/assets'
import { isStaleBlueprintBuild, lockingProject } from '@/lib/hke/generation/recovery'

const NOW = Date.parse('2026-10-10T12:00:00Z')
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString()
const project = (status: string, msAgo: number) => ({ id: 'p1', status, updated_at: at(msAgo) })

describe('stale blueprint builds', () => {
  it('uses the same five-minute window as the database', () => {
    // hke_begin_blueprint_generation clears a generating project older than five minutes.
    expect(STALE_GENERATION_MS).toBe(5 * 60 * 1000)
  })

  it('treats a generating project as stale only after the window has passed', () => {
    expect(isStaleBlueprintBuild(project('generating', 0), NOW)).toBe(false)
    expect(isStaleBlueprintBuild(project('generating', STALE_GENERATION_MS - 1), NOW)).toBe(false)
    expect(isStaleBlueprintBuild(project('generating', STALE_GENERATION_MS), NOW)).toBe(false)
    expect(isStaleBlueprintBuild(project('generating', STALE_GENERATION_MS + 1), NOW)).toBe(true)
  })

  it('never treats a completed project as stale', () => {
    expect(isStaleBlueprintBuild(project('completed', STALE_GENERATION_MS * 1000), NOW)).toBe(false)
  })

  it('does not treat a project with an unreadable timestamp as stale', () => {
    expect(isStaleBlueprintBuild({ status: 'generating', updated_at: 'not a date' }, NOW)).toBe(false)
  })
})

describe('lockingProject', () => {
  it('locks the interview for a fresh build and for a completed project', () => {
    const fresh = project('generating', 60_000)
    const done = project('completed', STALE_GENERATION_MS * 10)
    expect(lockingProject(fresh, NOW)).toBe(fresh)
    expect(lockingProject(done, NOW)).toBe(done)
  })

  it('does not lock the interview for a stale build or when there is no project', () => {
    expect(lockingProject(project('generating', STALE_GENERATION_MS + 1), NOW)).toBeNull()
    expect(lockingProject(null, NOW)).toBeNull()
    expect(lockingProject(undefined, NOW)).toBeNull()
  })
})
