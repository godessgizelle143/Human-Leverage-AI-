import { isValidElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The real builder page and the real project page, called the way Next.js
 * calls them, with only Supabase and Next's redirect replaced. The loop this
 * guards against: the project page of an unfinished blueprint build links to
 * the builder, and the builder redirects straight back to the project page,
 * so a customer whose build was cut off can never reach "Build My Blueprint"
 * again.
 */
const USER = '00000000-0000-4000-8000-0000000000a1'
const INTERVIEW = '00000000-0000-4000-8000-0000000000b1'
const PROJECT = '00000000-0000-4000-8000-0000000000c1'
const answers = { '1': 'Crumb & Co', '2': 'Pricing coaching for bakeries' }

type Project = { id: string; user_id: string; interview_id: string; title: string; content: Record<string, unknown>; status: string; archived_at: string | null; entitlement_state: string; created_at: string; updated_at: string }

const mocks = vi.hoisted(() => ({
  signedIn: true,
  interviewExists: true,
  project: null as Record<string, unknown> | null,
}))

class Redirect extends Error {
  constructor(readonly destination: string) { super(`redirect:${destination}`) }
}

vi.mock('next/navigation', () => ({
  redirect: (destination: string) => { throw new Redirect(destination) },
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {} }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.signedIn ? { id: USER, email: 'founder@example.test', email_confirmed_at: '2026-10-01T00:00:00Z' } : null } }) },
    from(table: string) {
      const one = () => {
        if (table === 'interviews') return mocks.interviewExists ? { id: INTERVIEW, status: 'completed', messages: { version: 2, answers, current: 14, archived: false }, updated_at: '2026-10-10T00:00:00Z' } : null
        if (table === 'projects') return mocks.project
        if (table === 'subscriptions') return { plan: 'professional', status: 'trialing', interviews_used: 1, builds_used: 1, current_period_end: '2099-01-01T00:00:00Z', trial_started_at: '2026-10-09T00:00:00Z' }
        return null
      }
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        maybeSingle: async () => ({ data: one(), error: null }),
        then: (resolve: (result: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
      }
      return builder
    },
  }),
}))

import BuilderPage from '@/app/builder/page'
import ProjectWorkspacePage from '@/app/projects/[id]/page'
import InterviewWorkspace from '@/components/hke/InterviewWorkspace'

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

function project(status: 'generating' | 'completed', updatedMinutesAgo: number): Project {
  return {
    id: PROJECT,
    user_id: USER,
    interview_id: INTERVIEW,
    title: 'Crumb & Co',
    content: status === 'completed' ? { business_summary: 'We teach small bakeries to price for profit.', elevator_pitch: 'Profit-first pricing for bakeries.' } : {},
    status,
    archived_at: null,
    entitlement_state: status === 'completed' ? 'consumed' : 'reserved',
    created_at: minutesAgo(updatedMinutesAgo),
    updated_at: minutesAgo(updatedMinutesAgo),
  }
}

/** Every element in a page's returned tree, without rendering child components. */
function elements(node: ReactNode): { type: unknown; props: Record<string, unknown> }[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement(node)) return []
  const props = node.props as Record<string, unknown>
  return [{ type: node.type, props }, ...elements(props.children as ReactNode)]
}

type Visit = { redirectedTo: string } | { redirectedTo: null; tree: ReturnType<typeof elements> }

async function visit(page: () => Promise<ReactNode>): Promise<Visit> {
  try {
    return { redirectedTo: null, tree: elements(await page()) }
  } catch (error) {
    if (error instanceof Redirect) return { redirectedTo: error.destination }
    throw error
  }
}

const visitBuilder = (interviewId: string) => visit(() => BuilderPage({ searchParams: { interview: interviewId } }))
const visitProject = (projectId: string) => visit(() => ProjectWorkspacePage({ params: { id: projectId } }))

