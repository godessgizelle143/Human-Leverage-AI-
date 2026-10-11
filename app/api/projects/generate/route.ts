import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { isOwnerUser } from '@/lib/owner-access'
import { errorResponse, HkeError } from '@/lib/hke/errors'
import { generateBlueprint } from '@/lib/hke/generation/services'
import { supabaseGenerationStore } from '@/lib/hke/generation/store'
import { openAIProvider } from '@/lib/hke/intelligence/provider'
import { answeredCount, parseInterviewMessages, titleFromAnswers } from '@/lib/hke/interview'
import { authenticate, readJson } from '@/lib/hke/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BodySchema = z.object({ interviewId: z.uuid() })

/**
 * Builds the knowledge blueprint for a saved interview and creates its
 * project. Answers are read from the user's saved interview, never from the
 * request. One interview can only ever produce one project (database unique
 * constraint); concurrent requests get a 409 without being charged twice.
 */
export async function POST(request: Request) {
  try {
    const { supabase, user } = await authenticate(request)

    const body = BodySchema.safeParse(await readJson(request))
    if (!body.success) throw new HkeError('invalid_input', 'Save your interview before building a blueprint.')

    const { data: interview } = await supabase
      .from('interviews')
      .select('id, messages')
      .eq('id', body.data.interviewId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!interview) throw new HkeError('not_found', 'This interview could not be found. Please reopen it from your dashboard.')

    const state = parseInterviewMessages(interview.messages)
    if (answeredCount(state.answers) === 0) throw new HkeError('invalid_input', 'Answer at least one question before building your blueprint.')

    if (!openAIProvider.isConfigured()) throw new HkeError('not_configured', 'AI generation is not configured in this deployment.')

    const { projectId } = await generateBlueprint(
      { store: supabaseGenerationStore(createServiceRoleClient()), provider: openAIProvider },
      { userId: user.id, interviewId: interview.id, title: titleFromAnswers(state.answers), interview: { ...state, archived: false }, skipEntitlement: isOwnerUser(user) },
    )

    return NextResponse.json({ success: true, project: { id: projectId } })
  } catch (error) {
    return errorResponse(error, 'Blueprint generation')
  }
}
