import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { createRenderTracker } from '@/components/hke/RefreshOnReturn'

/**
 * The dashboard and Knowledge Vault refresh themselves only when the render on
 * screen is one the browser already showed: a copy redisplayed by the Next.js
 * router cache. A render straight from the server must never trigger a second
 * load.
 */
describe('createRenderTracker', () => {
  it('does not refresh a render seen for the first time', () => {
    const seenBefore = createRenderTracker()
    expect(seenBefore('render-1')).toBe(false)
  })

  it('refreshes when the same render is shown again', () => {
    const seenBefore = createRenderTracker()
    seenBefore('render-1')
    expect(seenBefore('render-1')).toBe(true)
  })

  it('does not refresh the fresh render that a refresh brings in, so it cannot loop', () => {
    const seenBefore = createRenderTracker()
    seenBefore('render-1')
    expect(seenBefore('render-1')).toBe(true)
    expect(seenBefore('render-2')).toBe(false)
    expect(seenBefore('render-2')).toBe(true)
  })

  it('refreshes when Back restores an older render than the last one shown', () => {
    const seenBefore = createRenderTracker()
    seenBefore('render-1')
    seenBefore('render-2')
    expect(seenBefore('render-1')).toBe(true)
  })

  it('keeps each tracker separate', () => {
    const first = createRenderTracker()
    const second = createRenderTracker()
    first('render-1')
    expect(second('render-1')).toBe(false)
  })
})