/** The links on a page that lead to the builder, as hrefs. */
function builderLinks(visited: Visit) {
  if (visited.redirectedTo !== null) return []
  return visited.tree.map((element) => element.props.href).filter((href): href is string => typeof href === 'string' && href.startsWith('/builder'))
}

const interviewIn = (href: string) => new URL(href, 'https://hke.test').searchParams.get('interview') ?? ''

beforeEach(() => {
  mocks.signedIn = true
  mocks.interviewExists = true
  mocks.project = null
})

describe('builder and project page navigation', () => {
  it('lets a customer whose blueprint build was cut off get from the project page back into the interview', async () => {
    mocks.project = project('generating', 10)

    // The project page stays up and offers the way back to the interview.
    const projectPage = await visitProject(PROJECT)
    expect(projectPage.redirectedTo).toBeNull()
    const links = builderLinks(projectPage)
    expect(links).toEqual([`/builder?interview=${INTERVIEW}`])

    // Following that link opens the interview with the saved answers. It
    // must not send the customer back to the project page.
    const builderPage = await visitBuilder(interviewIn(links[0]))
    expect(builderPage.redirectedTo).toBeNull()
    if (builderPage.redirectedTo !== null) return
    const workspace = builderPage.tree.find((element) => element.type === InterviewWorkspace)
    expect(workspace?.props).toMatchObject({ interviewId: INTERVIEW, initialAnswers: answers, initialCurrent: 14 })
  })

  it.each([
    ['a blueprint build that is still running', () => project('generating', 1)],
    ['a blueprint build that was cut off', () => project('generating', 10)],
    ['a finished project', () => project('completed', 60 * 24)],
  ] as const)('never links from the project page to a builder that redirects straight back: %s', async (_state, make) => {
    mocks.project = make()
    const projectPage = await visitProject(PROJECT)
    expect(projectPage.redirectedTo).toBeNull()

    for (const href of builderLinks(projectPage)) {
      const builderPage = await visitBuilder(interviewIn(href))
      expect(builderPage.redirectedTo, `${href} leads back to ${builderPage.redirectedTo}`).not.toBe(`/projects/${PROJECT}`)
    }
  })

  it('keeps a running build protected: the builder sends the customer to the project page, which offers no way to build twice', async () => {
    mocks.project = project('generating', 1)
    expect(await visitBuilder(INTERVIEW)).toEqual({ redirectedTo: `/projects/${PROJECT}` })
    expect(builderLinks(await visitProject(PROJECT))).toEqual([])
  })

  it('sends the customer from the builder to a finished project, and the project page opens', async () => {
    mocks.project = project('completed', 60 * 24)
    expect(await visitBuilder(INTERVIEW)).toEqual({ redirectedTo: `/projects/${PROJECT}` })
    const projectPage = await visitProject(PROJECT)
    expect(projectPage.redirectedTo).toBeNull()
    expect(builderLinks(projectPage)).toEqual([])
  })

  it('opens the interview normally when it has no project yet', async () => {
    const builderPage = await visitBuilder(INTERVIEW)
    expect(builderPage.redirectedTo).toBeNull()
    if (builderPage.redirectedTo !== null) return
    expect(builderPage.tree.find((element) => element.type === InterviewWorkspace)?.props).toMatchObject({ interviewId: INTERVIEW, initialAnswers: answers })
  })

  it('still sends a signed-out visitor to sign in, and an unknown interview or project to the dashboard', async () => {
    mocks.interviewExists = false
    expect(await visitBuilder(INTERVIEW)).toEqual({ redirectedTo: '/dashboard' })
    expect(await visitProject(PROJECT)).toEqual({ redirectedTo: '/dashboard' })

    mocks.signedIn = false
    expect(await visitBuilder(INTERVIEW)).toEqual({ redirectedTo: '/login' })
    expect(await visitProject(PROJECT)).toEqual({ redirectedTo: '/login' })
  })
})
