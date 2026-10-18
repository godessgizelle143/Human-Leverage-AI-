import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getUserUsage } from '@/lib/hke/access'
import { answeredCount, parseInterviewMessages, TOTAL_QUESTIONS, titleFromAnswers } from '@/lib/hke/interview'
import { isUuid } from '@/lib/hke/server'
import { canOpenVault, groupVaultAnswers } from '@/lib/hke/vault'
import AppHeader from '@/components/hke/AppHeader'
import { ProgressMeter } from '@/components/hke/LifecycleBadge'

export const dynamic = 'force-dynamic'

export default async function KnowledgeVaultPage({ params }: { params: { interviewId: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isUuid(params.interviewId)) redirect('/dashboard')

  // The interview is free; the vault is what a plan or trial pays for.
  const { usage } = await getUserUsage(supabase, user)
  if (!canOpenVault(usage)) redirect('/dashboard#plans')

  const [{ data: interview, error: interviewError }, { data: project }] = await Promise.all([
    supabase.from('interviews').select('id, title, messages, updated_at').eq('id', params.interviewId).eq('user_id', user.id).maybeSingle(),
    supabase.from('projects').select('id').eq('interview_id', params.interviewId).eq('user_id', user.id).maybeSingle(),
  ])
  // A failed read must not look like an empty vault.
  if (interviewError) throw new Error('The interview for this vault could not be loaded.')
  if (!interview) redirect('/dashboard')

  const { answers } = parseInterviewMessages(interview.messages)
  const answered = answeredCount(answers)
  const sections = groupVaultAnswers(answers)
  const title = interview.title?.trim() || titleFromAnswers(answers)

  return (
    <main className="min-h-screen bg-brand-black text-white">
      <AppHeader backHref="/dashboard" backLabel="Dashboard" />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <p className="eyebrow eyebrow-pink">Knowledge Vault</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight break-words text-brand-gold sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-white/65">Everything you shared in your interview, saved and organized. Speak once. Build forever.</p>

        <section className="panel-feature mt-8 rounded-3xl p-5 sm:p-8" aria-label="Vault progress">
          <ProgressMeter value={Math.round((answered / TOTAL_QUESTIONS) * 100)} label={`${answered} of ${TOTAL_QUESTIONS} answered`} />
          <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row">
            {project ? (
              <Link href={`/projects/${project.id}`} className="btn-primary justify-center">Open workspace →</Link>
            ) : (
              <Link href={`/builder?interview=${interview.id}`} className="btn-primary justify-center">{answered < TOTAL_QUESTIONS ? 'Continue the interview →' : 'Review the interview →'}</Link>
            )}
          </div>
        </section>

        <div className="mt-12 space-y-10">
          {sections.map((section) => (
            <section key={section.key} aria-labelledby={`vault-${section.key}`}>
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <h2 id={`vault-${section.key}`} className="text-2xl font-bold text-brand-gold">{section.label}</h2>
                  <p className="mt-1 text-sm text-white/50">{section.summary}</p>
                </div>
                <p className="shrink-0 text-sm text-white/45">{section.answered} of {section.entries.length}</p>
              </div>
              <dl className="grid gap-4 md:grid-cols-2">
                {section.entries.map((entry) => (
                  <div key={entry.id} className="glass min-w-0 rounded-2xl p-5">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-brand-pink">{entry.question}</dt>
                    <dd className="mt-2.5 leading-7 whitespace-pre-wrap break-words text-white/80">{entry.answer ?? <span className="text-white/30">Not answered yet</span>}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
