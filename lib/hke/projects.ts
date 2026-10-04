import type { SupabaseClient } from '@supabase/supabase-js'
import { INTERVIEW_QUESTIONS } from '@/types/interview'
import { blueprintEntries, blueprintValueToText, stepEntries } from './blueprint'
import { ASSET_SUMMARY_COLUMNS, PROJECT_COLUMNS, type ProjectRow } from './db'
import type { AssetSummary } from './assets'
import { parseInterviewMessages, type InterviewAnswers } from './interview'
import { STEP_SECTIONS } from './steps'

/** Loads a project the user owns (RLS applies on a session client), or null. */
export async function loadOwnedProject(supabase: SupabaseClient, userId: string, projectId: string): Promise<ProjectRow | null> {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  const row = data as ProjectRow
  return { ...row, content: row.content && typeof row.content === 'object' ? row.content : {} }
}

export async function loadInterviewAnswers(supabase: SupabaseClient, userId: string, interviewId: string): Promise<InterviewAnswers> {
  const { data } = await supabase.from('interviews').select('messages').eq('id', interviewId).eq('user_id', userId).maybeSingle()
  return parseInterviewMessages(data?.messages).answers
}

export async function listProjectAssets(supabase: SupabaseClient, userId: string, projectId: string): Promise<AssetSummary[]> {
  const { data } = await supabase
    .from('project_assets')
    .select(ASSET_SUMMARY_COLUMNS)
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data ?? []) as AssetSummary[]
}

/** Blueprint, plan steps, and interview answers as one Markdown document. */
export function projectToMarkdown(title: string, content: Record<string, unknown>, answers: InterviewAnswers) {
  const lines: string[] = []
  for (const entry of blueprintEntries(content)) lines.push(`## ${entry.label}`, blueprintValueToText(entry.value), '')
  for (const step of STEP_SECTIONS) {
    const entries = stepEntries(content, step.key)
    if (entries?.length) lines.push(`## ${step.label}`, ...entries.map((entry) => `- **${entry.label}:** ${entry.value}`), '')
  }
  const answered = INTERVIEW_QUESTIONS.filter((question) => answers[String(question.id)]?.trim())
  if (answered.length) {
    lines.push('## Interview Answers', '')
    for (const question of answered) lines.push(`### ${question.question}`, answers[String(question.id)].trim(), '')
  }
  return lines.join('\n').trim() || `No blueprint content has been saved for ${title} yet.`
}
