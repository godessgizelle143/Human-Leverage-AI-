import { NextResponse } from 'next/server'
import { readJson, requireUser } from '@/lib/hke/server'
import { clampQuestionIndex, progressFor, sanitizeAnswers, serializeInterviewMessages, titleFromAnswers, answeredCount } from '@/lib/hke/interview'

// Creates a new draft project interview. Optional answers let a browser-only
// draft from before server-side autosave be migrated into the account.
export async function POST(request: Request) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { supabase, user } = auth

  const body = await readJson(request)
  const answers = sanitizeAnswers(body.answers)
  const current = clampQuestionIndex(Number(body.current) || 0)
  const now = new Date().toISOString()
  const id = crypto.randomUUID()

  const { error } = await supabase.from('interviews').insert({
    id,
    user_id: user.id,
    title: titleFromAnswers(answers),
    status: answeredCount(answers) > 0 ? 'in-progress' : 'draft',
    progress: progressFor(answers),
    messages: serializeInterviewMessages({ answers, current, archived: false }),
    created_at: now,
    updated_at: now,
  })

  if (error) {
    console.error('Draft interview create failed:', error.message)
    return NextResponse.json({ error: 'Unable to start a new project. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ id })
}
