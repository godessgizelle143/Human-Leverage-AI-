import { NextResponse } from 'next/server'
import { isUuid, readJson, requireUser } from '@/lib/hke/server'
import {
  answeredCount,
  clampQuestionIndex,
  parseInterviewMessages,
  progressFor,
  sanitizeAnswers,
  serializeInterviewMessages,
  titleFromAnswers,
} from '@/lib/hke/interview'

async function loadInterview(id: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error } as const
  const { supabase, user } = auth
  if (!isUuid(id)) return { error: NextResponse.json({ error: 'Project not found.' }, { status: 404 }) } as const

  const { data: interview } = await supabase
    .from('interviews')
    .select('id, title, status, progress, messages, updated_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!interview) return { error: NextResponse.json({ error: 'Project not found.' }, { status: 404 }) } as const

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('interview_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  return { supabase, user, interview, projectId: project?.id ?? null } as const
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const loaded = await loadInterview(params.id)
  if ('error' in loaded) return loaded.error
  const state = parseInterviewMessages(loaded.interview.messages)
  return NextResponse.json({
    id: loaded.interview.id,
    title: loaded.interview.title,
    status: loaded.interview.status,
    answers: state.answers,
    current: state.current,
    archived: state.archived,
    projectId: loaded.projectId,
    updatedAt: loaded.interview.updated_at,
  })
}

// Autosave target. The client sends the full answer map (idempotent), the
// question it is on, and optionally `complete` (ready for knowledge extraction)
// or `archived`.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const loaded = await loadInterview(params.id)
  if ('error' in loaded) return loaded.error
  const { supabase, user, interview, projectId } = loaded

  const body = await readJson(request)
  const previous = parseInterviewMessages(interview.messages)
  const answersChanged = body.answers !== undefined

  if (projectId && (answersChanged || body.complete !== undefined)) {
    return NextResponse.json({ error: 'This interview already produced a blueprint, so its answers are locked.', projectId }, { status: 409 })
  }

  const answers = answersChanged ? sanitizeAnswers(body.answers) : previous.answers
  const current = body.current !== undefined ? clampQuestionIndex(Number(body.current) || 0) : previous.current
  const archived = typeof body.archived === 'boolean' ? body.archived : previous.archived

  let status = interview.status as string
  if (!projectId) {
    if (body.complete === true) {
      if (answeredCount(answers) === 0) return NextResponse.json({ error: 'Answer at least one question first.' }, { status: 400 })
      status = 'completed'
    } else if (answersChanged) {
      status = answeredCount(answers) > 0 ? 'in-progress' : 'draft'
    }
  }

  const updatedAt = new Date().toISOString()
  const { error } = await supabase
    .from('interviews')
    .update({
      title: titleFromAnswers(answers),
      status,
      progress: progressFor(answers),
      messages: serializeInterviewMessages({ answers, current, archived }),
      updated_at: updatedAt,
    })
    .eq('id', interview.id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Interview autosave failed:', error.message)
    return NextResponse.json({ error: 'Unable to save your answers right now.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, status, progress: progressFor(answers), savedAt: updatedAt })
}
