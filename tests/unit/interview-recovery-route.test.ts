import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The interview route decides whether an interview is locked by its project.
 * A blueprint build that was cut off leaves the project in `generating`; once
 * that is stale the customer must be able to save and rebuild from the
 * interview, while a build that is still running, or a finished project, keeps
 * the interview locked.
 */
const USER = '00000000-0000-4000-8000-0000000000a1'
const INTERVIEW = '00000000-0000-4000-8000-0000000000b1'
const PROJECT = '00000000-0000-4000-8000-0000000000c1'

type ProjectRow = { id: string; status: string; updated_at: string } | null

const mocks = vi.hoisted(() => ({
  project: null as { id: string; status: string; updated_at: string } | null,
  updates: [] as Record<string, unknown>[],
}))

const savedAnswers = { '1': 'Crumb & Co', '2': 'Pricing coaching for bakeries' }

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: USER } } }) },
    from(table: string) {
      let update: Record<string, unknown> | null = null
      const builder = {
        select: () => builder,
        update(values: Record<string, unknown>) { update = values; return builder },
        eq: () => builder,
        maybeSingle: async () => ({
          data: table === 'interviews'
            ? { id: INTERVIEW, title: 'Crumb & Co', status: 'completed', progress: 13, messages: { version: 2, answers: savedAnswers, current: 14, archived: false }, updated_at: '2026-10-10T00:00:00Z' }
            : mocks.project,
          error: null,
        }),
        then(resolve: (result: { error: null }) => unknown) {
          if (update) mocks.updates.push(update)
          return Promise.resolve({ error: null }).then(resolve)
        },
      }
      return builder
    },
  }),
}))

import { GET, PATCH } from '@/app/api/interviews/[id]/route'

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
const generating = (minutes: number): ProjectRow => ({ id: PROJECT, status: 'generating', updated_at: minutesAgo(minutes) })

async function patch(body: Record<string, unknown>): Promise<Response> {
  const response = await PATCH(new Request(`https://hke.test/api/interviews/${INTERVIEW}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), { params: { id: INTERVIEW } })
  if (!response) throw new Error('PATCH returned no response')
  return response
}

async function get(): Promise<Response> {
  const response = await GET(new Request(`https://hke.test/api/interviews/${INTERVIEW}`), { params: { id: INTERVIEW } })
  if (!response) throw new Error('GET returned no response')
  return response
}

beforeEach(() => {
  mocks.project = null
  mocks.updates = []
})

describe('PATCH /api/interviews/[id] and blueprint builds', () => {
  it('keeps the interview locked while a fresh blueprint build is running, so it cannot be built twice', async () => {
    mocks.project = generating(1)
    const response = await patch({ answers: savedAnswers, current: 14, complete: true })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ projectId: PROJECT })
    expect(mocks.updates).toEqual([])
  })

  it('treats a build just inside the five-minute window as still running', async () => {
    mocks.project = generating(4.9)
    expect((await patch({ answers: savedAnswers, complete: true })).status).toBe(409)
    expect(mocks.updates).toEqual([])
  })

  it('lets the customer save and rebuild from the interview once a blueprint build is stale', async () => {
    mocks.project = generating(10)
    const response = await patch({ answers: savedAnswers, current: 14, complete: true })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, status: 'completed' })
    // The saved answers are written back unchanged, not cleared.
    expect(mocks.updates).toHaveLength(1)
    expect(mocks.updates[0]).toMatchObject({ status: 'completed', messages: { version: 2, answers: savedAnswers, current: 14, archived: false } })
  })

  it('reports no blocking project for a stale build, so the builder opens the interview', async () => {
    mocks.project = generating(10)
    const response = await get()
    expect(await response.json()).toMatchObject({ projectId: null, answers: savedAnswers })
  })

  it('reports the running project for a fresh build', async () => {
    mocks.project = generating(1)
    const response = await get()
    expect(await response.json()).toMatchObject({ projectId: PROJECT })
  })

  it('never treats a completed project as stale, however old: its answers stay locked', async () => {
    mocks.project = { id: PROJECT, status: 'completed', updated_at: minutesAgo(60 * 24 * 30) }
    const response = await patch({ answers: { '1': 'Changed' }, complete: true })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ projectId: PROJECT })
    expect(mocks.updates).toEqual([])
  })

  it('still saves normally when the interview has no project', async () => {
    const response = await patch({ answers: savedAnswers, current: 3 })
    expect(response.status).toBe(200)
    expect(mocks.updates).toHaveLength(1)
  })
})
