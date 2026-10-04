import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { parseInterviewMessages } from '@/lib/hke/interview'
import { isUuid } from '@/lib/hke/server'
import AppHeader from '@/components/hke/AppHeader'
import InterviewWorkspace from '@/components/hke/InterviewWorkspace'

export const dynamic = 'force-dynamic'

export default async function BuilderPage({ searchParams }: { searchParams: { interview?: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const interviewId = isUuid(searchParams.interview) ? searchParams.interview : null
  let initial = { answers: {}, current: 0, archived: false } as ReturnType<typeof parseInterviewMessages>
  let updatedAt: string | null = null

  if (interviewId) {
    const { data: interview } = await supabase
      .from('interviews')
      .select('id, messages, updated_at')
      .eq('id', interviewId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!interview) redirect('/dashboard')

    const { data: project } = await supabase.from('projects').select('id').eq('interview_id', interviewId).eq('user_id', user.id).maybeSingle()
    if (project) redirect(`/projects/${project.id}`)

    initial = parseInterviewMessages(interview.messages)
    updatedAt = interview.updated_at
  }

  return (
    <main className="min-h-screen bg-brand-black text-white">
      <AppHeader backHref="/dashboard" backLabel="Dashboard" />
      <InterviewWorkspace
        interviewId={interviewId}
        initialAnswers={initial.answers}
        initialCurrent={initial.current}
        serverUpdatedAt={updatedAt}
        archived={initial.archived}
      />
    </main>
  )
}
